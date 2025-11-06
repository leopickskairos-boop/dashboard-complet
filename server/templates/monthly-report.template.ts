import type { MonthlyReportMetrics } from "../report-data.service";

/**
 * Generate HTML template for monthly report PDF
 */
export function generateReportHTML(
  metrics: MonthlyReportMetrics,
  userEmail: string
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

  const formatChange = (current: number, previous: number): string => {
    if (previous === 0) return "N/A";
    const change = ((current - previous) / previous) * 100;
    const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "→";
    const color = change > 0 ? "#10b981" : change < 0 ? "#ef4444" : "#6b7280";
    return `<span style="color: ${color}">${arrow} ${Math.abs(Math.round(change))}%</span>`;
  };

  // Generate chart data for Chart.js
  const peakHoursLabels = metrics.peakHours.slice(0, 10).map(h => `${h.hour}h`);
  const peakHoursData = metrics.peakHours.slice(0, 10).map(h => h.callCount);

  const statusLabels = metrics.callsByStatus.map(s => {
    const labels: Record<string, string> = {
      completed: 'Complétés',
      failed: 'Échoués',
      canceled: 'Annulés',
      no_answer: 'Sans réponse',
      active: 'En cours'
    };
    return labels[s.status] || s.status;
  });
  const statusData = metrics.callsByStatus.map(s => s.count);
  const statusColors = metrics.callsByStatus.map(s => {
    const colors: Record<string, string> = {
      completed: '#10b981',
      failed: '#ef4444',
      canceled: '#f59e0b',
      no_answer: '#6b7280',
      active: '#3b82f6'
    };
    return colors[s.status] || '#6b7280';
  });

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport Mensuel - ${metrics.month}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #ffffff;
      padding: 40px;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #3b82f6;
    }
    
    .header h1 {
      font-size: 32px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 8px;
    }
    
    .header .subtitle {
      font-size: 18px;
      color: #6b7280;
    }
    
    .header .period {
      font-size: 14px;
      color: #9ca3af;
      margin-top: 4px;
    }
    
    .section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }
    
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .kpi-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
    }
    
    .kpi-label {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    
    .kpi-value {
      font-size: 32px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }
    
    .kpi-change {
      font-size: 14px;
      color: #6b7280;
    }
    
    .chart-container {
      margin: 20px 0;
      page-break-inside: avoid;
    }
    
    .chart-wrapper {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .chart-title {
      font-size: 16px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 16px;
    }
    
    canvas {
      max-width: 100%;
      height: 300px !important;
    }
    
    .insight-box {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .insight-title {
      font-size: 14px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 8px;
    }
    
    .insight-text {
      font-size: 14px;
      color: #1f2937;
      line-height: 1.5;
    }
    
    .status-list {
      list-style: none;
    }
    
    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #f9fafb;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    
    .status-name {
      font-size: 14px;
      color: #374151;
      font-weight: 500;
    }
    
    .status-stats {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    
    .status-count {
      font-size: 14px;
      font-weight: 600;
      color: #111827;
    }
    
    .status-percent {
      font-size: 13px;
      color: #6b7280;
    }
    
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    
    @media print {
      body {
        padding: 20px;
      }
      
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>Rapport Mensuel d'Activité</h1>
    <div class="subtitle">${userEmail}</div>
    <div class="period">${metrics.month}</div>
  </div>

  <!-- KPIs Overview -->
  <div class="section">
    <h2 class="section-title">Vue d'ensemble</h2>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total des appels</div>
        <div class="kpi-value">${metrics.totalCalls}</div>
        <div class="kpi-change">vs mois dernier: ${formatChange(metrics.totalCalls, metrics.previousMonthTotalCalls)}</div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Appels complétés</div>
        <div class="kpi-value">${metrics.activeCalls}</div>
        <div class="kpi-change">vs mois dernier: ${formatChange(metrics.activeCalls, metrics.previousMonthActiveCalls)}</div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Taux de conversion</div>
        <div class="kpi-value">${formatPercent(metrics.conversionRate)}</div>
        <div class="kpi-change">vs mois dernier: ${formatChange(metrics.conversionRate, metrics.previousMonthConversionRate)}</div>
      </div>
      
      <div class="kpi-card">
        <div class="kpi-label">Durée moyenne</div>
        <div class="kpi-value">${formatDuration(metrics.averageCallDuration)}</div>
        <div class="kpi-change">vs mois dernier: ${formatChange(metrics.averageCallDuration, metrics.previousMonthAverageDuration)}</div>
      </div>
    </div>
  </div>

  <!-- Peak Hours Chart -->
  ${metrics.peakHours.length > 0 && metrics.totalCalls > 0 ? `
  <div class="section">
    <h2 class="section-title">Heures de pic d'activité</h2>
    <div class="chart-wrapper">
      <canvas id="peakHoursChart"></canvas>
    </div>
  </div>
  ` : ''}

  <!-- Status Distribution -->
  ${metrics.callsByStatus.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Répartition des appels par statut</h2>
    <div class="chart-wrapper">
      <canvas id="statusChart"></canvas>
    </div>
    <ul class="status-list">
      ${metrics.callsByStatus.map(s => `
        <li class="status-item">
          <span class="status-name">${statusLabels[metrics.callsByStatus.indexOf(s)]}</span>
          <div class="status-stats">
            <span class="status-count">${s.count} appels</span>
            <span class="status-percent">${formatPercent(s.percentage)}</span>
          </div>
        </li>
      `).join('')}
    </ul>
  </div>
  ` : ''}

  <!-- Automatic Insights -->
  <div class="section">
    <h2 class="section-title">Analyses automatiques</h2>
    
    <div class="insight-box">
      <div class="insight-title">Activité</div>
      <div class="insight-text">${metrics.insights.peakActivity}</div>
    </div>
    
    <div class="insight-box">
      <div class="insight-title">Performance</div>
      <div class="insight-text">${metrics.insights.statusDistribution}</div>
    </div>
    
    <div class="insight-box">
      <div class="insight-title">Évolution</div>
      <div class="insight-text">${metrics.insights.monthComparison}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>Rapport généré automatiquement le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <p>VoiceAI - Plateforme IA Réceptionniste Vocale</p>
  </div>

  <!-- Chart.js Scripts -->
  <script>
    // Wait for Chart.js to load
    window.addEventListener('DOMContentLoaded', () => {
      // Peak hours chart
      ${metrics.peakHours.length > 0 && metrics.totalCalls > 0 ? `
      const peakCtx = document.getElementById('peakHoursChart');
      if (peakCtx) {
        new Chart(peakCtx, {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(peakHoursLabels)},
            datasets: [{
              label: 'Nombre d\\'appels',
              data: ${JSON.stringify(peakHoursData)},
              backgroundColor: 'rgba(59, 130, 246, 0.8)',
              borderColor: 'rgba(59, 130, 246, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0
                }
              }
            }
          }
        });
      }
      ` : ''}

      // Status distribution chart
      ${metrics.callsByStatus.length > 0 ? `
      const statusCtx = document.getElementById('statusChart');
      if (statusCtx) {
        new Chart(statusCtx, {
          type: 'pie',
          data: {
            labels: ${JSON.stringify(statusLabels)},
            datasets: [{
              data: ${JSON.stringify(statusData)},
              backgroundColor: ${JSON.stringify(statusColors)},
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom'
              }
            }
          }
        });
      }
      ` : ''}
    });
  </script>
</body>
</html>
  `.trim();
}
