/**
 * AI Consultant Report HTML Template
 * Professional 6-10 page PDF template in McKinsey/Bain style
 */

import { MbrV1 } from "@shared/mbr-types";
import { AiReportNarrative } from "../services/ai-report.service";

function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

function getScoreColor(score: number | null): string {
  if (score === null) return "#6b7280";
  if (score >= 80) return "#059669";
  if (score >= 60) return "#d97706";
  if (score >= 40) return "#ea580c";
  return "#dc2626";
}

function getEffortBadge(effort: string): string {
  const colors: Record<string, string> = {
    faible: "#059669",
    moyen: "#d97706",
    élevé: "#dc2626",
  };
  const color = colors[effort] || "#6b7280";
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${color};color:white;font-size:11px;font-weight:500;text-transform:uppercase;">${effort}</span>`;
}

export function generateAiReportHTML(mbr: MbrV1, narrative: AiReportNarrative): string {
  const { tenant, kpis, performance_score, finance } = mbr;
  const scoreColor = getScoreColor(performance_score.global);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport Mensuel - ${tenant.name} - ${tenant.period.month_label}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1f2937;
      background: #ffffff;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm 25mm;
      margin: 0 auto;
      background: white;
      page-break-after: always;
    }
    
    .page:last-child { page-break-after: auto; }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 20px;
      border-bottom: 3px solid #1e40af;
      margin-bottom: 30px;
    }
    
    .header-left h1 {
      font-size: 22pt;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 4px;
    }
    
    .header-left .subtitle {
      font-size: 13pt;
      color: #6b7280;
      font-weight: 400;
    }
    
    .header-right {
      text-align: right;
      font-size: 10pt;
      color: #6b7280;
    }
    
    .header-right .company {
      font-size: 14pt;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    
    /* Sections */
    .section {
      margin-bottom: 28px;
    }
    
    .section-title {
      font-size: 14pt;
      font-weight: 600;
      color: #1e40af;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .section-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: #1e40af;
      color: white;
      border-radius: 50%;
      font-size: 11pt;
      font-weight: 600;
    }
    
    .subsection-title {
      font-size: 11pt;
      font-weight: 600;
      color: #374151;
      margin-top: 18px;
      margin-bottom: 10px;
    }
    
    /* Content */
    .content {
      font-size: 10.5pt;
      line-height: 1.7;
      color: #374151;
      text-align: justify;
    }
    
    .content p {
      margin-bottom: 12px;
    }
    
    /* Executive Summary Box */
    .executive-box {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 24px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    
    .executive-box h2 {
      font-size: 16pt;
      font-weight: 600;
      margin-bottom: 16px;
    }
    
    .executive-content {
      font-size: 11pt;
      line-height: 1.8;
      opacity: 0.95;
    }
    
    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin: 20px 0;
    }
    
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    
    .kpi-value {
      font-size: 20pt;
      font-weight: 700;
      color: #1e40af;
    }
    
    .kpi-label {
      font-size: 9pt;
      color: #6b7280;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Score Circle */
    .score-container {
      display: flex;
      align-items: center;
      gap: 20px;
      margin: 16px 0;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
    }
    
    .score-circle {
      width: 70px;
      height: 70px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: white;
      font-weight: 700;
    }
    
    .score-value { font-size: 22pt; }
    .score-suffix { font-size: 9pt; opacity: 0.9; }
    
    .score-details {
      flex: 1;
    }
    
    .score-label {
      font-size: 13pt;
      font-weight: 600;
      color: #1f2937;
    }
    
    .score-notes {
      font-size: 10pt;
      color: #6b7280;
      margin-top: 4px;
    }
    
    /* Insights List */
    .insight-item {
      display: flex;
      gap: 12px;
      padding: 14px;
      background: #fefce8;
      border-left: 4px solid #eab308;
      margin-bottom: 12px;
      border-radius: 0 6px 6px 0;
    }
    
    .insight-icon {
      width: 24px;
      height: 24px;
      background: #eab308;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12pt;
      flex-shrink: 0;
    }
    
    .insight-content {
      font-size: 10.5pt;
      line-height: 1.6;
    }
    
    /* Alert List */
    .alert-item {
      display: flex;
      gap: 12px;
      padding: 14px;
      background: #fef2f2;
      border-left: 4px solid #ef4444;
      margin-bottom: 12px;
      border-radius: 0 6px 6px 0;
    }
    
    .alert-icon {
      width: 24px;
      height: 24px;
      background: #ef4444;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12pt;
      flex-shrink: 0;
    }
    
    /* Action Plan Table */
    .action-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }
    
    .action-table th {
      background: #f1f5f9;
      padding: 10px 12px;
      text-align: left;
      font-size: 9pt;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .action-table td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 10pt;
      vertical-align: top;
    }
    
    .action-table tr:last-child td {
      border-bottom: none;
    }
    
    .action-title {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }
    
    .action-problem {
      font-size: 9.5pt;
      color: #6b7280;
    }
    
    /* Conclusion Box */
    .conclusion-box {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 8px;
      padding: 24px;
      margin-top: 20px;
    }
    
    .conclusion-box h3 {
      font-size: 13pt;
      font-weight: 600;
      color: #166534;
      margin-bottom: 12px;
    }
    
    .conclusion-content {
      font-size: 10.5pt;
      line-height: 1.7;
      color: #374151;
    }
    
    .signature {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #d1fae5;
      font-style: italic;
      color: #166534;
      text-align: right;
    }
    
    /* Footer */
    .footer {
      position: fixed;
      bottom: 15mm;
      left: 25mm;
      right: 25mm;
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { margin: 0; padding: 15mm 20mm; }
    }
  </style>
</head>
<body>

<!-- PAGE 1: Executive Summary -->
<div class="page">
  <div class="header">
    <div class="header-left">
      <h1>Rapport Mensuel de Performance</h1>
      <div class="subtitle">${tenant.period.month_label}</div>
    </div>
    <div class="header-right">
      <div class="company">${tenant.name}</div>
      <div>Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
  </div>

  <div class="executive-box">
    <h2>Synthèse Exécutive</h2>
    <div class="executive-content">${narrative.executiveSummary}</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-value">${formatNumber(kpis.calls_total)}</div>
      <div class="kpi-label">Appels</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${formatNumber(kpis.reservations_total)}</div>
      <div class="kpi-label">Réservations</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${formatCurrency(kpis.estimated_value_eur)}</div>
      <div class="kpi-label">Valeur générée</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${kpis.roi_x ? `${kpis.roi_x}x` : "—"}</div>
      <div class="kpi-label">ROI</div>
    </div>
  </div>

  <div class="score-container">
    <div class="score-circle" style="background: ${scoreColor};">
      <span class="score-value">${performance_score.global ?? "—"}</span>
      <span class="score-suffix">/100</span>
    </div>
    <div class="score-details">
      <div class="score-label">${performance_score.label || "Non évalué"}</div>
      <div class="score-notes">${performance_score.notes.slice(0, 2).join(" • ") || "Analyse en cours"}</div>
    </div>
  </div>
</div>

<!-- PAGE 2: Operational Performance -->
<div class="page">
  <div class="section">
    <div class="section-title"><span class="section-number">2</span>Analyse de la Performance Opérationnelle</div>
    
    <div class="subsection-title">2.1 Appels entrants</div>
    <div class="content"><p>${narrative.operationalPerformance.calls}</p></div>
    
    <div class="subsection-title">2.2 Conversion appels vers réservations</div>
    <div class="content"><p>${narrative.operationalPerformance.conversion}</p></div>
    
    <div class="subsection-title">2.3 Réservations</div>
    <div class="content"><p>${narrative.operationalPerformance.reservations}</p></div>
  </div>
</div>

<!-- PAGE 3: Financial Analysis -->
<div class="page">
  <div class="section">
    <div class="section-title"><span class="section-number">3</span>Analyse Financière & ROI</div>
    
    <div class="subsection-title">3.1 Valeur générée</div>
    <div class="content"><p>${narrative.financialAnalysis.valueGenerated}</p></div>
    
    <div class="subsection-title">3.2 Rentabilité</div>
    <div class="content"><p>${narrative.financialAnalysis.profitability}</p></div>
    
    <div class="subsection-title">3.3 Analyse no-show</div>
    <div class="content"><p>${narrative.financialAnalysis.noShowAnalysis}</p></div>
  </div>
</div>

<!-- PAGE 4: CRM & Reputation -->
<div class="page">
  <div class="section">
    <div class="section-title"><span class="section-number">4</span>Clients, CRM & Réputation</div>
    
    <div class="subsection-title">4.1 Analyse de la base clients</div>
    <div class="content"><p>${narrative.crmReputation.clientBase}</p></div>
    
    <div class="subsection-title">4.2 Fidélisation & rétention</div>
    <div class="content"><p>${narrative.crmReputation.retention}</p></div>
    
    <div class="subsection-title">4.3 Réputation en ligne</div>
    <div class="content"><p>${narrative.crmReputation.onlineReputation}</p></div>
  </div>
</div>

<!-- PAGE 5: Cross Insights & Alerts -->
<div class="page">
  <div class="section">
    <div class="section-title"><span class="section-number">5</span>Insights Transverses & Analyses Croisées</div>
    ${narrative.crossInsights.map((insight, i) => `
      <div class="insight-item">
        <div class="insight-icon">${i + 1}</div>
        <div class="insight-content">${insight}</div>
      </div>
    `).join("")}
  </div>

  <div class="section">
    <div class="section-title"><span class="section-number">6</span>Alertes & Points de Vigilance</div>
    ${narrative.alerts.length > 0 ? narrative.alerts.map(alert => `
      <div class="alert-item">
        <div class="alert-icon">!</div>
        <div class="insight-content">${alert}</div>
      </div>
    `).join("") : '<div class="content"><p>Aucune alerte majeure identifiée ce mois-ci.</p></div>'}
  </div>
</div>

<!-- PAGE 6: Action Plan -->
<div class="page">
  <div class="section">
    <div class="section-title"><span class="section-number">7</span>Plan d'Actions Recommandé</div>
    ${narrative.actionPlan.length > 0 ? `
    <table class="action-table">
      <thead>
        <tr>
          <th style="width:30%">Action</th>
          <th style="width:35%">Impact attendu</th>
          <th style="width:20%">Effort</th>
        </tr>
      </thead>
      <tbody>
        ${narrative.actionPlan.slice(0, 5).map(action => `
        <tr>
          <td>
            <div class="action-title">${action.title}</div>
            <div class="action-problem">${action.problem}</div>
          </td>
          <td>${action.impact}</td>
          <td>${getEffortBadge(action.effort)}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
    ` : '<div class="content"><p>Pas d\'actions prioritaires identifiées ce mois-ci.</p></div>'}
  </div>

  <div class="section">
    <div class="section-title"><span class="section-number">8</span>Projections & Mois Suivant</div>
    <div class="content"><p>${narrative.projections}</p></div>
  </div>
</div>

<!-- PAGE 7: Conclusion -->
<div class="page">
  <div class="section">
    <div class="section-title"><span class="section-number">9</span>Conclusion</div>
    <div class="conclusion-box">
      <h3>Points clés à retenir</h3>
      <div class="conclusion-content">${narrative.conclusion}</div>
      <div class="signature">— Votre conseiller SpeedAI</div>
    </div>
  </div>
</div>

</body>
</html>`;
}
