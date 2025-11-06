import type { MonthlyReportMetrics } from "../report-data.service";

/**
 * Generate HTML email template for monthly report notification
 */
export function generateReportEmailHTML(
  metrics: MonthlyReportMetrics,
  userEmail: string,
  downloadUrl?: string
): string {
  // Format numbers for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatPercent = (value: number): string => {
    return `${Math.round(value)}%`;
  };

  const formatChange = (current: number, previous: number): { text: string; color: string; arrow: string } => {
    if (previous === 0) return { text: "N/A", color: "#6b7280", arrow: "" };
    const change = ((current - previous) / previous) * 100;
    const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
    const color = change > 0 ? "#10b981" : change < 0 ? "#ef4444" : "#6b7280";
    const text = `${arrow} ${Math.abs(Math.round(change))}%`;
    return { text, color, arrow };
  };

  const totalChange = formatChange(metrics.totalCalls, metrics.previousMonthTotalCalls);
  const completedChange = formatChange(metrics.activeCalls, metrics.previousMonthActiveCalls);
  const conversionChange = formatChange(metrics.conversionRate, metrics.previousMonthConversionRate);
  const durationChange = formatChange(metrics.averageCallDuration, metrics.previousMonthAverageDuration);

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre rapport mensuel est prêt</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 0; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; line-height: 1.2;">
                Rapport Mensuel d'Activité
              </h1>
              <p style="margin: 12px 0 0; font-size: 16px; color: #e0e7ff; line-height: 1.5;">
                ${metrics.month}
              </p>
              <div style="height: 40px;"></div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 24px;">
              <p style="margin: 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                Bonjour,
              </p>
              <p style="margin: 16px 0 0; font-size: 16px; color: #1f2937; line-height: 1.6;">
                Votre rapport mensuel d'activité est maintenant disponible. Voici un aperçu rapide de vos statistiques pour ${metrics.month} :
              </p>
            </td>
          </tr>

          <!-- KPIs Summary -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <!-- Row 1 -->
                <tr>
                  <td width="48%" style="padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                      Total des appels
                    </p>
                    <p style="margin: 8px 0 4px; font-size: 32px; font-weight: 700; color: #111827; line-height: 1;">
                      ${metrics.totalCalls}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: ${totalChange.color}; font-weight: 500;">
                      ${totalChange.text} vs mois dernier
                    </p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                      Appels complétés
                    </p>
                    <p style="margin: 8px 0 4px; font-size: 32px; font-weight: 700; color: #111827; line-height: 1;">
                      ${metrics.activeCalls}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: ${completedChange.color}; font-weight: 500;">
                      ${completedChange.text} vs mois dernier
                    </p>
                  </td>
                </tr>
                
                <!-- Spacing -->
                <tr><td colspan="3" style="height: 16px;"></td></tr>
                
                <!-- Row 2 -->
                <tr>
                  <td width="48%" style="padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                      Taux de conversion
                    </p>
                    <p style="margin: 8px 0 4px; font-size: 32px; font-weight: 700; color: #111827; line-height: 1;">
                      ${formatPercent(metrics.conversionRate)}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: ${conversionChange.color}; font-weight: 500;">
                      ${conversionChange.text} vs mois dernier
                    </p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
                      Durée moyenne
                    </p>
                    <p style="margin: 8px 0 4px; font-size: 32px; font-weight: 700; color: #111827; line-height: 1;">
                      ${formatDuration(metrics.averageCallDuration)}
                    </p>
                    <p style="margin: 0; font-size: 13px; color: ${durationChange.color}; font-weight: 500;">
                      ${durationChange.text} vs mois dernier
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Insights -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <div style="padding: 20px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; margin-bottom: 12px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e40af;">
                  Activité
                </p>
                <p style="margin: 12px 0 0; font-size: 14px; color: #1f2937; line-height: 1.6;">
                  ${metrics.insights.peakActivity}
                </p>
              </div>
              
              <div style="padding: 20px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; margin-bottom: 12px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e40af;">
                  Performance
                </p>
                <p style="margin: 12px 0 0; font-size: 14px; color: #1f2937; line-height: 1.6;">
                  ${metrics.insights.statusDistribution}
                </p>
              </div>
              
              <div style="padding: 20px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e40af;">
                  Évolution
                </p>
                <p style="margin: 12px 0 0; font-size: 14px; color: #1f2937; line-height: 1.6;">
                  ${metrics.insights.monthComparison}
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <p style="margin: 0 0 20px; font-size: 15px; color: #374151; line-height: 1.6;">
                Le rapport complet avec graphiques détaillés et analyses approfondies est disponible en pièce jointe (PDF).
              </p>
              ${downloadUrl ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <a href="${downloadUrl}" style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
                      Consulter dans le dashboard
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5; text-align: center;">
                Vous recevez cet email car vous êtes abonné à VoiceAI.
              </p>
              <p style="margin: 12px 0 0; font-size: 13px; color: #6b7280; line-height: 1.5; text-align: center;">
                © ${new Date().getFullYear()} VoiceAI - Plateforme IA Réceptionniste Vocale
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of the email (fallback for non-HTML clients)
 */
export function generateReportEmailText(
  metrics: MonthlyReportMetrics,
  userEmail: string
): string {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatPercent = (value: number): string => {
    return `${Math.round(value)}%`;
  };

  return `
RAPPORT MENSUEL D'ACTIVITÉ - ${metrics.month}

Bonjour,

Votre rapport mensuel d'activité est maintenant disponible.

VUE D'ENSEMBLE
--------------
Total des appels: ${metrics.totalCalls}
Appels complétés: ${metrics.activeCalls}
Taux de conversion: ${formatPercent(metrics.conversionRate)}
Durée moyenne: ${formatDuration(metrics.averageCallDuration)}

ANALYSE AUTOMATIQUE
-------------------
${metrics.insights.monthComparison}
${metrics.insights.peakActivity}
${metrics.insights.statusDistribution}

Le rapport complet avec graphiques détaillés est disponible en pièce jointe (PDF).

Vous pouvez également consulter votre dashboard à tout moment pour accéder à vos statistiques en temps réel.

---
VoiceAI - Plateforme IA Réceptionniste Vocale
© ${new Date().getFullYear()}

Vous recevez cet email car vous êtes abonné à VoiceAI.
  `.trim();
}
