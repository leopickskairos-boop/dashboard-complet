import { db } from "./db";
import { calls } from "@shared/schema";
import { and, eq, gte, lte, sql, count, avg } from "drizzle-orm";

export interface MonthlyReportMetrics {
  // Period information
  periodStart: Date;
  periodEnd: Date;
  month: string; // e.g., "Novembre 2025"
  
  // KPIs
  totalCalls: number;
  activeCalls: number; // Calls with status 'completed'
  conversionRate: number; // Percentage of completed calls
  averageCallDuration: number; // In seconds
  
  // Previous month comparison
  previousMonthTotalCalls: number;
  previousMonthActiveCalls: number;
  previousMonthConversionRate: number;
  previousMonthAverageDuration: number;
  
  // Peak hours analysis (array of hours with call counts)
  peakHours: Array<{ hour: number; callCount: number }>;
  
  // Call distribution by status
  callsByStatus: Array<{ status: string; count: number; percentage: number }>;
  
  // Insights (auto-generated text)
  insights: {
    peakActivity: string; // e.g., "Vous recevez le plus d'appels entre 10h et 12h"
    statusDistribution: string; // e.g., "65% de vos appels se terminent avec succès"
    monthComparison: string; // e.g., "Hausse de 15% par rapport au mois dernier"
  };
}

export class ReportDataService {
  /**
   * Generate comprehensive monthly report metrics for a user
   */
  static async generateMonthlyMetrics(
    userId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<MonthlyReportMetrics> {
    // Fetch current period calls
    const currentCalls = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.userId, userId),
          gte(calls.createdAt, periodStart),
          lte(calls.createdAt, periodEnd)
        )
      );

    // Fetch previous month calls for comparison
    // Calculate safe bounds for previous month (handles month length variations)
    const previousPeriodStart = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth() - 1,
      1,
      0, 0, 0, 0
    );
    const previousPeriodEnd = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth(),
      0, // Day 0 = last day of previous month
      23, 59, 59, 999
    );

    const previousCalls = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.userId, userId),
          gte(calls.createdAt, previousPeriodStart),
          lte(calls.createdAt, previousPeriodEnd)
        )
      );

    // Calculate current period KPIs
    const totalCalls = currentCalls.length;
    const activeCalls = currentCalls.filter((c) => c.status === "completed").length;
    const conversionRate = totalCalls > 0 ? (activeCalls / totalCalls) * 100 : 0;
    
    const callsWithDuration = currentCalls.filter((c) => c.duration !== null && c.duration > 0);
    const averageCallDuration = callsWithDuration.length > 0
      ? callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / callsWithDuration.length
      : 0;

    // Calculate previous period KPIs
    const previousMonthTotalCalls = previousCalls.length;
    const previousMonthActiveCalls = previousCalls.filter((c) => c.status === "completed").length;
    const previousMonthConversionRate = previousMonthTotalCalls > 0
      ? (previousMonthActiveCalls / previousMonthTotalCalls) * 100
      : 0;
    
    const previousCallsWithDuration = previousCalls.filter((c) => c.duration !== null && c.duration > 0);
    const previousMonthAverageDuration = previousCallsWithDuration.length > 0
      ? previousCallsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / previousCallsWithDuration.length
      : 0;

    // Analyze peak hours
    const peakHours = this.calculatePeakHours(currentCalls);

    // Calculate calls distribution by status
    const callsByStatus = this.calculateStatusDistribution(currentCalls);

    // Generate insights
    const insights = this.generateInsights({
      totalCalls,
      activeCalls,
      conversionRate,
      previousMonthTotalCalls,
      previousMonthActiveCalls,
      previousMonthConversionRate,
      peakHours,
      callsByStatus,
    });

    // Format month name
    const month = periodStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);

    return {
      periodStart,
      periodEnd,
      month: monthCapitalized,
      totalCalls,
      activeCalls,
      conversionRate,
      averageCallDuration,
      previousMonthTotalCalls,
      previousMonthActiveCalls,
      previousMonthConversionRate,
      previousMonthAverageDuration,
      peakHours,
      callsByStatus,
      insights,
    };
  }

  /**
   * Calculate peak hours of activity
   */
  private static calculatePeakHours(calls: any[]): Array<{ hour: number; callCount: number }> {
    const hourlyCount = new Map<number, number>();

    // Initialize all hours
    for (let h = 0; h < 24; h++) {
      hourlyCount.set(h, 0);
    }

    // Count calls by hour
    calls.forEach((call) => {
      const hour = new Date(call.startTime).getHours();
      hourlyCount.set(hour, (hourlyCount.get(hour) || 0) + 1);
    });

    // Convert to array and sort by call count
    const peakHours = Array.from(hourlyCount.entries())
      .map(([hour, callCount]) => ({ hour, callCount }))
      .sort((a, b) => b.callCount - a.callCount);

    return peakHours;
  }

  /**
   * Calculate distribution of calls by status
   */
  private static calculateStatusDistribution(calls: any[]): Array<{ status: string; count: number; percentage: number }> {
    const totalCalls = calls.length;
    if (totalCalls === 0) {
      return [];
    }

    const statusCount = new Map<string, number>();

    calls.forEach((call) => {
      statusCount.set(call.status, (statusCount.get(call.status) || 0) + 1);
    });

    return Array.from(statusCount.entries())
      .map(([status, count]) => ({
        status,
        count,
        percentage: (count / totalCalls) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Generate automatic insights based on metrics
   */
  private static generateInsights(data: {
    totalCalls: number;
    activeCalls: number;
    conversionRate: number;
    previousMonthTotalCalls: number;
    previousMonthActiveCalls: number;
    previousMonthConversionRate: number;
    peakHours: Array<{ hour: number; callCount: number }>;
    callsByStatus: Array<{ status: string; count: number; percentage: number }>;
  }): {
    peakActivity: string;
    statusDistribution: string;
    monthComparison: string;
  } {
    // Peak activity insight
    let peakActivity = "Aucune donnée d'activité disponible pour ce mois.";
    if (data.peakHours.length > 0 && data.totalCalls > 0) {
      const topHours = data.peakHours.filter(h => h.callCount > 0).slice(0, 3);
      if (topHours.length > 0) {
        const topHour = topHours[0];
        if (topHours.length === 1) {
          peakActivity = `Vous recevez le plus d'appels à ${topHour.hour}h (${topHour.callCount} appels).`;
        } else {
          const hourRange = `${topHours[0].hour}h-${topHours[topHours.length - 1].hour + 1}h`;
          peakActivity = `Vous recevez le plus d'appels entre ${hourRange}.`;
        }
      }
    }

    // Status distribution insight
    let statusDistribution = "Aucune donnée sur la répartition des appels.";
    if (data.callsByStatus.length > 0) {
      const completedStatus = data.callsByStatus.find(s => s.status === 'completed');
      if (completedStatus) {
        statusDistribution = `${Math.round(completedStatus.percentage)}% de vos appels se terminent avec succès.`;
      } else {
        const topStatus = data.callsByStatus[0];
        const statusLabels: Record<string, string> = {
          completed: 'complétés',
          failed: 'échoués',
          canceled: 'annulés',
          no_answer: 'sans réponse',
          active: 'en cours'
        };
        const statusLabel = statusLabels[topStatus.status] || topStatus.status;
        statusDistribution = `${Math.round(topStatus.percentage)}% de vos appels sont ${statusLabel}.`;
      }
    }

    // Month comparison insight
    let monthComparison = "Pas de données de comparaison disponibles.";
    if (data.previousMonthTotalCalls > 0) {
      const callsChange = data.totalCalls - data.previousMonthTotalCalls;
      const callsChangePercent = Math.round((callsChange / data.previousMonthTotalCalls) * 100);
      
      if (callsChange > 0) {
        monthComparison = `Hausse de ${callsChangePercent}% par rapport au mois dernier (+${callsChange} appels).`;
      } else if (callsChange < 0) {
        monthComparison = `Baisse de ${Math.abs(callsChangePercent)}% par rapport au mois dernier (${callsChange} appels).`;
      } else {
        monthComparison = `Volume d'appels stable par rapport au mois dernier.`;
      }
    } else if (data.totalCalls > 0) {
      monthComparison = `Premier mois d'activité avec ${data.totalCalls} appels enregistrés.`;
    }

    return {
      peakActivity,
      statusDistribution,
      monthComparison,
    };
  }
}
