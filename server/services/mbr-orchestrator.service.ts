/**
 * MBR (Monthly Business Report) Orchestrator Service
 * Orchestrates the full report generation pipeline: build → render → store → notify
 */

import * as crypto from 'crypto';
import { MbrV1 } from "@shared/mbr-types";
import { MbrJobService } from './mbr-job.service';
import { mbrPdfService, MbrPdfResult } from './mbr-pdf.service';
import { storage } from '../storage';
import { fileStorage } from '../file-storage.service';
import { sendEmail } from '../gmail-email';

export interface MbrOrchestrationResult {
  success: boolean;
  reportId?: string;
  mbrVersion: string;
  pdfPath?: string;
  pdfChecksum?: string;
  pdfSizeBytes?: number;
  emailSentAt?: Date;
  error?: string;
}

export class MbrOrchestratorService {

  /**
   * Full pipeline: Build MBR → Generate PDF → Store → Email → Create notification
   */
  async runFullPipeline(
    userId: string,
    userEmail: string,
    periodStart: Date,
    periodEnd: Date,
    options?: {
      skipEmail?: boolean;
      skipNotification?: boolean;
      forceRegenerate?: boolean;
    }
  ): Promise<MbrOrchestrationResult> {
    const tag = `[MbrOrchestrator:${userId}]`;
    console.log(`${tag} Starting full pipeline for ${userEmail}`);

    try {
      // Step 1: Check for existing report (idempotency)
      if (!options?.forceRegenerate) {
        const existing = await storage.getMonthlyReportByPeriod(userId, periodStart, periodEnd);
        if (existing) {
          console.log(`${tag} Report already exists (id: ${existing.id}), skipping`);
          return {
            success: true,
            reportId: existing.id.toString(),
            mbrVersion: 'mbr_v1',
            pdfPath: existing.pdfPath || undefined,
            pdfChecksum: existing.pdfChecksum || undefined,
          };
        }
      }

      // Step 2: Build MBR JSON
      console.log(`${tag} Building mbr_v1...`);
      let mbr: MbrV1;
      try {
        mbr = await MbrJobService.buildMbrForUser(userId, periodStart, periodEnd);
        console.log(`${tag} mbr_v1 built: ${mbr.kpis.calls_total} calls, ${mbr.kpis.reservations_total} reservations`);
      } catch (buildError) {
        console.error(`${tag} Failed to build MBR:`, buildError);
        return {
          success: false,
          mbrVersion: 'mbr_v1',
          error: `MBR build failed: ${buildError instanceof Error ? buildError.message : String(buildError)}`,
        };
      }

      // Skip if no data
      if (mbr.kpis.calls_total === 0 && mbr.kpis.reservations_total === 0) {
        console.log(`${tag} No calls or reservations - skipping report generation`);
        return {
          success: false,
          mbrVersion: 'mbr_v1',
          error: 'No data for the period',
        };
      }

      // Step 3: Generate PDF
      console.log(`${tag} Generating PDF...`);
      let pdfResult: MbrPdfResult;
      try {
        pdfResult = await mbrPdfService.generatePdf(mbr);
        console.log(`${tag} PDF generated: ${pdfResult.sizeBytes} bytes`);
      } catch (pdfError) {
        console.error(`${tag} Failed to generate PDF:`, pdfError);
        return {
          success: false,
          mbrVersion: 'mbr_v1',
          error: `PDF generation failed: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`,
        };
      }

      // Step 4: Store PDF file
      const monthLabel = mbr.tenant.period.month_label.replace(/\s+/g, '-');
      const filename = `mbr-${userId}-${monthLabel}.pdf`;
      let pdfPath: string;
      try {
        pdfPath = await fileStorage.save(pdfResult.buffer, filename);
        console.log(`${tag} PDF saved: ${pdfPath}`);
      } catch (storageError) {
        console.error(`${tag} Failed to save PDF:`, storageError);
        return {
          success: false,
          mbrVersion: 'mbr_v1',
          error: `PDF storage failed: ${storageError instanceof Error ? storageError.message : String(storageError)}`,
        };
      }

      // Step 5: Send email (optional)
      let emailSentAt: Date | undefined;
      if (!options?.skipEmail) {
        try {
          const emailSubject = `Votre rapport mensuel SpeedAI - ${mbr.tenant.period.month_label}`;
          const emailHtml = this.generateEmailHTML(mbr);
          const emailText = this.generateEmailText(mbr);

          await sendEmail({
            to: userEmail,
            subject: emailSubject,
            text: emailText,
            html: emailHtml,
            attachments: [
              {
                filename: `Rapport-${monthLabel}.pdf`,
                content: pdfResult.buffer,
                contentType: 'application/pdf',
              },
            ],
          });

          emailSentAt = new Date();
          console.log(`${tag} Email sent to ${userEmail}`);
        } catch (emailError) {
          console.error(`${tag} Failed to send email:`, emailError);
          // Continue - report will still be created
        }
      }

      // Step 6: Create monthly report record
      const reportStatus = emailSentAt ? 'sent' : 'pdf_generated';
      const legacyMetrics = {
        month: mbr.tenant.period.month_label,
        periodStart: mbr.tenant.period.start,
        periodEnd: mbr.tenant.period.end,
        totalCalls: mbr.kpis.calls_total,
        confirmedReservations: mbr.kpis.reservations_total,
        conversionRate: mbr.kpis.reservations_total > 0 && mbr.kpis.calls_total > 0 
          ? Math.round((mbr.kpis.reservations_total / mbr.kpis.calls_total) * 100) 
          : 0,
        afterHoursCalls: mbr.calls.after_hours,
        aiSuccessRate: 0,
        estimatedValueEur: mbr.kpis.estimated_value_eur,
      };
      const report = await storage.createMonthlyReport({
        userId,
        periodStart,
        periodEnd,
        subscriptionRenewalAt: new Date(),
        metrics: JSON.stringify(legacyMetrics),
        metricsJson: JSON.stringify(mbr),
        pdfPath,
        pdfChecksum: pdfResult.checksum,
        emailedAt: emailSentAt || null,
        notificationId: null,
        retryCount: 0,
        status: reportStatus,
      });

      console.log(`${tag} Report record created: ${report.id}`);

      // Step 7: Create dashboard notification (optional)
      if (!options?.skipNotification) {
        try {
          await storage.createNotification({
            userId,
            type: 'monthly_report_ready',
            title: 'Rapport mensuel disponible',
            message: `Votre rapport d'activité pour ${mbr.tenant.period.month_label} est maintenant disponible.`,
            metadata: JSON.stringify({
              reportId: report.id,
              month: mbr.tenant.period.month_label,
              totalCalls: mbr.kpis.calls_total,
              estimatedValue: mbr.kpis.estimated_value_eur,
            }),
            isRead: false,
          });
          console.log(`${tag} Notification created`);
        } catch (notifError) {
          console.error(`${tag} Failed to create notification:`, notifError);
        }
      }

      console.log(`${tag} Pipeline completed successfully`);

      return {
        success: true,
        reportId: report.id.toString(),
        mbrVersion: 'mbr_v1',
        pdfPath,
        pdfChecksum: pdfResult.checksum,
        pdfSizeBytes: pdfResult.sizeBytes,
        emailSentAt,
      };

    } catch (error) {
      console.error(`${tag} Unexpected error:`, error);
      return {
        success: false,
        mbrVersion: 'mbr_v1',
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Generate simple email HTML for report delivery
   */
  private generateEmailHTML(mbr: MbrV1): string {
    const { tenant, kpis, performance_score } = mbr;
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
    <h1 style="color: #3b82f6; font-size: 24px; margin-bottom: 8px;">SpeedAI</h1>
    <h2 style="color: #0f172a; font-size: 20px; margin-bottom: 24px;">Rapport Mensuel - ${tenant.period.month_label}</h2>
    
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
      Bonjour,<br><br>
      Votre rapport mensuel pour <strong>${tenant.name}</strong> est disponible en pièce jointe.
    </p>
    
    <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #334155; font-size: 14px; margin: 0 0 16px 0;">Résumé</h3>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Appels totaux</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${kpis.calls_total}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Réservations</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${kpis.reservations_total}</td>
        </tr>
        ${kpis.estimated_value_eur !== null ? `
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Valeur estimée</td>
          <td style="color: #22c55e; font-weight: 600; text-align: right;">${kpis.estimated_value_eur.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}</td>
        </tr>
        ` : ''}
        ${performance_score.global !== null ? `
        <tr>
          <td style="color: #64748b; padding: 4px 0;">Score de performance</td>
          <td style="color: #3b82f6; font-weight: 600; text-align: right;">${performance_score.global}/100</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 32px;">
      Rapport généré automatiquement par SpeedAI.<br>
      Pour plus de détails, consultez le PDF en pièce jointe.
    </p>
  </div>
</body>
</html>`;
  }

  /**
   * Generate plain text email
   */
  private generateEmailText(mbr: MbrV1): string {
    const { tenant, kpis } = mbr;
    return `
SpeedAI - Rapport Mensuel - ${tenant.period.month_label}

Bonjour,

Votre rapport mensuel pour ${tenant.name} est disponible en pièce jointe.

Résumé:
- Appels totaux: ${kpis.calls_total}
- Réservations: ${kpis.reservations_total}
${kpis.estimated_value_eur !== null ? `- Valeur estimée: ${kpis.estimated_value_eur.toLocaleString('fr-FR')} €` : ''}

Pour plus de détails, consultez le PDF en pièce jointe.

--
Rapport généré automatiquement par SpeedAI
`;
  }
}

export const mbrOrchestrator = new MbrOrchestratorService();
