/**
 * Monthly Business Report (MBR) v1 HTML Template
 * Professional 6-page PDF template with data tags (Estimé/Optionnel/Non disponible)
 */

import { MbrV1, DataMethod } from "@shared/mbr-types";

function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

function getMethodTag(method: DataMethod): string {
  switch (method) {
    case 'estimate':
      return '<span class="tag tag-estimate">Estimé</span>';
    case 'optional_crm':
      return '<span class="tag tag-optional">Optionnel</span>';
    case 'computed_or_null':
      return '';
    default:
      return '';
  }
}

function renderDataValue(value: number | null | undefined, unit: string, method: DataMethod): string {
  if (value === null || value === undefined) {
    return `<span class="value-unavailable">Non disponible</span>`;
  }
  const formattedValue = unit === 'EUR' ? formatCurrency(value) : formatNumber(value);
  const unitLabel = unit === 'hours' ? 'h' : unit === 'count' ? '' : unit;
  return `<span class="value">${formattedValue}${unitLabel}</span> ${getMethodTag(method)}`;
}

function getScoreColor(score: number | null): string {
  if (score === null) return '#6b7280';
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function getScoreLabel(label: string | null): string {
  return label || 'Non évalué';
}

export function generateMbrReportHTML(mbr: MbrV1): string {
  const { tenant, kpis, performance_score, summary_bullets, calls, reservations, finance, reputation, ai_insights, forecast, meta } = mbr;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport Mensuel - ${tenant.name} - ${tenant.period.month_label}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1e293b;
      background: #ffffff;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      page-break-after: always;
      position: relative;
    }
    
    .page:last-child {
      page-break-after: auto;
    }
    
    /* Header & Footer */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 15px;
      border-bottom: 2px solid #3b82f6;
      margin-bottom: 25px;
    }
    
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #3b82f6;
    }
    
    .period-badge {
      background: #eff6ff;
      color: #1d4ed8;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 500;
      font-size: 10pt;
    }
    
    .page-footer {
      position: absolute;
      bottom: 15mm;
      left: 20mm;
      right: 20mm;
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
    }
    
    /* Cover Page */
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: calc(297mm - 40mm);
    }
    
    .cover-logo {
      font-size: 48px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 20px;
    }
    
    .cover-title {
      font-size: 32px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 10px;
    }
    
    .cover-subtitle {
      font-size: 20px;
      color: #64748b;
      margin-bottom: 40px;
    }
    
    .cover-tenant {
      font-size: 24px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 10px;
    }
    
    .cover-period {
      font-size: 18px;
      color: #64748b;
    }
    
    /* Section Headers */
    .section-title {
      font-size: 18pt;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .section-subtitle {
      font-size: 14pt;
      font-weight: 600;
      color: #334155;
      margin: 20px 0 12px;
    }
    
    /* KPI Cards */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .kpi-card {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      text-align: center;
    }
    
    .kpi-card.highlight {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-color: #93c5fd;
    }
    
    .kpi-label {
      font-size: 10pt;
      color: #64748b;
      margin-bottom: 6px;
      font-weight: 500;
    }
    
    .kpi-value {
      font-size: 28pt;
      font-weight: 700;
      color: #0f172a;
    }
    
    .kpi-value.positive {
      color: #22c55e;
    }
    
    .kpi-value.warning {
      color: #f59e0b;
    }
    
    .kpi-value.negative {
      color: #ef4444;
    }
    
    /* Tags */
    .tag {
      display: inline-block;
      font-size: 8pt;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: 6px;
    }
    
    .tag-estimate {
      background: #fef3c7;
      color: #92400e;
    }
    
    .tag-optional {
      background: #ede9fe;
      color: #5b21b6;
    }
    
    .value-unavailable {
      color: #94a3b8;
      font-style: italic;
    }
    
    /* Score Gauge */
    .score-container {
      display: flex;
      align-items: center;
      gap: 30px;
      margin-bottom: 25px;
    }
    
    .score-gauge {
      width: 140px;
      height: 140px;
      position: relative;
    }
    
    .score-circle {
      transform: rotate(-90deg);
    }
    
    .score-bg {
      fill: none;
      stroke: #e2e8f0;
      stroke-width: 12;
    }
    
    .score-progress {
      fill: none;
      stroke-width: 12;
      stroke-linecap: round;
      stroke-dasharray: 377;
      transition: stroke-dashoffset 0.5s ease;
    }
    
    .score-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    
    .score-number {
      font-size: 36pt;
      font-weight: 700;
    }
    
    .score-label {
      font-size: 10pt;
      color: #64748b;
    }
    
    .radar-section {
      flex: 1;
    }
    
    .radar-items {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    
    .radar-item {
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px;
    }
    
    .radar-label {
      font-size: 9pt;
      color: #64748b;
      margin-bottom: 4px;
    }
    
    .radar-bar {
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .radar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    
    /* Summary Bullets */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    
    .summary-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px 16px;
      border-left: 4px solid #3b82f6;
    }
    
    .summary-label {
      font-size: 10pt;
      color: #475569;
    }
    
    .summary-value {
      font-size: 14pt;
      font-weight: 600;
      color: #0f172a;
    }
    
    /* Charts */
    .chart-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .chart-title {
      font-size: 12pt;
      font-weight: 600;
      color: #334155;
      margin-bottom: 15px;
    }
    
    .chart-canvas {
      width: 100%;
      height: 200px;
    }
    
    /* Heatmap */
    .heatmap-container {
      overflow-x: auto;
    }
    
    .heatmap {
      display: grid;
      gap: 3px;
      font-size: 9pt;
    }
    
    .heatmap-cell {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      font-weight: 500;
    }
    
    .heatmap-header {
      background: transparent;
      color: #64748b;
      font-weight: 600;
    }
    
    .heatmap-0 { background: #f1f5f9; color: #94a3b8; }
    .heatmap-1 { background: #dbeafe; color: #1d4ed8; }
    .heatmap-2 { background: #93c5fd; color: #1d4ed8; }
    .heatmap-3 { background: #60a5fa; color: #ffffff; }
    .heatmap-4 { background: #3b82f6; color: #ffffff; }
    .heatmap-5 { background: #2563eb; color: #ffffff; }
    
    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 10pt;
    }
    
    .data-table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .data-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .data-table tr:hover td {
      background: #f8fafc;
    }
    
    /* Finance Breakdown */
    .finance-breakdown {
      margin-bottom: 25px;
    }
    
    .breakdown-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .breakdown-row:nth-child(odd) {
      background: #f8fafc;
    }
    
    .breakdown-label {
      color: #475569;
    }
    
    .breakdown-value {
      font-weight: 600;
      color: #0f172a;
    }
    
    .breakdown-total {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important;
      font-size: 12pt;
      font-weight: 700;
    }
    
    .breakdown-total .breakdown-value {
      color: #1d4ed8;
      font-size: 16pt;
    }
    
    /* AI Insights */
    .insight-card {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 15px;
    }
    
    .insight-card.discovery {
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    }
    
    .insight-card.alert {
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    }
    
    .insight-card.action {
      background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
    }
    
    .insight-title {
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .insight-list {
      list-style: none;
      padding-left: 0;
    }
    
    .insight-list li {
      padding: 6px 0;
      color: #334155;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }
    
    .insight-list li:last-child {
      border-bottom: none;
    }
    
    /* Forecast */
    .forecast-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .forecast-card {
      background: #f8fafc;
      border-radius: 10px;
      padding: 16px;
      border: 1px solid #e2e8f0;
    }
    
    .forecast-label {
      font-size: 9pt;
      color: #64748b;
      margin-bottom: 4px;
    }
    
    .forecast-value {
      font-size: 16pt;
      font-weight: 700;
      color: #0f172a;
    }
    
    /* Data Completeness */
    .completeness-grid {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }
    
    .completeness-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 9pt;
    }
    
    .completeness-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .completeness-ok { background: #22c55e; }
    .completeness-partial { background: #f59e0b; }
    .completeness-unknown { background: #94a3b8; }
    .completeness-missing { background: #ef4444; }
    
    /* Utilities */
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .mb-10 { margin-bottom: 10px; }
    .mb-20 { margin-bottom: 20px; }
    .mt-20 { margin-top: 20px; }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { margin: 0; padding: 15mm; }
    }
  </style>
</head>
<body>
  <!-- PAGE 1: Cover -->
  <div class="page cover">
    <div class="cover-logo">SpeedAI</div>
    <div class="cover-title">Rapport Mensuel</div>
    <div class="cover-subtitle">Business Intelligence & Performance</div>
    <div style="margin: 40px 0;">
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="38" stroke="#3b82f6" stroke-width="4" fill="none"/>
        <path d="M25 40 L35 50 L55 30" stroke="#3b82f6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>
    </div>
    <div class="cover-tenant">${tenant.name}</div>
    <div class="cover-period">${tenant.period.month_label}</div>
    <div style="margin-top: 60px; color: #94a3b8; font-size: 10pt;">
      Période: ${new Date(tenant.period.start).toLocaleDateString('fr-FR')} — ${new Date(tenant.period.end).toLocaleDateString('fr-FR')}
    </div>
  </div>

  <!-- PAGE 2: KPIs & Performance Score -->
  <div class="page">
    <div class="page-header">
      <div class="logo">SpeedAI</div>
      <div class="period-badge">${tenant.period.month_label}</div>
    </div>
    
    <h1 class="section-title">Vue d'ensemble</h1>
    
    <div class="kpi-grid">
      <div class="kpi-card highlight">
        <div class="kpi-label">Appels totaux</div>
        <div class="kpi-value">${formatNumber(kpis.calls_total)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">Réservations</div>
        <div class="kpi-value">${formatNumber(kpis.reservations_total)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">Valeur estimée</div>
        <div class="kpi-value ${kpis.estimated_value_eur !== null ? 'positive' : ''}">${formatCurrency(kpis.estimated_value_eur)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Note moyenne avis</div>
        <div class="kpi-value">${kpis.reviews_avg_rating !== null ? `${kpis.reviews_avg_rating.toFixed(1)}/5` : '—'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Taux no-show</div>
        <div class="kpi-value ${kpis.no_show_rate !== null && kpis.no_show_rate < 5 ? 'positive' : kpis.no_show_rate !== null && kpis.no_show_rate > 15 ? 'negative' : 'warning'}">${formatPercent(kpis.no_show_rate)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">ROI SpeedAI</div>
        <div class="kpi-value ${kpis.roi_x !== null && kpis.roi_x > 1 ? 'positive' : ''}">${kpis.roi_x !== null ? `${kpis.roi_x.toFixed(1)}x` : '—'}</div>
      </div>
    </div>
    
    <h2 class="section-subtitle">Score de Performance Global</h2>
    <div class="score-container">
      <div class="score-gauge">
        <svg class="score-circle" width="140" height="140" viewBox="0 0 140 140">
          <circle class="score-bg" cx="70" cy="70" r="60"/>
          <circle class="score-progress" cx="70" cy="70" r="60" 
            stroke="${getScoreColor(performance_score.global)}"
            stroke-dashoffset="${377 - (377 * (performance_score.global || 0) / 100)}"/>
        </svg>
        <div class="score-text">
          <div class="score-number" style="color: ${getScoreColor(performance_score.global)}">${performance_score.global !== null ? performance_score.global : '—'}</div>
          <div class="score-label">${getScoreLabel(performance_score.label)}</div>
        </div>
      </div>
      <div class="radar-section">
        <div class="radar-items">
          <div class="radar-item">
            <div class="radar-label">Conversion</div>
            <div class="radar-bar"><div class="radar-fill" style="width: ${performance_score.radar.conversion || 0}%; background: #3b82f6;"></div></div>
          </div>
          <div class="radar-item">
            <div class="radar-label">Fidélité</div>
            <div class="radar-bar"><div class="radar-fill" style="width: ${performance_score.radar.loyalty || 0}%; background: #22c55e;"></div></div>
          </div>
          <div class="radar-item">
            <div class="radar-label">Satisfaction</div>
            <div class="radar-bar"><div class="radar-fill" style="width: ${performance_score.radar.satisfaction || 0}%; background: #f59e0b;"></div></div>
          </div>
          <div class="radar-item">
            <div class="radar-label">Rentabilité</div>
            <div class="radar-bar"><div class="radar-fill" style="width: ${performance_score.radar.profitability || 0}%; background: #8b5cf6;"></div></div>
          </div>
        </div>
      </div>
    </div>
    
    <h2 class="section-subtitle">Résumé du mois</h2>
    <div class="summary-grid">
      ${summary_bullets.map(bullet => `
        <div class="summary-item">
          <span class="summary-label">${bullet.label}</span>
          <span class="summary-value">${renderDataValue(bullet.value, bullet.unit, bullet.method)}</span>
        </div>
      `).join('')}
    </div>
    
    <div class="page-footer">
      <span>${tenant.name}</span>
      <span>Page 2</span>
    </div>
  </div>

  <!-- PAGE 3: Appels & Heatmap -->
  <div class="page">
    <div class="page-header">
      <div class="logo">SpeedAI</div>
      <div class="period-badge">${tenant.period.month_label}</div>
    </div>
    
    <h1 class="section-title">Analyse des Appels</h1>
    
    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="kpi-card">
        <div class="kpi-label">Total appels</div>
        <div class="kpi-value" style="font-size: 22pt;">${formatNumber(calls.total)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Hors horaires</div>
        <div class="kpi-value" style="font-size: 22pt;">${formatNumber(calls.after_hours)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">% Hors horaires</div>
        <div class="kpi-value" style="font-size: 22pt;">${calls.total > 0 ? formatPercent((calls.after_hours / calls.total) * 100) : '—'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Créneaux analysés</div>
        <div class="kpi-value" style="font-size: 22pt;">${calls.by_slot.length}</div>
      </div>
    </div>
    
    ${calls.by_slot.length > 0 ? `
    <h2 class="section-subtitle">Performance par créneau horaire</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Créneau</th>
          <th class="text-right">Appels</th>
          <th class="text-right">Taux conversion</th>
          <th class="text-right">Durée moy.</th>
          <th class="text-right">Ticket moyen</th>
        </tr>
      </thead>
      <tbody>
        ${calls.by_slot.map(slot => `
          <tr>
            <td>${slot.label}</td>
            <td class="text-right">${formatNumber(slot.calls)}</td>
            <td class="text-right">${formatPercent(slot.conversion_rate)}</td>
            <td class="text-right">${slot.avg_duration_sec !== null ? `${Math.round(slot.avg_duration_sec / 60)}min` : '—'}</td>
            <td class="text-right">${formatCurrency(slot.avg_ticket_eur)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    ${calls.weekly_trend.length > 0 ? `
    <h2 class="section-subtitle">Tendance hebdomadaire</h2>
    <div class="chart-container">
      <canvas id="callsTrendChart" height="180"></canvas>
    </div>
    ` : ''}
    
    ${calls.insights.length > 0 ? `
    <h2 class="section-subtitle">Insights</h2>
    <div class="insight-card discovery">
      <ul class="insight-list">
        ${calls.insights.map(insight => `<li>• ${insight}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div class="page-footer">
      <span>${tenant.name}</span>
      <span>Page 3</span>
    </div>
  </div>

  <!-- PAGE 4: Réservations & No-shows -->
  <div class="page">
    <div class="page-header">
      <div class="logo">SpeedAI</div>
      <div class="period-badge">${tenant.period.month_label}</div>
    </div>
    
    <h1 class="section-title">Réservations & No-shows</h1>
    
    <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="kpi-card highlight">
        <div class="kpi-label">Réservations</div>
        <div class="kpi-value" style="font-size: 22pt;">${formatNumber(reservations.total)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">Confirmées</div>
        <div class="kpi-value" style="font-size: 22pt;">${formatNumber(reservations.confirmed)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Taux no-show</div>
        <div class="kpi-value ${reservations.no_show.rate !== null && reservations.no_show.rate < 5 ? 'positive' : reservations.no_show.rate !== null && reservations.no_show.rate > 15 ? 'negative' : 'warning'}" style="font-size: 22pt;">${formatPercent(reservations.no_show.rate)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">No-shows évités</div>
        <div class="kpi-value positive" style="font-size: 22pt;">${formatNumber(reservations.no_show.avoided_count)}</div>
      </div>
    </div>
    
    ${reservations.by_party_size.length > 0 ? `
    <h2 class="section-subtitle">Répartition par taille de groupe</h2>
    <div class="chart-container">
      <canvas id="partySizeChart" height="150"></canvas>
    </div>
    ` : ''}
    
    ${reservations.no_show.risk_factors.length > 0 ? `
    <h2 class="section-subtitle">Facteurs de risque no-show identifiés</h2>
    <div class="insight-card alert">
      <ul class="insight-list">
        ${reservations.no_show.risk_factors.map(factor => `<li>⚠️ ${factor}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${reservations.cross.party_size_vs_no_show.length > 0 ? `
    <h2 class="section-subtitle">No-show par taille de groupe</h2>
    <table class="data-table">
      <thead>
        <tr>
          <th>Taille groupe</th>
          <th class="text-right">Réservations</th>
          <th class="text-right">No-shows</th>
          <th class="text-right">Taux</th>
        </tr>
      </thead>
      <tbody>
        ${reservations.cross.party_size_vs_no_show.map(row => `
          <tr>
            <td>${row.party_size}</td>
            <td class="text-right">${formatNumber(row.reservations)}</td>
            <td class="text-right">${formatNumber(row.no_shows)}</td>
            <td class="text-right ${row.rate !== null && row.rate > 15 ? 'negative' : ''}">${formatPercent(row.rate)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    <div class="page-footer">
      <span>${tenant.name}</span>
      <span>Page 4</span>
    </div>
  </div>

  <!-- PAGE 5: Finance & ROI -->
  <div class="page">
    <div class="page-header">
      <div class="logo">SpeedAI</div>
      <div class="period-badge">${tenant.period.month_label}</div>
    </div>
    
    <h1 class="section-title">Analyse Financière & ROI</h1>
    
    <h2 class="section-subtitle">Décomposition de la valeur générée</h2>
    <div class="finance-breakdown">
      <div class="breakdown-row">
        <span class="breakdown-label">Revenus directs estimés</span>
        <span class="breakdown-value">${formatCurrency(finance.value_breakdown.direct_revenue_eur)} ${finance.value_breakdown.direct_revenue_eur !== null ? getMethodTag('estimate') : ''}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">Appels manqués récupérés (${formatNumber(finance.value_breakdown.missed_calls_recovered.count)} × ${formatCurrency(finance.value_breakdown.missed_calls_recovered.unit_value_eur)})</span>
        <span class="breakdown-value">${formatCurrency(finance.value_breakdown.missed_calls_recovered.value_eur)}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">Réservations hors horaires (${formatNumber(finance.value_breakdown.after_hours_reservations.count)} × ${formatCurrency(finance.value_breakdown.after_hours_reservations.unit_value_eur)})</span>
        <span class="breakdown-value">${formatCurrency(finance.value_breakdown.after_hours_reservations.value_eur)}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">No-shows évités (${formatNumber(finance.value_breakdown.no_shows_avoided.count)} × ${formatCurrency(finance.value_breakdown.no_shows_avoided.unit_value_eur)})</span>
        <span class="breakdown-value">${formatCurrency(finance.value_breakdown.no_shows_avoided.value_eur)}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">Temps administratif économisé (${formatNumber(finance.value_breakdown.admin_time_saved.hours)}h × ${formatCurrency(finance.value_breakdown.admin_time_saved.unit_value_eur)}/h)</span>
        <span class="breakdown-value">${formatCurrency(finance.value_breakdown.admin_time_saved.value_eur)}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">Économies totales</span>
        <span class="breakdown-value">${formatCurrency(finance.value_breakdown.savings_eur)}</span>
      </div>
      <div class="breakdown-row">
        <span class="breakdown-label">Valeur indirecte (réputation, visibilité)</span>
        <span class="breakdown-value">${formatCurrency(finance.value_breakdown.indirect_value_eur)} ${getMethodTag('estimate')}</span>
      </div>
      <div class="breakdown-row breakdown-total">
        <span class="breakdown-label">VALEUR TOTALE GÉNÉRÉE</span>
        <span class="breakdown-value">${formatCurrency(finance.total_value_eur)}</span>
      </div>
    </div>
    
    <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="kpi-card">
        <div class="kpi-label">Coût SpeedAI</div>
        <div class="kpi-value" style="font-size: 20pt;">${formatCurrency(finance.inputs.speedai_monthly_cost_eur)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">Bénéfice net</div>
        <div class="kpi-value positive" style="font-size: 20pt;">${formatCurrency(finance.net_benefit_eur)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">ROI</div>
        <div class="kpi-value positive" style="font-size: 20pt;">${finance.roi_x !== null ? `${finance.roi_x.toFixed(1)}x` : '—'}</div>
      </div>
    </div>
    
    ${finance.notes.length > 0 ? `
    <h2 class="section-subtitle">Notes méthodologiques</h2>
    <div class="insight-card">
      <ul class="insight-list">
        ${finance.notes.map(note => `<li>📝 ${note}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div class="page-footer">
      <span>${tenant.name}</span>
      <span>Page 5</span>
    </div>
  </div>

  <!-- PAGE 6: AI Insights & Forecast -->
  <div class="page">
    <div class="page-header">
      <div class="logo">SpeedAI</div>
      <div class="period-badge">${tenant.period.month_label}</div>
    </div>
    
    <h1 class="section-title">Intelligence Artificielle & Prévisions</h1>
    
    ${ai_insights.enabled && (ai_insights.discoveries.length > 0 || ai_insights.alerts.length > 0 || ai_insights.actions.length > 0) ? `
    <h2 class="section-subtitle">Insights IA</h2>
    
    ${ai_insights.discoveries.length > 0 ? `
    <div class="insight-card discovery">
      <div class="insight-title">💡 Découvertes</div>
      <ul class="insight-list">
        ${ai_insights.discoveries.map(d => `<li>${d}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${ai_insights.alerts.length > 0 ? `
    <div class="insight-card alert">
      <div class="insight-title">⚠️ Alertes</div>
      <ul class="insight-list">
        ${ai_insights.alerts.map(a => `<li>${a}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${ai_insights.actions.length > 0 ? `
    <div class="insight-card action">
      <div class="insight-title">✅ Actions recommandées</div>
      <ul class="insight-list">
        ${ai_insights.actions.map(a => `<li>${a}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ` : `
    <div class="insight-card">
      <p style="color: #64748b; text-align: center; padding: 20px;">Les insights IA seront disponibles avec plus de données.</p>
    </div>
    `}
    
    ${forecast.enabled ? `
    <h2 class="section-subtitle">Prévisions mois prochain</h2>
    <div class="forecast-grid">
      <div class="forecast-card">
        <div class="forecast-label">CA estimé</div>
        <div class="forecast-value">${formatCurrency(forecast.next_month.ca_est_eur)}</div>
      </div>
      <div class="forecast-card">
        <div class="forecast-label">Semaine forte</div>
        <div class="forecast-value" style="font-size: 12pt;">${forecast.next_month.strong_week || '—'}</div>
      </div>
      <div class="forecast-card">
        <div class="forecast-label">Semaine faible</div>
        <div class="forecast-value" style="font-size: 12pt;">${forecast.next_month.weak_week || '—'}</div>
      </div>
      <div class="forecast-card">
        <div class="forecast-label">Tendance</div>
        <div class="forecast-value" style="font-size: 10pt;">${forecast.next_month.reasoning.length > 0 ? forecast.next_month.reasoning[0] : '—'}</div>
      </div>
    </div>
    
    ${forecast.next_month.opportunities.length > 0 ? `
    <div class="insight-card action">
      <div class="insight-title">🚀 Opportunités</div>
      <ul class="insight-list">
        ${forecast.next_month.opportunities.map(o => `<li>${o}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    ${forecast.next_month.risks.length > 0 ? `
    <div class="insight-card alert">
      <div class="insight-title">⚠️ Risques identifiés</div>
      <ul class="insight-list">
        ${forecast.next_month.risks.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    ` : ''}
    
    <h2 class="section-subtitle">Qualité des données</h2>
    <div class="completeness-grid">
      <div class="completeness-item">
        <span class="completeness-dot completeness-${meta.data_completeness.calls}"></span>
        <span>Appels: ${meta.data_completeness.calls}</span>
      </div>
      <div class="completeness-item">
        <span class="completeness-dot completeness-${meta.data_completeness.reservations}"></span>
        <span>Réservations: ${meta.data_completeness.reservations}</span>
      </div>
      <div class="completeness-item">
        <span class="completeness-dot completeness-${meta.data_completeness.reviews}"></span>
        <span>Avis: ${meta.data_completeness.reviews}</span>
      </div>
      <div class="completeness-item">
        <span class="completeness-dot completeness-${meta.data_completeness.crm}"></span>
        <span>CRM: ${meta.data_completeness.crm}</span>
      </div>
    </div>
    
    ${meta.warnings.length > 0 ? `
    <div class="mt-20">
      <div class="insight-card" style="background: #fef3c7;">
        <div class="insight-title">📋 Avertissements</div>
        <ul class="insight-list">
          ${meta.warnings.map(w => `<li>${w}</li>`).join('')}
        </ul>
      </div>
    </div>
    ` : ''}
    
    <div class="page-footer">
      <span>${tenant.name} • Généré par SpeedAI</span>
      <span>Page 6</span>
    </div>
  </div>

  <script>
    // Charts initialization with mutex lock to prevent race conditions
    window.__mbrCharts = window.__mbrCharts || {};
    
    function initMbrCharts() {
      ${calls.weekly_trend.length > 0 ? `
      if (!window.__mbrCharts.callsTrend) {
        const canvas = document.getElementById('callsTrendChart');
        if (canvas) {
          window.__mbrCharts.callsTrend = new Chart(canvas, {
            type: 'line',
            data: {
              labels: ${JSON.stringify(calls.weekly_trend.map(w => w.week))},
              datasets: [{
                label: 'Appels',
                data: ${JSON.stringify(calls.weekly_trend.map(w => w.calls || 0))},
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.3
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } }
            }
          });
        }
      }
      ` : ''}
      
      ${reservations.by_party_size.length > 0 ? `
      if (!window.__mbrCharts.partySize) {
        const canvas = document.getElementById('partySizeChart');
        if (canvas) {
          window.__mbrCharts.partySize = new Chart(canvas, {
            type: 'bar',
            data: {
              labels: ${JSON.stringify(reservations.by_party_size.map(p => p.label))},
              datasets: [{
                label: 'Réservations',
                data: ${JSON.stringify(reservations.by_party_size.map(p => p.count))},
                backgroundColor: '#3b82f6',
                borderRadius: 4
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } }
            }
          });
        }
      }
      ` : ''}
    }
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMbrCharts, { once: true });
    } else {
      initMbrCharts();
    }
  </script>
</body>
</html>`;
}
