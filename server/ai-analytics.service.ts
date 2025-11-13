import { db } from "./db";
import { calls } from "@shared/schema";
import { eq, and, gte, desc, lte } from "drizzle-orm";
import {
  getTimeFilterDate,
  getPreviousPeriod,
  formatDuration,
  calculatePercentageChange,
  aggregateCallsByHour,
  aggregateCallsByTimeSlot,
  findPeakHour,
  type TimeFilter
} from "./call-analytics.utils";

export interface DeepInsight {
  title: string;
  summary: string;
  details: string[];
  recommendation?: string;
  severity?: 'success' | 'warning' | 'info' | 'critical';
  metrics?: {
    label: string;
    value: string | number;
    change?: number;
  }[];
}

export class AIAnalyticsService {
  
  /**
   * Analyse approfondie du volume d'appels
   */
  async analyzeCallVolume(userId: string, timeFilter?: TimeFilter): Promise<DeepInsight> {
    const timeDate = getTimeFilterDate(timeFilter);
    const conditions = [eq(calls.userId, userId)];
    if (timeDate) {
      conditions.push(gte(calls.startTime, timeDate));
    }

    const userCalls = await db
      .select()
      .from(calls)
      .where(and(...conditions))
      .orderBy(desc(calls.startTime));

    // Compare avec la période précédente
    const previousPeriod = getPreviousPeriod(timeFilter);
    const previousCalls = previousPeriod ? await db
      .select()
      .from(calls)
      .where(and(
        eq(calls.userId, userId),
        gte(calls.startTime, previousPeriod.start),
        lte(calls.startTime, previousPeriod.end)
      )).then(c => c.length) : 0;

    const currentCount = userCalls.length;
    const change = calculatePercentageChange(currentCount, previousCalls);

    const details: string[] = [];

    // Trouver le pic d'activité
    const peak = findPeakHour(userCalls);
    if (peak) {
      const peakPercentage = (peak.count / currentCount) * 100;
      details.push(`Le pic d'activité se situe à ${peak.hour}h avec ${peak.count} appels (${Math.round(peakPercentage)}% du total).`);
    }

    // Analyser la répartition journée vs nuit
    const dayCallsCount = userCalls.filter(c => {
      const h = new Date(c.startTime).getHours();
      return h >= 8 && h < 19;
    }).length;
    const nightCallsCount = currentCount - dayCallsCount;

    if (nightCallsCount > 0) {
      details.push(`${nightCallsCount} appel${nightCallsCount > 1 ? 's' : ''} reçu${nightCallsCount > 1 ? 's' : ''} en dehors des heures de bureau (19h-8h).`);
    }

    // Tendance hebdomadaire
    const weekdayCalls = userCalls.filter(c => {
      const day = new Date(c.startTime).getDay();
      return day >= 1 && day <= 5;
    }).length;
    const weekendCalls = currentCount - weekdayCalls;

    if (weekendCalls > 0) {
      details.push(`${weekendCalls} appel${weekendCalls > 1 ? 's' : ''} le week-end, représentant ${Math.round((weekendCalls / currentCount) * 100)}% du volume total.`);
    }

    let recommendation = "";
    let severity: 'success' | 'warning' | 'info' | 'critical' = 'info';

    if (change > 20) {
      recommendation = `Volume en hausse de ${Math.round(change)}% : votre visibilité s'améliore. Assurez-vous que votre IA peut gérer ce flux croissant.`;
      severity = 'success';
    } else if (change < -20) {
      recommendation = `Volume en baisse de ${Math.abs(Math.round(change))}% : vérifiez votre référencement ou relancez vos campagnes marketing.`;
      severity = 'warning';
    } else if (nightCallsCount > dayCallsCount * 0.3) {
      recommendation = "Plus de 30% des appels arrivent hors horaires de bureau. Votre IA capte des opportunités que vous auriez manquées.";
      severity = 'success';
    } else {
      recommendation = "Volume stable. Concentrez-vous sur l'optimisation du taux de conversion.";
    }

    return {
      title: "Analyse du Volume d'Appels",
      summary: `${currentCount} appel${currentCount > 1 ? 's' : ''} enregistré${currentCount > 1 ? 's' : ''} sur la période sélectionnée${change !== 0 ? ` (${change > 0 ? '+' : ''}${Math.round(change)}%)` : ''}.`,
      details,
      recommendation,
      severity,
      metrics: [
        { label: "Total", value: currentCount, change },
        { label: "Pic d'activité", value: peak ? `${peak.hour}h` : 'N/A' },
        { label: "Appels nocturnes", value: nightCallsCount }
      ]
    };
  }

  /**
   * Analyse approfondie du taux de conversion/RDV
   */
  async analyzeConversionRate(userId: string, timeFilter?: TimeFilter): Promise<DeepInsight> {
    const timeDate = getTimeFilterDate(timeFilter);
    const conditions = [eq(calls.userId, userId)];
    if (timeDate) {
      conditions.push(gte(calls.startTime, timeDate));
    }

    const userCalls = await db
      .select()
      .from(calls)
      .where(and(...conditions))
      .orderBy(desc(calls.startTime));

    const totalCalls = userCalls.length;
    const completedCalls = userCalls.filter(c => c.status === 'completed').length;
    const failedCalls = userCalls.filter(c => c.status === 'failed').length;
    const noAnswerCalls = userCalls.filter(c => c.status === 'no_answer').length;

    const conversionRate = totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0;
    const failureRate = totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0;

    const details: string[] = [];

    // Analyse par plage horaire
    const hourlyConversion: { [hour: number]: { total: number; completed: number } } = {};
    userCalls.forEach(call => {
      const hour = new Date(call.startTime).getHours();
      if (!hourlyConversion[hour]) {
        hourlyConversion[hour] = { total: 0, completed: 0 };
      }
      hourlyConversion[hour].total++;
      if (call.status === 'completed') {
        hourlyConversion[hour].completed++;
      }
    });

    let bestHour = -1;
    let bestRate = 0;
    let worstHour = -1;
    let worstRate = 100;

    Object.entries(hourlyConversion).forEach(([hour, stats]) => {
      if (stats.total >= 2) {
        const rate = (stats.completed / stats.total) * 100;
        if (rate > bestRate) {
          bestRate = rate;
          bestHour = parseInt(hour);
        }
        if (rate < worstRate) {
          worstRate = rate;
          worstHour = parseInt(hour);
        }
      }
    });

    if (bestHour !== -1) {
      details.push(`Meilleur créneau : ${bestHour}h-${bestHour + 2}h avec ${Math.round(bestRate)}% de conversion.`);
    }

    if (worstHour !== -1 && worstRate < 20) {
      details.push(`Créneau faible : ${worstHour}h-${worstHour + 2}h avec seulement ${Math.round(worstRate)}% de conversion.`);
    }

    if (noAnswerCalls > totalCalls * 0.2) {
      details.push(`${Math.round((noAnswerCalls / totalCalls) * 100)}% d'appels sans aboutissement. Vérifiez la qualité de vos numéros entrants.`);
    }

    let recommendation = "";
    let severity: 'success' | 'warning' | 'info' | 'critical' = 'info';

    if (conversionRate > 30) {
      recommendation = `Excellent taux de conversion de ${Math.round(conversionRate)}%. Votre script IA performe très bien, maintenez cette qualité.`;
      severity = 'success';
    } else if (conversionRate > 20) {
      recommendation = `Taux de conversion correct à ${Math.round(conversionRate)}%. Testez différentes approches conversationnelles pour atteindre 30%+.`;
      severity = 'info';
    } else if (conversionRate > 10) {
      recommendation = `Taux de conversion à ${Math.round(conversionRate)}%. Analysez les retranscriptions des appels échoués pour optimiser le script.`;
      severity = 'warning';
    } else {
      recommendation = `Taux de conversion faible (${Math.round(conversionRate)}%). Action urgente : revoyez le script et la formation de l'IA.`;
      severity = 'critical';
    }

    if (bestHour !== -1 && worstHour !== -1 && bestRate - worstRate > 40) {
      recommendation += ` Écart de ${Math.round(bestRate - worstRate)}% entre vos meilleures et pires heures : concentrez vos efforts marketing sur les créneaux performants.`;
    }

    return {
      title: "Analyse du Taux de Conversion",
      summary: `${Math.round(conversionRate)}% des appels aboutissent à un rendez-vous pris.`,
      details,
      recommendation,
      severity,
      metrics: [
        { label: "Taux de conversion", value: `${Math.round(conversionRate)}%` },
        { label: "RDV pris", value: completedCalls },
        { label: "Appels échoués", value: `${Math.round(failureRate)}%` }
      ]
    };
  }

  /**
   * Analyse approfondie des plages horaires
   */
  async analyzeTimeSlots(userId: string, timeFilter?: TimeFilter): Promise<DeepInsight> {
    const timeDate = getTimeFilterDate(timeFilter);
    const conditions = [eq(calls.userId, userId)];
    if (timeDate) {
      conditions.push(gte(calls.startTime, timeDate));
    }

    const userCalls = await db
      .select()
      .from(calls)
      .where(and(...conditions))
      .orderBy(desc(calls.startTime));

    const timeSlotStats = aggregateCallsByTimeSlot(userCalls);

    const details: string[] = [];
    let bestSlot = '';
    let bestRate = 0;

    Object.entries(timeSlotStats).forEach(([slot, stats]) => {
      if (stats.total > 0) {
        const rate = (stats.completed / stats.total) * 100;
        details.push(`${slot}: ${stats.total} appels, ${Math.round(rate)}% de conversion.`);
        if (rate > bestRate) {
          bestRate = rate;
          bestSlot = slot;
        }
      }
    });

    const nightStats = timeSlotStats['Nuit (19h-8h)'];
    let recommendation = "";
    let severity: 'success' | 'warning' | 'info' | 'critical' = 'info';

    if (nightStats.total > 0 && nightStats.completed === 0) {
      recommendation = `Aucun RDV pris après 19h sur ${nightStats.total} appels. Envisagez de désactiver cette plage ou d'optimiser le script pour les appels nocturnes.`;
      severity = 'warning';
    } else if (bestSlot === 'Nuit (19h-8h)' && nightStats.completed > 0) {
      recommendation = `Votre IA performe même la nuit ! ${nightStats.completed} RDV confirmés après 19h : un vrai avantage compétitif.`;
      severity = 'success';
    } else {
      recommendation = `${bestSlot} est votre créneau le plus performant (${Math.round(bestRate)}%). Orientez votre marketing vers cette période.`;
      severity = 'info';
    }

    return {
      title: "Analyse des Plages Horaires",
      summary: `${bestSlot} affiche le meilleur taux de conversion avec ${Math.round(bestRate)}%.`,
      details,
      recommendation,
      severity,
      metrics: Object.entries(timeSlotStats).map(([slot, stats]) => ({
        label: slot,
        value: `${stats.completed}/${stats.total}`
      }))
    };
  }

  /**
   * Analyse approfondie de la durée moyenne
   */
  async analyzeAverageDuration(userId: string, timeFilter?: TimeFilter): Promise<DeepInsight> {
    const timeDate = getTimeFilterDate(timeFilter);
    const conditions = [eq(calls.userId, userId)];
    if (timeDate) {
      conditions.push(gte(calls.startTime, timeDate));
    }

    const userCalls = await db
      .select()
      .from(calls)
      .where(and(...conditions))
      .orderBy(desc(calls.startTime));

    const callsWithDuration = userCalls.filter(c => c.duration && c.duration > 0);
    const completedCalls = callsWithDuration.filter(c => c.status === 'completed');
    const failedCalls = callsWithDuration.filter(c => c.status === 'failed');

    if (callsWithDuration.length === 0) {
      return {
        title: "Analyse de la Durée Moyenne",
        summary: "Aucune donnée de durée disponible pour cette période.",
        details: ["Assurez-vous que vos appels enregistrent bien la durée."],
        severity: 'info'
      };
    }

    const avgDuration = callsWithDuration.reduce((sum, c) => sum + c.duration!, 0) / callsWithDuration.length;
    const avgCompletedDuration = completedCalls.length > 0
      ? completedCalls.reduce((sum, c) => sum + c.duration!, 0) / completedCalls.length
      : 0;
    const avgFailedDuration = failedCalls.length > 0
      ? failedCalls.reduce((sum, c) => sum + c.duration!, 0) / failedCalls.length
      : 0;

    const details: string[] = [];

    const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}min ${secs}s`;
    };

    details.push(`Durée moyenne globale : ${formatDuration(avgDuration)}`);
    if (completedCalls.length > 0) {
      details.push(`RDV pris : ${formatDuration(avgCompletedDuration)} en moyenne`);
    }
    if (failedCalls.length > 0) {
      details.push(`Appels échoués : ${formatDuration(avgFailedDuration)} en moyenne`);
    }

    // Analyser les appels trop courts/longs
    const veryShortCalls = callsWithDuration.filter(c => c.duration! < 30).length;
    const veryLongCalls = callsWithDuration.filter(c => c.duration! > 300).length;

    if (veryShortCalls > callsWithDuration.length * 0.3) {
      details.push(`${Math.round((veryShortCalls / callsWithDuration.length) * 100)}% des appels durent moins de 30s : clients pressés ou décrochage prématuré ?`);
    }

    if (veryLongCalls > 0) {
      details.push(`${veryLongCalls} appel${veryLongCalls > 1 ? 's' : ''} dépassent 5 minutes : clients indécis ou script trop verbeux ?`);
    }

    let recommendation = "";
    let severity: 'success' | 'warning' | 'info' | 'critical' = 'info';

    // Comparer durée RDV vs échecs
    if (avgCompletedDuration > avgFailedDuration * 1.5 && completedCalls.length > 0) {
      recommendation = `Les RDV pris nécessitent ${Math.round((avgCompletedDuration / avgFailedDuration - 1) * 100)}% de temps en plus que les échecs. Normal : l'IA doit convaincre et collecter les infos.`;
      severity = 'success';
    } else if (avgCompletedDuration < avgFailedDuration && completedCalls.length > 0) {
      recommendation = `Les appels échoués sont plus longs que les RDV pris. L'IA insiste trop ? Optimisez le script pour détecter le refus plus rapidement.`;
      severity = 'warning';
    } else if (avgDuration > 180) {
      recommendation = `Durée moyenne élevée (${formatDuration(avgDuration)}). Simplifiez le script si le taux de conversion n'est pas excellent.`;
      severity = 'info';
    } else {
      recommendation = `Durée moyenne équilibrée à ${formatDuration(avgDuration)}. Votre IA est efficace.`;
      severity = 'success';
    }

    return {
      title: "Analyse de la Durée Moyenne",
      summary: `Les appels durent en moyenne ${formatDuration(avgDuration)}.`,
      details,
      recommendation,
      severity,
      metrics: [
        { label: "Durée moyenne", value: formatDuration(avgDuration) },
        { label: "RDV pris", value: completedCalls.length > 0 ? formatDuration(avgCompletedDuration) : 'N/A' },
        { label: "Appels échoués", value: failedCalls.length > 0 ? formatDuration(avgFailedDuration) : 'N/A' }
      ]
    };
  }
}

export const aiAnalyticsService = new AIAnalyticsService();
