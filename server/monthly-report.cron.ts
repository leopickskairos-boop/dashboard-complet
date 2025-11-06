import * as cron from 'node-cron';
import * as crypto from 'crypto';
import { storage } from './storage';
import { ReportDataService } from './report-data.service';
import { pdfGenerator } from './pdf-generator.service';
import { fileStorage } from './file-storage.service';
import { sendEmail } from './email';
import { generateReportEmailHTML, generateReportEmailText } from './templates/monthly-report-email.template';
import type { MonthlyReportMetrics } from './report-data.service';

/**
 * Monthly Report Cron Job Service
 * Runs daily at 2:00 AM to check for users needing monthly reports
 */
export class MonthlyReportCronService {
  private cronTask: cron.ScheduledTask | null = null;

  constructor() {
    // Services are imported as singletons
  }

  /**
   * Start the cron job (runs daily at 2:00 AM)
   */
  start(): void {
    if (this.cronTask) {
      console.log('[MonthlyReportCron] Cron job already running');
      return;
    }

    // Schedule: Every day at 2:00 AM
    this.cronTask = cron.schedule('0 2 * * *', async () => {
      console.log('[MonthlyReportCron] Starting monthly report generation check...');
      await this.processMonthlyReports();
    });

    console.log('[MonthlyReportCron] Cron job started - will run daily at 2:00 AM');
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      console.log('[MonthlyReportCron] Cron job stopped');
    }
  }

  /**
   * Manually trigger report generation (for testing)
   */
  async runNow(): Promise<void> {
    console.log('[MonthlyReportCron] Manual trigger - generating reports now...');
    await this.processMonthlyReports();
  }

  /**
   * Main workflow: Process all eligible users
   */
  private async processMonthlyReports(): Promise<void> {
    try {
      // Get users whose subscription renews in ~2 days
      const eligibleUsers = await storage.getUsersForMonthlyReportGeneration();
      
      console.log(`[MonthlyReportCron] Found ${eligibleUsers.length} eligible users`);

      if (eligibleUsers.length === 0) {
        return;
      }

      // Process each user
      for (const user of eligibleUsers) {
        await this.generateReportForUser(user.id, user.email);
      }

      console.log('[MonthlyReportCron] Completed all report generations');
    } catch (error) {
      console.error('[MonthlyReportCron] Error in processMonthlyReports:', error);
    }
  }

  /**
   * Calculate previous month period
   */
  private getPreviousMonthPeriod(): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    
    const periodStart = new Date(year, month, 1, 0, 0, 0, 0);
    const periodEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    
    return { periodStart, periodEnd };
  }

  /**
   * Generate monthly report for a single user
   */
  private async generateReportForUser(userId: string, userEmail: string): Promise<void> {
    console.log(`[MonthlyReportCron] Generating report for user ${userId} (${userEmail})`);

    try {
      // Calculate previous month period
      const { periodStart, periodEnd } = this.getPreviousMonthPeriod();

      // Check if report already exists for this period (idempotency guard)
      const existingReport = await storage.getMonthlyReportByPeriod(userId, periodStart, periodEnd);
      if (existingReport) {
        console.log(`[MonthlyReportCron] Report already exists for user ${userId} period ${periodStart.toISOString()} - ${periodEnd.toISOString()}, skipping`);
        return;
      }

      // Step 1: Generate metrics for the previous month
      const metrics = await ReportDataService.generateMonthlyMetrics(userId, periodStart, periodEnd);
      
      if (metrics.totalCalls === 0) {
        console.log(`[MonthlyReportCron] User ${userId} has no calls - skipping report`);
        return;
      }

      // Step 2: Generate PDF
      const pdfBuffer = await pdfGenerator.generateMonthlyReportPDF(metrics, userEmail);

      // Step 3: Calculate checksum
      const pdfChecksum = crypto.createHash('md5').update(pdfBuffer).digest('hex');

      // Step 4: Store PDF file
      const filename = `monthly-report-${userId}-${metrics.month.replace(/\s+/g, '-')}.pdf`;
      const pdfPath = await fileStorage.save(pdfBuffer, filename);

      // Step 5: Send email with PDF attachment
      let emailSentAt: Date | null = null;
      try {
        const emailHTML = generateReportEmailHTML(metrics, userEmail);
        const emailText = generateReportEmailText(metrics, userEmail);

        await sendEmail({
          to: userEmail,
          subject: `Votre rapport mensuel - ${metrics.month}`,
          text: emailText,
          html: emailHTML,
          attachments: [
            {
              filename: `Rapport-${metrics.month.replace(/\s+/g, '-')}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        });

        emailSentAt = new Date();
        console.log(`[MonthlyReportCron] Email sent to ${userEmail}`);
      } catch (emailError) {
        console.error(`[MonthlyReportCron] Failed to send email to ${userEmail}:`, emailError);
        // Continue - notification and report will still be created
      }

      // Step 6: Create monthly report record
      const report = await storage.createMonthlyReport({
        userId,
        periodStart: metrics.periodStart,
        periodEnd: metrics.periodEnd,
        subscriptionRenewalAt: new Date(),
        metrics: JSON.stringify(metrics),
        pdfPath,
        pdfChecksum,
        emailedAt: emailSentAt,
        notificationId: null,
        retryCount: 0,
      });

      // Step 7: Create dashboard notification
      const notification = await storage.createNotification({
        userId,
        type: 'monthly_report_ready',
        title: 'Rapport mensuel disponible',
        message: `Votre rapport d'activité pour ${metrics.month} est maintenant disponible.`,
        metadata: JSON.stringify({
          reportId: report.id,
          month: metrics.month,
          totalCalls: metrics.totalCalls,
          conversionRate: metrics.conversionRate,
        }),
        isRead: false,
      });

      // Step 8: Update report with notification ID (for reference)
      // Note: We need to use a direct update since report was already created
      // This would require adding updateMonthlyReport to storage interface
      // For now, we'll leave notificationId as null in the initial insert
      
      console.log(`[MonthlyReportCron] Successfully generated report ${report.id} for user ${userId}`);

    } catch (error) {
      console.error(`[MonthlyReportCron] Error generating report for user ${userId}:`, error);
      
      // Increment retry count (would need to implement retry logic)
      // For MVP, we just log the error
    }
  }
}

// Export singleton instance
export const monthlyReportCron = new MonthlyReportCronService();
