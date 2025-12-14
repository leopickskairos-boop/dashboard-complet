/**
 * MBR Builder Service - Monthly Business Report (mbr_v1)
 * Transforms raw data into the standardized mbr_v1 JSON structure
 * 
 * Sources de données:
 * - Appels: table calls (via ReportDataService)
 * - Réservations: calls avec appointmentDate + guaranteeSessions pour no-shows
 * - Avis: table reviews
 */

import { db } from "../db";
import { calls, tenants, tenantSettings, reviews, guaranteeSessions } from "@shared/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { ReportDataService, MonthlyReportMetrics } from "../report-data.service";
import { 
  MbrV1, MbrTenant, MbrKpis, MbrCalls, MbrReservations, MbrFinance, 
  MbrReputation, MbrPerformanceScore, MbrSummaryBullet, MbrCallSlot, 
  MbrWeeklyTrend, MbrPartySizeDistribution, MbrLeadTimeDistribution, 
  MbrNoShow, MbrPartySizeVsNoShow, MbrReviewKeyword, MbrMeta, 
  ReportingInputs, DataCompleteness, createEmptyMbrV1
} from "@shared/mbr-types";

const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS_SLOTS = ['09', '10', '11', '12', '14', '18', '19', '20', '21'];
const BUSINESS_HOURS_START = 8;
const BUSINESS_HOURS_END = 20;

interface BuilderContext {
  userId: string;
  tenantId?: string;
  periodStart: Date;
  periodEnd: Date;
  inputs: ReportingInputs;
}

interface CallsBuilderResult {
  calls: MbrCalls;
  rawCalls: any[];
  metrics: MonthlyReportMetrics;
}

interface ReservationsBuilderResult {
  reservations: MbrReservations;
  callsWithAppointment: any[];
  guaranteeSessionsData: any[];
}

export class MbrBuilderService {
  /**
   * Build complete mbr_v1 report for a user/tenant
   */
  static async build(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    tenantId?: string
  ): Promise<MbrV1> {
    const inputs = await this.getReportingInputs(userId, tenantId);
    const ctx: BuilderContext = { userId, tenantId, periodStart, periodEnd, inputs };

    const tenant = await this.buildTenant(ctx);
    const mbr = createEmptyMbrV1(tenant);

    const [callsData, reservationsData, reputationData] = await Promise.all([
      this.buildCalls(ctx),
      this.buildReservations(ctx),
      this.buildReputation(ctx)
    ]);

    mbr.calls = callsData.calls;
    mbr.reservations = reservationsData.reservations;
    mbr.reputation = reputationData;

    mbr.kpis = this.buildKpis(ctx, callsData, reservationsData, reputationData);
    mbr.finance = this.buildFinance(ctx, callsData, reservationsData);
    mbr.kpis.roi_x = mbr.finance.roi_x;
    
    mbr.performance_score = this.buildPerformanceScore(mbr.kpis, callsData, reservationsData);
    mbr.summary_bullets = this.buildSummaryBullets(ctx, mbr);
    
    mbr.crm = { enabled: false, segments: [], retention: null, vip_risk: null };
    mbr.ai_insights = this.buildAiInsights(callsData, reservationsData, reputationData);
    mbr.forecast = this.buildForecast(callsData, reservationsData);
    mbr.meta = this.buildMeta(callsData, reservationsData, reputationData);

    return mbr;
  }

  private static async getReportingInputs(userId: string, tenantId?: string): Promise<ReportingInputs> {
    const defaults: ReportingInputs = {
      avg_ticket_eur: 45,
      avg_party_size: 2.5,
      no_show_value_eur: 80,
      hourly_admin_cost_eur: 20,
      speedai_monthly_cost_eur: 99,
      currency: 'EUR',
      locale: 'fr-FR'
    };

    if (tenantId) {
      const settings = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
      if (settings.length > 0 && settings[0].reportingInputs) {
        return { ...defaults, ...(settings[0].reportingInputs as Partial<ReportingInputs>) };
      }
    }

    return defaults;
  }

  private static async buildTenant(ctx: BuilderContext): Promise<MbrTenant> {
    let name = 'SpeedAI Client';
    let timezone = 'Europe/Paris';

    if (ctx.tenantId) {
      const tenantData = await db.select().from(tenants).where(eq(tenants.id, ctx.tenantId)).limit(1);
      if (tenantData.length > 0) {
        name = tenantData[0].name || name;
        timezone = tenantData[0].timezone || timezone;
      }
    }

    const monthLabel = ctx.periodStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    return {
      tenant_id: ctx.tenantId || ctx.userId,
      name,
      timezone,
      period: {
        month_label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        start: ctx.periodStart.toISOString(),
        end: ctx.periodEnd.toISOString()
      }
    };
  }

  /**
   * Build calls section using ReportDataService to avoid duplication
   */
  private static async buildCalls(ctx: BuilderContext): Promise<CallsBuilderResult> {
    const metrics = await ReportDataService.generateMonthlyMetrics(
      ctx.userId,
      ctx.periodStart,
      ctx.periodEnd
    );

    const whereClause = ctx.tenantId
      ? and(eq(calls.tenantId, ctx.tenantId), gte(calls.createdAt, ctx.periodStart), lte(calls.createdAt, ctx.periodEnd))
      : and(eq(calls.userId, ctx.userId), gte(calls.createdAt, ctx.periodStart), lte(calls.createdAt, ctx.periodEnd));

    const rawCalls = await db.select().from(calls).where(whereClause);

    const heatmap = this.buildHeatmap(rawCalls);
    const bySlot = this.buildCallSlots(rawCalls, metrics);
    const weeklyTrend = this.buildWeeklyTrend(rawCalls, ctx.periodStart, ctx.periodEnd);
    const insights = this.generateCallInsights(metrics, rawCalls);

    return {
      calls: {
        total: metrics.totalCalls,
        after_hours: metrics.afterHoursCalls,
        by_day_hour_heatmap: heatmap,
        by_slot: bySlot,
        weekly_trend: weeklyTrend,
        insights
      },
      rawCalls,
      metrics
    };
  }

  private static buildHeatmap(rawCalls: any[]): { hours: string[]; days: string[]; matrix: number[][] } {
    const hours = HOURS_SLOTS;
    const days = DAYS_EN;
    const matrix: number[][] = [];

    for (let d = 0; d < 7; d++) {
      const row: number[] = [];
      for (const hourStr of hours) {
        const hour = parseInt(hourStr);
        const count = rawCalls.filter(c => {
          const callDate = new Date(c.startTime);
          return callDate.getDay() === d && callDate.getHours() === hour;
        }).length;
        row.push(count);
      }
      matrix.push(row);
    }

    return { hours, days, matrix };
  }

  private static buildCallSlots(rawCalls: any[], metrics: MonthlyReportMetrics): MbrCallSlot[] {
    const slots = [
      { label: 'Matin (9h-12h)', start: 9, end: 12 },
      { label: 'Midi (12h-14h)', start: 12, end: 14 },
      { label: 'Après-midi (14h-18h)', start: 14, end: 18 },
      { label: 'Soir (18h-21h)', start: 18, end: 21 },
      { label: 'Hors horaires', start: null, end: null }
    ];

    return slots.map(slot => {
      let slotCalls: any[];
      if (slot.start === null) {
        slotCalls = rawCalls.filter(c => {
          const hour = new Date(c.startTime).getHours();
          return hour < 9 || hour >= 21;
        });
      } else {
        slotCalls = rawCalls.filter(c => {
          const hour = new Date(c.startTime).getHours();
          return hour >= slot.start! && hour < slot.end!;
        });
      }

      const converted = slotCalls.filter(c => 
        c.conversionResult === 'converted' || 
        c.callSuccessful || 
        c.appointmentDate !== null
      ).length;
      
      const withDuration = slotCalls.filter(c => c.duration && c.duration > 0);
      const avgDuration = withDuration.length > 0
        ? withDuration.reduce((sum, c) => sum + c.duration, 0) / withDuration.length
        : null;

      return {
        label: slot.label,
        calls: slotCalls.length,
        conversion_rate: slotCalls.length > 0 ? Math.round((converted / slotCalls.length) * 100 * 10) / 10 : null,
        avg_duration_sec: avgDuration ? Math.round(avgDuration) : null,
        avg_ticket_eur: null,
        computed: true
      };
    });
  }

  private static buildWeeklyTrend(rawCalls: any[], periodStart: Date, periodEnd: Date): MbrWeeklyTrend[] {
    const weeks: MbrWeeklyTrend[] = [];
    const current = new Date(periodStart);

    while (current <= periodEnd) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > periodEnd) weekEnd.setTime(periodEnd.getTime());

      const weekCalls = rawCalls.filter(c => {
        const callDate = new Date(c.createdAt);
        return callDate >= weekStart && callDate <= weekEnd;
      });

      const converted = weekCalls.filter(c => 
        c.conversionResult === 'converted' || 
        c.callSuccessful || 
        c.appointmentDate !== null
      ).length;
      const weekLabel = `S${this.getWeekNumber(weekStart)}`;

      weeks.push({
        week: weekLabel,
        calls: weekCalls.length,
        conversion_rate: weekCalls.length > 0 ? Math.round((converted / weekCalls.length) * 100 * 10) / 10 : null
      });

      current.setDate(current.getDate() + 7);
    }

    return weeks;
  }

  private static getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private static generateCallInsights(metrics: MonthlyReportMetrics, rawCalls: any[]): string[] {
    const insights: string[] = [];

    if (metrics.totalCalls === 0) {
      insights.push("Aucun appel enregistré ce mois.");
      return insights;
    }

    if (metrics.afterHoursCalls > 0) {
      insights.push(`${Math.round(metrics.afterHoursPercentage)}% des appels reçus hors horaires d'ouverture (${metrics.afterHoursCalls} appels).`);
    }

    const peakHour = metrics.peakHours.find(h => h.callCount > 0);
    if (peakHour) {
      insights.push(`Pic d'activité à ${peakHour.hour}h avec ${peakHour.callCount} appels.`);
    }

    if (metrics.appointmentConversionRate > 0) {
      insights.push(`${Math.round(metrics.appointmentConversionRate)}% des appels ont abouti à une réservation.`);
    }

    if (metrics.conversionRate > 70) {
      insights.push("Excellent taux de conversion des appels.");
    } else if (metrics.conversionRate < 30 && metrics.totalCalls > 5) {
      insights.push("Le taux de conversion pourrait être amélioré.");
    }

    return insights;
  }

  /**
   * Build reservations from calls with appointmentDate + guaranteeSessions for no-shows
   */
  private static async buildReservations(ctx: BuilderContext): Promise<ReservationsBuilderResult> {
    const callsWhereClause = ctx.tenantId
      ? and(
          eq(calls.tenantId, ctx.tenantId), 
          gte(calls.createdAt, ctx.periodStart), 
          lte(calls.createdAt, ctx.periodEnd)
        )
      : and(
          eq(calls.userId, ctx.userId), 
          gte(calls.createdAt, ctx.periodStart), 
          lte(calls.createdAt, ctx.periodEnd)
        );

    const guaranteeWhereClause = ctx.tenantId
      ? and(
          eq(guaranteeSessions.tenantId, ctx.tenantId), 
          gte(guaranteeSessions.createdAt, ctx.periodStart), 
          lte(guaranteeSessions.createdAt, ctx.periodEnd)
        )
      : and(
          eq(guaranteeSessions.userId, ctx.userId), 
          gte(guaranteeSessions.createdAt, ctx.periodStart), 
          lte(guaranteeSessions.createdAt, ctx.periodEnd)
        );

    const [allCalls, guaranteeSessionsData] = await Promise.all([
      db.select().from(calls).where(callsWhereClause),
      db.select().from(guaranteeSessions).where(guaranteeWhereClause)
    ]);

    const callsWithAppointment = allCalls.filter(c => c.appointmentDate !== null);

    const total = callsWithAppointment.length;
    const confirmed = callsWithAppointment.filter(c => 
      c.conversionResult === 'converted' || c.callSuccessful
    ).length;

    const afterHoursReservations = callsWithAppointment.filter(c => {
      const hour = new Date(c.startTime).getHours();
      return hour < BUSINESS_HOURS_START || hour >= BUSINESS_HOURS_END;
    }).length;

    const byPartySize = this.buildPartySizeFromCalls(callsWithAppointment, guaranteeSessionsData);
    const leadTimeDistribution = this.buildLeadTimeFromCalls(callsWithAppointment);
    const noShow = this.buildNoShowMetrics(guaranteeSessionsData, total);
    const partySizeVsNoShow = this.buildPartySizeVsNoShow(guaranteeSessionsData);
    const weeklyTrend = this.buildReservationWeeklyTrend(callsWithAppointment, guaranteeSessionsData, ctx.periodStart, ctx.periodEnd);

    return {
      reservations: {
        total,
        confirmed,
        after_hours: afterHoursReservations > 0 ? afterHoursReservations : null,
        by_party_size: byPartySize,
        lead_time_days_distribution: leadTimeDistribution,
        no_show: noShow,
        cross: { party_size_vs_no_show: partySizeVsNoShow },
        weekly_trend: weeklyTrend
      },
      callsWithAppointment,
      guaranteeSessionsData
    };
  }

  private static buildPartySizeFromCalls(callsWithAppointment: any[], guaranteeSessions: any[]): MbrPartySizeDistribution[] {
    const sizes = ['1', '2', '3-4', '5-6', '7+'];
    
    const partySizeData = [
      ...callsWithAppointment.map(c => c.partySize || c.numberOfGuests || 2),
      ...guaranteeSessions.map(g => g.partySize || 2)
    ];
    
    const total = partySizeData.length;

    return sizes.map(label => {
      let count: number;
      if (label === '1') {
        count = partySizeData.filter(ps => ps === 1).length;
      } else if (label === '2') {
        count = partySizeData.filter(ps => ps === 2).length;
      } else if (label === '3-4') {
        count = partySizeData.filter(ps => ps >= 3 && ps <= 4).length;
      } else if (label === '5-6') {
        count = partySizeData.filter(ps => ps >= 5 && ps <= 6).length;
      } else {
        count = partySizeData.filter(ps => ps >= 7).length;
      }

      return {
        label,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0
      };
    });
  }

  private static buildLeadTimeFromCalls(callsWithAppointment: any[]): MbrLeadTimeDistribution[] {
    const buckets = [
      { label: 'Même jour', min: 0, max: 0 },
      { label: '1-2 jours', min: 1, max: 2 },
      { label: '3-7 jours', min: 3, max: 7 },
      { label: '8+ jours', min: 8, max: 999 }
    ];

    const total = callsWithAppointment.length;

    return buckets.map(bucket => {
      const count = callsWithAppointment.filter(c => {
        if (!c.appointmentDate || !c.createdAt) return false;
        const leadDays = Math.floor((new Date(c.appointmentDate).getTime() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return leadDays >= bucket.min && leadDays <= bucket.max;
      }).length;

      return {
        label: bucket.label,
        percent: total > 0 ? Math.round((count / total) * 100) : 0
      };
    });
  }

  private static buildNoShowMetrics(guaranteeSessions: any[], totalReservations: number): MbrNoShow {
    const noShows = guaranteeSessions.filter(g => g.status === 'noshow' || g.status === 'charged');
    const count = noShows.length;
    
    const baseTotal = Math.max(totalReservations, guaranteeSessions.length);
    const rate = baseTotal > 0 ? (count / baseTotal) * 100 : null;

    const avoided = guaranteeSessions.filter(g => 
      g.status === 'card_valid' || g.status === 'confirmed'
    ).length;

    const riskFactors: string[] = [];
    if (rate && rate > 10) {
      riskFactors.push("Taux de no-show supérieur à 10%");
    }
    if (rate && rate > 5 && rate <= 10) {
      riskFactors.push("Taux de no-show modéré (5-10%)");
    }

    return {
      rate: rate !== null ? Math.round(rate * 10) / 10 : null,
      count,
      avoided_count: avoided > 0 ? avoided : null,
      risk_factors: riskFactors
    };
  }

  private static buildPartySizeVsNoShow(guaranteeSessions: any[]): MbrPartySizeVsNoShow[] {
    const sizes = ['1-2', '3-4', '5-6', '7+'];

    return sizes.map(size => {
      let filtered: any[];
      if (size === '1-2') {
        filtered = guaranteeSessions.filter(g => (g.partySize || 2) <= 2);
      } else if (size === '3-4') {
        filtered = guaranteeSessions.filter(g => (g.partySize || 2) >= 3 && (g.partySize || 2) <= 4);
      } else if (size === '5-6') {
        filtered = guaranteeSessions.filter(g => (g.partySize || 2) >= 5 && (g.partySize || 2) <= 6);
      } else {
        filtered = guaranteeSessions.filter(g => (g.partySize || 2) >= 7);
      }

      const noShows = filtered.filter(g => g.status === 'noshow' || g.status === 'charged').length;

      return {
        party_size: size,
        reservations: filtered.length,
        no_shows: noShows,
        rate: filtered.length > 0 ? Math.round((noShows / filtered.length) * 100 * 10) / 10 : null
      };
    });
  }

  private static buildReservationWeeklyTrend(
    callsWithAppointment: any[], 
    guaranteeSessions: any[],
    periodStart: Date, 
    periodEnd: Date
  ): MbrWeeklyTrend[] {
    const weeks: MbrWeeklyTrend[] = [];
    const current = new Date(periodStart);

    while (current <= periodEnd) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > periodEnd) weekEnd.setTime(periodEnd.getTime());

      const weekReservations = callsWithAppointment.filter(c => {
        const date = new Date(c.createdAt);
        return date >= weekStart && date <= weekEnd;
      });

      const weekGuarantees = guaranteeSessions.filter(g => {
        const date = new Date(g.createdAt);
        return date >= weekStart && date <= weekEnd;
      });

      const noShows = weekGuarantees.filter(g => g.status === 'noshow' || g.status === 'charged').length;
      const weekLabel = `S${this.getWeekNumber(weekStart)}`;

      weeks.push({
        week: weekLabel,
        reservations: weekReservations.length,
        no_shows: noShows > 0 ? noShows : null
      });

      current.setDate(current.getDate() + 7);
    }

    return weeks;
  }

  private static async buildReputation(ctx: BuilderContext): Promise<MbrReputation> {
    const whereClause = and(
      eq(reviews.userId, ctx.userId),
      gte(reviews.reviewDate, ctx.periodStart),
      lte(reviews.reviewDate, ctx.periodEnd)
    );

    const rawReviews = await db.select().from(reviews).where(whereClause);

    const newCount = rawReviews.length;
    const avgRating = newCount > 0
      ? rawReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / newCount
      : null;

    const ratingDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    rawReviews.forEach(r => {
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[String(r.rating)] = (ratingDistribution[String(r.rating)] || 0) + 1;
      }
    });

    const topKeywords = this.extractKeywords(rawReviews);
    const strengths = rawReviews.filter(r => r.rating >= 4).slice(0, 3).map(r => r.text?.substring(0, 100) || '').filter(Boolean);
    const improvements = rawReviews.filter(r => r.rating <= 2).slice(0, 3).map(r => r.text?.substring(0, 100) || '').filter(Boolean);

    const valuePerReview = 150;
    const annualValueEst = newCount > 0 ? newCount * valuePerReview * 12 : null;

    return {
      reviews: {
        new_count: newCount,
        avg_rating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        rating_distribution: ratingDistribution,
        top_keywords: topKeywords,
        strengths: strengths.length > 0 ? strengths : [],
        improvements: improvements.length > 0 ? improvements : []
      },
      impact_estimates: {
        visibility_uplift_percent: newCount >= 5 ? 15 : newCount > 0 ? 5 : null,
        new_customers_est: newCount > 0 ? Math.round(newCount * 0.3) : null,
        annual_value_est_eur: annualValueEst,
        value_per_review_eur: valuePerReview,
        computed: newCount > 0
      }
    };
  }

  private static extractKeywords(rawReviews: any[]): MbrReviewKeyword[] {
    const keywords: Record<string, { count: number; sentimentSum: number }> = {};

    rawReviews.forEach(review => {
      if (!review.text) return;
      const words = review.text.toLowerCase().split(/\s+/);
      const sentiment = (review.rating || 3) >= 4 ? 1 : (review.rating || 3) <= 2 ? -1 : 0;

      words.forEach(word => {
        if (word.length < 4) return;
        const clean = word.replace(/[^a-zàâäéèêëïîôùûüç]/gi, '');
        if (clean.length >= 4) {
          if (!keywords[clean]) {
            keywords[clean] = { count: 0, sentimentSum: 0 };
          }
          keywords[clean].count++;
          keywords[clean].sentimentSum += sentiment;
        }
      });
    });

    return Object.entries(keywords)
      .filter(([_, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([keyword, data]) => ({
        keyword,
        count: data.count,
        sentiment: data.sentimentSum > 0 ? 'positive' as const : data.sentimentSum < 0 ? 'negative' as const : 'neutral' as const
      }));
  }

  private static buildKpis(
    ctx: BuilderContext,
    callsData: CallsBuilderResult,
    reservationsData: ReservationsBuilderResult,
    reputationData: MbrReputation
  ): MbrKpis {
    const avgTicket = ctx.inputs.avg_ticket_eur || 45;
    const avgPartySize = ctx.inputs.avg_party_size || 2.5;
    const estimatedValue = reservationsData.reservations.confirmed * avgTicket * avgPartySize;

    return {
      calls_total: callsData.calls.total,
      reservations_total: reservationsData.reservations.total,
      estimated_value_eur: estimatedValue > 0 ? Math.round(estimatedValue) : null,
      reviews_avg_rating: reputationData.reviews.avg_rating,
      no_show_rate: reservationsData.reservations.no_show.rate,
      roi_x: null
    };
  }

  private static buildPerformanceScore(
    kpis: MbrKpis, 
    callsData: CallsBuilderResult, 
    reservationsData: ReservationsBuilderResult
  ): MbrPerformanceScore {
    const conversionRate = callsData.metrics.appointmentConversionRate;
    const loyaltyRate = callsData.metrics.returningClientPercentage || 50;
    const satisfaction = kpis.reviews_avg_rating ? (kpis.reviews_avg_rating / 5) * 100 : 50;
    const profitability = kpis.roi_x ? Math.min(kpis.roi_x * 10, 100) : 50;

    const global = Math.round((conversionRate * 0.3 + loyaltyRate * 0.2 + satisfaction * 0.3 + profitability * 0.2));
    
    let label: string;
    if (global >= 80) label = 'Excellent';
    else if (global >= 60) label = 'Bon';
    else if (global >= 40) label = 'Moyen';
    else label = 'À améliorer';

    const notes: string[] = [];
    if (conversionRate < 20) notes.push("Conversion des appels à améliorer");
    if (kpis.no_show_rate && kpis.no_show_rate > 10) notes.push("Taux de no-show élevé");

    return {
      global: global > 0 ? global : null,
      label: global > 0 ? label : null,
      radar: {
        conversion: Math.round(conversionRate),
        loyalty: Math.round(loyaltyRate),
        satisfaction: Math.round(satisfaction),
        profitability: Math.round(profitability)
      },
      notes
    };
  }

  private static buildFinance(
    ctx: BuilderContext, 
    callsData: CallsBuilderResult, 
    reservationsData: ReservationsBuilderResult
  ): MbrFinance {
    const inputs = ctx.inputs;
    const avgTicket = inputs.avg_ticket_eur || 45;
    const avgPartySize = inputs.avg_party_size || 2.5;
    const noShowValue = inputs.no_show_value_eur || 80;
    const hourlyAdminCost = inputs.hourly_admin_cost_eur || 20;
    const speedaiCost = inputs.speedai_monthly_cost_eur || 99;

    const confirmedReservations = reservationsData.reservations.confirmed;
    const directRevenue = confirmedReservations * avgTicket * avgPartySize;

    const afterHoursCount = reservationsData.reservations.after_hours || 0;
    const afterHoursValue = afterHoursCount * avgTicket * avgPartySize;

    const noShowsAvoided = reservationsData.reservations.no_show.avoided_count || 0;
    const noShowsSavedValue = noShowsAvoided * noShowValue;

    const adminTimeHours = callsData.metrics.timeSavedHours;
    const adminTimeSaved = adminTimeHours * hourlyAdminCost;

    const indirectValue = afterHoursValue + noShowsSavedValue;
    const totalValue = directRevenue + indirectValue + adminTimeSaved;
    const netBenefit = totalValue - speedaiCost;
    const roiX = speedaiCost > 0 ? Math.round((netBenefit / speedaiCost) * 10) / 10 : null;

    const notes: string[] = [];
    if (roiX && roiX > 5) notes.push("ROI excellent - SpeedAI génère une forte valeur");
    if (afterHoursCount > 0) notes.push(`${afterHoursCount} réservations hors horaires valorisées`);

    return {
      inputs,
      value_breakdown: {
        direct_revenue_eur: directRevenue > 0 ? Math.round(directRevenue) : null,
        missed_calls_recovered: { 
          count: null, 
          unit_value_eur: avgTicket * avgPartySize, 
          value_eur: null 
        },
        after_hours_reservations: { 
          count: afterHoursCount > 0 ? afterHoursCount : null, 
          unit_value_eur: avgTicket * avgPartySize, 
          value_eur: afterHoursValue > 0 ? Math.round(afterHoursValue) : null 
        },
        savings_eur: Math.round(adminTimeSaved + noShowsSavedValue),
        no_shows_avoided: { 
          count: noShowsAvoided > 0 ? noShowsAvoided : null, 
          unit_value_eur: noShowValue, 
          value_eur: noShowsSavedValue > 0 ? Math.round(noShowsSavedValue) : null 
        },
        admin_time_saved: { 
          hours: adminTimeHours > 0 ? Math.round(adminTimeHours * 10) / 10 : null, 
          unit_value_eur: hourlyAdminCost, 
          value_eur: adminTimeSaved > 0 ? Math.round(adminTimeSaved) : null 
        },
        indirect_value_eur: indirectValue > 0 ? Math.round(indirectValue) : null
      },
      total_value_eur: totalValue > 0 ? Math.round(totalValue) : null,
      net_benefit_eur: Math.round(netBenefit),
      roi_x: roiX,
      notes
    };
  }

  private static buildSummaryBullets(ctx: BuilderContext, mbr: MbrV1): MbrSummaryBullet[] {
    const netValue = mbr.finance.net_benefit_eur;
    const timeSaved = mbr.finance.value_breakdown.admin_time_saved.hours;
    const noShowsAvoided = mbr.reservations.no_show.avoided_count;
    const afterHoursRes = mbr.reservations.after_hours;
    const newReviews = mbr.reputation.reviews.new_count;

    return [
      { label: 'Valeur nette générée', value: netValue, unit: 'EUR', computed: netValue !== null, method: 'estimate' },
      { label: 'Temps téléphonique économisé', value: timeSaved, unit: 'hours', computed: timeSaved !== null, method: 'estimate' },
      { label: 'No-shows évités', value: noShowsAvoided, unit: 'count', computed: noShowsAvoided !== null, method: 'computed_or_null' },
      { label: 'Réservations hors horaires', value: afterHoursRes, unit: 'count', computed: afterHoursRes !== null, method: 'computed_or_null' },
      { label: 'Nouveaux avis Google', value: newReviews, unit: 'count', computed: newReviews !== null, method: 'computed_or_null' },
      { label: 'VIP à risque identifiés', value: null, unit: 'count', computed: false, method: 'optional_crm' }
    ];
  }

  private static buildAiInsights(
    callsData: CallsBuilderResult,
    reservationsData: ReservationsBuilderResult,
    reputationData: MbrReputation
  ): { enabled: boolean; discoveries: string[]; alerts: string[]; actions: string[] } {
    const discoveries: string[] = [];
    const alerts: string[] = [];
    const actions: string[] = [];

    const metrics = callsData.metrics;

    if (metrics.appointmentConversionRate > 30) {
      discoveries.push(`Excellent taux de conversion: ${Math.round(metrics.appointmentConversionRate)}% des appels convertis en réservations.`);
    }

    if (metrics.afterHoursPercentage > 20) {
      discoveries.push(`${Math.round(metrics.afterHoursPercentage)}% des appels reçus hors horaires - SpeedAI capture ces opportunités.`);
    }

    if (metrics.returningClientPercentage > 30) {
      discoveries.push(`Base fidèle: ${Math.round(metrics.returningClientPercentage)}% de clients réguliers.`);
    }

    const noShowRate = reservationsData.reservations.no_show.rate;
    if (noShowRate && noShowRate > 10) {
      alerts.push(`Taux de no-show élevé (${Math.round(noShowRate)}%) - Renforcer les confirmations SMS.`);
    }

    if (reputationData.reviews.avg_rating && reputationData.reviews.avg_rating < 4) {
      alerts.push(`Note moyenne en baisse (${reputationData.reviews.avg_rating}/5) - Points d'amélioration à identifier.`);
    }

    if (metrics.lastMinutePercentage > 30) {
      actions.push("Proposer des offres anticipées pour réduire les réservations de dernière minute.");
    }

    if (reservationsData.reservations.no_show.count && reservationsData.reservations.no_show.count > 0) {
      actions.push("Activer les rappels SMS 24h avant pour réduire les no-shows.");
    }

    if (reputationData.reviews.new_count && reputationData.reviews.new_count < 5) {
      actions.push("Augmenter les demandes d'avis automatiques après chaque visite.");
    }

    return {
      enabled: true,
      discoveries,
      alerts,
      actions
    };
  }

  private static buildForecast(
    callsData: CallsBuilderResult,
    reservationsData: ReservationsBuilderResult
  ): { 
    enabled: boolean; 
    next_month: { 
      ca_est_eur: number | null; 
      reasoning: string[]; 
      strong_week: string | null; 
      weak_week: string | null;
      risks: string[];
      opportunities: string[];
    }; 
    calendar_actions: string[] 
  } {
    const weeklyTrend = callsData.calls.weekly_trend;
    const avgCalls = weeklyTrend.length > 0 
      ? weeklyTrend.reduce((sum, w) => sum + (w.calls || 0), 0) / weeklyTrend.length 
      : 0;

    let strongWeek: string | null = null;
    let weakWeek: string | null = null;
    let maxCalls = 0;
    let minCalls = Infinity;

    weeklyTrend.forEach(w => {
      if ((w.calls || 0) > maxCalls) {
        maxCalls = w.calls || 0;
        strongWeek = w.week;
      }
      if ((w.calls || 0) < minCalls && (w.calls || 0) > 0) {
        minCalls = w.calls || 0;
        weakWeek = w.week;
      }
    });

    const reasoning: string[] = [];
    if (avgCalls > 0) {
      reasoning.push(`Volume moyen de ${Math.round(avgCalls)} appels/semaine observé.`);
    }

    const risks: string[] = [];
    const opportunities: string[] = [];

    if (callsData.metrics.afterHoursPercentage > 20) {
      opportunities.push("Fort potentiel hors horaires à exploiter.");
    }

    return {
      enabled: true,
      next_month: {
        ca_est_eur: null,
        reasoning,
        strong_week: strongWeek,
        weak_week: weakWeek,
        risks,
        opportunities
      },
      calendar_actions: []
    };
  }

  private static buildMeta(
    callsData: CallsBuilderResult,
    reservationsData: ReservationsBuilderResult,
    reputationData: MbrReputation
  ): MbrMeta {
    const callsCompleteness: DataCompleteness = callsData.calls.total > 0 ? 'ok' : 'missing';
    const reservationsCompleteness: DataCompleteness = reservationsData.reservations.total > 0 ? 'ok' : 'missing';
    const reviewsCompleteness: DataCompleteness = (reputationData.reviews.new_count || 0) > 0 ? 'ok' : 'missing';

    const warnings: string[] = [];
    if (callsCompleteness === 'missing') warnings.push("Aucune donnée d'appels pour cette période.");
    if (reservationsCompleteness === 'missing') warnings.push("Aucune réservation enregistrée pour cette période.");

    return {
      data_completeness: {
        calls: callsCompleteness,
        reservations: reservationsCompleteness,
        reviews: reviewsCompleteness,
        crm: 'missing',
        weather: 'missing'
      },
      warnings,
      formulas_version: 'mbr_formulas_v1.1'
    };
  }
}
