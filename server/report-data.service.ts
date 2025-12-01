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
  
  // Advanced KPIs
  appointmentsTaken: number; // Calls with appointmentDate set
  appointmentConversionRate: number; // Percentage of calls that led to appointments
  afterHoursCalls: number; // Calls outside 8h-19h
  afterHoursPercentage: number;
  timeSavedHours: number; // Total time saved by AI (based on call duration)
  estimatedRevenue: number; // Appointments × average client value
  roi: number; // ROI percentage (revenue / AI cost)
  performanceScore: number; // Overall performance score (0-100)
  
  // Previous month comparison
  previousMonthTotalCalls: number;
  previousMonthActiveCalls: number;
  previousMonthConversionRate: number;
  previousMonthAverageDuration: number;
  previousMonthAppointments: number;
  previousMonthAppointmentConversionRate: number;
  previousMonthAfterHoursCalls: number;
  previousMonthAfterHoursPercentage: number;
  previousMonthRevenue: number;
  previousMonthTimeSaved: number;
  previousMonthROI: number;
  previousMonthPerformanceScore: number;
  
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
  
  // Smart AI recommendations
  aiRecommendations: Array<{
    type: 'insight' | 'alert' | 'success';
    title: string;
    message: string;
  }>;
  
  // ===== ENRICHED N8N METRICS =====
  
  // Conversion results breakdown
  conversionResults: Array<{ result: string; count: number; percentage: number }>;
  
  // Client sentiment distribution
  clientMoods: Array<{ mood: string; count: number; percentage: number }>;
  
  // Service type distribution
  serviceTypes: Array<{ serviceType: string; count: number; percentage: number }>;
  
  // Booking metrics
  averageBookingConfidence: number;
  averageBookingDelayDays: number;
  lastMinuteBookings: number;
  lastMinutePercentage: number;
  
  // Client insights
  returningClients: number;
  returningClientPercentage: number;
  upsellAccepted: number;
  upsellConversionRate: number;
  
  // Quality metrics
  callsWithTranscript: number;
  averageCallQuality: string;
  
  // Top keywords from all calls
  topKeywords: Array<{ keyword: string; count: number }>;
  
  // Event type distribution
  eventTypes: Array<{ eventType: string; count: number; percentage: number }>;
  
  // Day of week distribution for appointments
  appointmentsByDayOfWeek: Array<{ day: string; count: number; percentage: number }>;
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

    // Configuration constants
    const AVERAGE_CLIENT_VALUE = 150; // Average revenue per appointment (€)
    const AI_COST_PER_MONTH = 50; // Estimated AI service cost (€)
    const BUSINESS_HOURS_START = 8;
    const BUSINESS_HOURS_END = 19;
    
    // Calculate current period KPIs
    const totalCalls = currentCalls.length;
    const activeCalls = currentCalls.filter((c) => c.status === "completed").length;
    const conversionRate = totalCalls > 0 ? (activeCalls / totalCalls) * 100 : 0;
    
    const callsWithDuration = currentCalls.filter((c) => c.duration !== null && c.duration > 0);
    const averageCallDuration = callsWithDuration.length > 0
      ? callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0) / callsWithDuration.length
      : 0;
    
    // Advanced KPIs
    const appointmentsTaken = currentCalls.filter((c) => c.appointmentDate !== null).length;
    const appointmentConversionRate = totalCalls > 0 ? (appointmentsTaken / totalCalls) * 100 : 0;
    
    // After-hours calls (outside 8h-19h)
    const afterHoursCalls = currentCalls.filter((c) => {
      const hour = new Date(c.startTime).getHours();
      return hour < BUSINESS_HOURS_START || hour >= BUSINESS_HOURS_END;
    }).length;
    const afterHoursPercentage = totalCalls > 0 ? (afterHoursCalls / totalCalls) * 100 : 0;
    
    // Time saved (total call duration converted to hours)
    const totalDurationSeconds = callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0);
    const timeSavedHours = totalDurationSeconds / 3600; // Convert to hours
    
    // Financial metrics
    const estimatedRevenue = appointmentsTaken * AVERAGE_CLIENT_VALUE;
    const roi = AI_COST_PER_MONTH > 0 ? ((estimatedRevenue - AI_COST_PER_MONTH) / AI_COST_PER_MONTH) * 100 : 0;
    
    // Performance score (weighted average of key metrics)
    const performanceScore = this.calculatePerformanceScore({
      conversionRate,
      appointmentConversionRate,
      afterHoursPercentage,
      averageCallDuration,
    });

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
    
    const previousMonthAppointments = previousCalls.filter((c) => c.appointmentDate !== null).length;
    const previousMonthAppointmentConversionRate = previousMonthTotalCalls > 0 
      ? (previousMonthAppointments / previousMonthTotalCalls) * 100 
      : 0;
    
    const previousMonthAfterHoursCalls = previousCalls.filter((c) => {
      const hour = new Date(c.startTime).getHours();
      return hour < BUSINESS_HOURS_START || hour >= BUSINESS_HOURS_END;
    }).length;
    const previousMonthAfterHoursPercentage = previousMonthTotalCalls > 0 
      ? (previousMonthAfterHoursCalls / previousMonthTotalCalls) * 100 
      : 0;
    
    const previousMonthRevenue = previousMonthAppointments * AVERAGE_CLIENT_VALUE;
    const previousTotalDuration = previousCallsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0);
    const previousMonthTimeSaved = previousTotalDuration / 3600;
    
    const previousMonthROI = AI_COST_PER_MONTH > 0 
      ? ((previousMonthRevenue - AI_COST_PER_MONTH) / AI_COST_PER_MONTH) * 100 
      : 0;
    
    const previousMonthPerformanceScore = this.calculatePerformanceScore({
      conversionRate: previousMonthConversionRate,
      appointmentConversionRate: previousMonthAppointmentConversionRate,
      afterHoursPercentage: previousMonthAfterHoursPercentage,
      averageCallDuration: previousMonthAverageDuration,
    });

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
    
    // Generate AI recommendations and alerts
    const aiRecommendations = this.generateAIRecommendations({
      currentCalls,
      previousCalls,
      appointmentsTaken,
      previousMonthAppointments,
      conversionRate,
      previousMonthConversionRate,
      afterHoursPercentage,
      peakHours,
      callsByStatus,
    });
    
    // ===== ENRICHED N8N METRICS =====
    
    // Conversion results breakdown
    const conversionResults = this.calculateDistribution(
      currentCalls, 
      (call: any) => call.conversionResult || 'unknown'
    );
    
    // Client mood distribution  
    const clientMoods = this.calculateDistribution(
      currentCalls.filter((c: any) => c.clientMood),
      (call: any) => call.clientMood
    );
    
    // Service type distribution
    const serviceTypes = this.calculateDistribution(
      currentCalls.filter((c: any) => c.serviceType),
      (call: any) => call.serviceType
    );
    
    // Event type distribution
    const eventTypes = this.calculateDistribution(
      currentCalls.filter((c: any) => c.eventType),
      (call: any) => call.eventType
    );
    
    // Booking metrics
    const callsWithConfidence = currentCalls.filter((c: any) => c.bookingConfidence !== null);
    const averageBookingConfidence = callsWithConfidence.length > 0
      ? callsWithConfidence.reduce((sum: number, c: any) => sum + (c.bookingConfidence || 0), 0) / callsWithConfidence.length
      : 0;
    
    const callsWithDelay = currentCalls.filter((c: any) => c.bookingDelayDays !== null);
    const averageBookingDelayDays = callsWithDelay.length > 0
      ? callsWithDelay.reduce((sum: number, c: any) => sum + (c.bookingDelayDays || 0), 0) / callsWithDelay.length
      : 0;
    
    const lastMinuteBookings = currentCalls.filter((c: any) => c.isLastMinute === true).length;
    const lastMinutePercentage = appointmentsTaken > 0 ? (lastMinuteBookings / appointmentsTaken) * 100 : 0;
    
    // Client insights
    const returningClients = currentCalls.filter((c: any) => c.isReturningClient === true).length;
    const returningClientPercentage = totalCalls > 0 ? (returningClients / totalCalls) * 100 : 0;
    
    const upsellAccepted = currentCalls.filter((c: any) => c.upsellAccepted === true).length;
    const upsellConversionRate = totalCalls > 0 ? (upsellAccepted / totalCalls) * 100 : 0;
    
    // Quality metrics
    const callsWithTranscript = currentCalls.filter((c: any) => c.transcript && c.transcript.length > 0).length;
    const qualityDistribution = this.calculateDistribution(
      currentCalls.filter((c: any) => c.callQuality),
      (call: any) => call.callQuality
    );
    const averageCallQuality = qualityDistribution.length > 0 ? qualityDistribution[0].result : 'N/A';
    
    // Top keywords from all calls
    const topKeywords = this.extractTopKeywords(currentCalls);
    
    // Appointments by day of week
    const appointmentsByDayOfWeek = this.calculateAppointmentsByDayOfWeek(currentCalls);

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
      appointmentsTaken,
      appointmentConversionRate,
      afterHoursCalls,
      afterHoursPercentage,
      timeSavedHours,
      estimatedRevenue,
      roi,
      performanceScore,
      previousMonthTotalCalls,
      previousMonthActiveCalls,
      previousMonthConversionRate,
      previousMonthAverageDuration,
      previousMonthAppointments,
      previousMonthAppointmentConversionRate,
      previousMonthAfterHoursCalls,
      previousMonthAfterHoursPercentage,
      previousMonthRevenue,
      previousMonthTimeSaved,
      previousMonthROI,
      previousMonthPerformanceScore,
      peakHours,
      callsByStatus,
      insights,
      aiRecommendations,
      // Enriched N8N metrics
      conversionResults,
      clientMoods,
      serviceTypes,
      averageBookingConfidence,
      averageBookingDelayDays,
      lastMinuteBookings,
      lastMinutePercentage,
      returningClients,
      returningClientPercentage,
      upsellAccepted,
      upsellConversionRate,
      callsWithTranscript,
      averageCallQuality,
      topKeywords,
      eventTypes,
      appointmentsByDayOfWeek,
    };
  }
  
  /**
   * Calculate generic distribution for any field
   */
  private static calculateDistribution(
    calls: any[], 
    getField: (call: any) => string
  ): Array<{ result: string; count: number; percentage: number }> {
    const total = calls.length;
    if (total === 0) return [];
    
    const distribution = new Map<string, number>();
    calls.forEach((call) => {
      const value = getField(call);
      if (value) {
        distribution.set(value, (distribution.get(value) || 0) + 1);
      }
    });
    
    return Array.from(distribution.entries())
      .map(([result, count]) => ({
        result,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }
  
  /**
   * Extract top keywords from call metadata
   */
  private static extractTopKeywords(calls: any[]): Array<{ keyword: string; count: number }> {
    const keywordCount = new Map<string, number>();
    
    calls.forEach((call) => {
      const keywords = call.keywords || [];
      keywords.forEach((keyword: string) => {
        const normalized = keyword.toLowerCase().trim();
        if (normalized.length > 2) {
          keywordCount.set(normalized, (keywordCount.get(normalized) || 0) + 1);
        }
      });
    });
    
    return Array.from(keywordCount.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15); // Top 15 keywords
  }
  
  /**
   * Calculate appointment distribution by day of week
   */
  private static calculateAppointmentsByDayOfWeek(
    calls: any[]
  ): Array<{ day: string; count: number; percentage: number }> {
    const daysOfWeek = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayCounts = new Map<string, number>();
    
    // Initialize all days
    daysOfWeek.forEach(day => dayCounts.set(day, 0));
    
    // Count appointments by day
    const callsWithAppointment = calls.filter((c: any) => c.appointmentDate);
    callsWithAppointment.forEach((call: any) => {
      // Use appointmentDayOfWeek if available, otherwise calculate from appointmentDate
      if (call.appointmentDayOfWeek) {
        const dayName = daysOfWeek.find(d => 
          d.toLowerCase() === call.appointmentDayOfWeek.toLowerCase()
        ) || call.appointmentDayOfWeek;
        dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
      } else if (call.appointmentDate) {
        const dayIndex = new Date(call.appointmentDate).getDay();
        const dayName = daysOfWeek[dayIndex];
        dayCounts.set(dayName, (dayCounts.get(dayName) || 0) + 1);
      }
    });
    
    const total = callsWithAppointment.length;
    
    return daysOfWeek.map(day => ({
      day,
      count: dayCounts.get(day) || 0,
      percentage: total > 0 ? ((dayCounts.get(day) || 0) / total) * 100 : 0,
    }));
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
  
  /**
   * Calculate overall performance score (0-100)
   */
  private static calculatePerformanceScore(data: {
    conversionRate: number;
    appointmentConversionRate: number;
    afterHoursPercentage: number;
    averageCallDuration: number;
  }): number {
    // Weighted scoring system
    const weights = {
      conversion: 0.35, // 35% - Most important metric
      appointments: 0.30, // 30% - Direct business value
      afterHours: 0.20, // 20% - Service availability
      duration: 0.15, // 15% - Efficiency
    };
    
    // Normalize each metric to 0-100 scale
    const conversionScore = Math.min(data.conversionRate, 100);
    const appointmentScore = Math.min(data.appointmentConversionRate * 2, 100); // Scale up (50% = 100 points)
    const afterHoursScore = Math.min(data.afterHoursPercentage * 3, 100); // More after-hours = better
    
    // Duration score (optimal is 3-5 mins, penalties for too short/long)
    let durationScore = 100;
    if (data.averageCallDuration < 180) { // < 3 mins
      durationScore = (data.averageCallDuration / 180) * 100;
    } else if (data.averageCallDuration > 300) { // > 5 mins
      durationScore = Math.max(50, 100 - ((data.averageCallDuration - 300) / 60) * 10);
    }
    
    // Calculate weighted score
    const totalScore = 
      conversionScore * weights.conversion +
      appointmentScore * weights.appointments +
      afterHoursScore * weights.afterHours +
      durationScore * weights.duration;
    
    return Math.round(totalScore);
  }
  
  /**
   * Generate smart AI recommendations and alerts
   */
  private static generateAIRecommendations(data: {
    currentCalls: any[];
    previousCalls: any[];
    appointmentsTaken: number;
    previousMonthAppointments: number;
    conversionRate: number;
    previousMonthConversionRate: number;
    afterHoursPercentage: number;
    peakHours: Array<{ hour: number; callCount: number }>;
    callsByStatus: Array<{ status: string; count: number; percentage: number }>;
  }): Array<{ type: 'insight' | 'alert' | 'success'; title: string; message: string }> {
    const recommendations: Array<{ type: 'insight' | 'alert' | 'success'; title: string; message: string }> = [];
    
    // 1. Check for appointment decline
    if (data.previousMonthAppointments > 0) {
      const appointmentChange = ((data.appointmentsTaken - data.previousMonthAppointments) / data.previousMonthAppointments) * 100;
      if (appointmentChange < -15) {
        recommendations.push({
          type: 'alert',
          title: '⚠️ Baisse des rendez-vous pris',
          message: `Baisse de ${Math.abs(Math.round(appointmentChange))}% ce mois-ci. Vérifiez la qualité des interactions IA ou les horaires de disponibilité.`
        });
      } else if (appointmentChange > 20) {
        recommendations.push({
          type: 'success',
          title: '✨ Excellente performance',
          message: `Hausse de ${Math.round(appointmentChange)}% des rendez-vous pris ! Continuez sur cette lancée.`
        });
      }
    }
    
    // 2. Check for high failed call rate
    const failedStatus = data.callsByStatus.find(s => s.status === 'failed' || s.status === 'no_answer');
    if (failedStatus && failedStatus.percentage > 25) {
      recommendations.push({
        type: 'alert',
        title: '📞 Taux d\'appels manqués élevé',
        message: `${Math.round(failedStatus.percentage)}% de vos appels échouent. Vérifiez la configuration de votre système téléphonique.`
      });
    }
    
    // 3. Identify best performing time slots
    if (data.peakHours.length > 0 && data.currentCalls.length > 0) {
      const topHours = data.peakHours.filter(h => h.callCount > 0).slice(0, 3);
      if (topHours.length > 0) {
        // Calculate appointment conversion by hour
        const hourlyAppointments = new Map<number, number>();
        data.currentCalls.forEach((call) => {
          if (call.appointmentDate) {
            const hour = new Date(call.startTime).getHours();
            hourlyAppointments.set(hour, (hourlyAppointments.get(hour) || 0) + 1);
          }
        });
        
        // Find hour with best appointment conversion
        let bestHour = -1;
        let bestConversion = 0;
        topHours.forEach((hourData) => {
          const appointments = hourlyAppointments.get(hourData.hour) || 0;
          const conversion = hourData.callCount > 0 ? (appointments / hourData.callCount) * 100 : 0;
          if (conversion > bestConversion) {
            bestConversion = conversion;
            bestHour = hourData.hour;
          }
        });
        
        if (bestHour >= 0 && bestConversion > data.conversionRate) {
          const improvementPercent = Math.round(((bestConversion - data.conversionRate) / data.conversionRate) * 100);
          recommendations.push({
            type: 'insight',
            title: '💡 Recommandation IA',
            message: `Les appels à ${bestHour}h convertissent ${improvementPercent}% mieux que la moyenne. Optimisez votre disponibilité à cette heure.`
          });
        }
      }
    }
    
    // 4. After-hours opportunity
    if (data.afterHoursPercentage > 30) {
      recommendations.push({
        type: 'insight',
        title: '🌙 Service 24/7 valorisé',
        message: `${Math.round(data.afterHoursPercentage)}% de vos appels arrivent hors horaires (19h-8h). Votre IA génère une vraie valeur ajoutée en dehors des heures de bureau.`
      });
    } else if (data.afterHoursPercentage < 10 && data.currentCalls.length > 50) {
      recommendations.push({
        type: 'insight',
        title: '📈 Opportunité de croissance',
        message: 'Peu d\'appels en dehors des horaires de bureau. Communiquez davantage sur votre disponibilité 24/7 pour capter plus de clients.'
      });
    }
    
    // 5. Conversion rate trend
    if (data.previousMonthConversionRate > 0) {
      const conversionChange = data.conversionRate - data.previousMonthConversionRate;
      if (conversionChange < -10) {
        recommendations.push({
          type: 'alert',
          title: '📉 Baisse du taux de conversion',
          message: `Baisse de ${Math.abs(Math.round(conversionChange))} points ce mois-ci. Analysez les transcriptions récentes pour identifier les points de friction.`
        });
      }
    }
    
    // 6. If no recommendations yet, add a generic positive one
    if (recommendations.length === 0 && data.currentCalls.length > 0) {
      recommendations.push({
        type: 'success',
        title: '✅ Performance stable',
        message: 'Votre agent IA fonctionne correctement et maintient des performances constantes.'
      });
    }
    
    // Limit to top 4 most important recommendations
    return recommendations.slice(0, 4);
  }
}
