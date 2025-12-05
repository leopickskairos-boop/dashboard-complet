import { db } from "./db";
import { calls, guaranteeSessions, noshowCharges } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

interface AIInsight {
  icon: string;
  type: 'performance' | 'business';
  text: string;
  level?: 'good' | 'average' | 'warning';
}

interface GuaranteeStats {
  totalSessions: number;
  validated: number;
  completed: number;
  noShowCharged: number;
  noShowFailed: number;
  cancelled: number;
  pending: number;
  totalRecovered: number; // in cents
  totalFailed: number; // failed charge amount in cents
}

export class AIInsightsService {
  /**
   * Generate personalized AI insights based on real call data and guarantee data
   */
  async generateInsights(userId: string, timeFilter?: 'hour' | 'today' | 'two_days' | 'week'): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];
    
    // Get time filter date
    const timeDate = this.getTimeFilterDate(timeFilter);
    const conditions = [eq(calls.userId, userId)];
    if (timeDate) {
      conditions.push(gte(calls.startTime, timeDate));
    }

    // Fetch all calls for analysis
    const userCalls = await db
      .select()
      .from(calls)
      .where(and(...conditions))
      .orderBy(desc(calls.startTime));

    // Fetch guarantee data
    const guaranteeStats = await this.getGuaranteeStats(userId, timeDate);

    // If no data at all, return defaults
    if (userCalls.length === 0 && guaranteeStats.totalSessions === 0) {
      return this.getDefaultInsights();
    }

    // Priority 1: Guarantee insights (if user has guarantee data)
    if (guaranteeStats.totalSessions > 0) {
      // No-show rate analysis
      const noShowInsight = this.analyzeNoShowRate(guaranteeStats);
      if (noShowInsight) insights.push(noShowInsight);

      // Revenue recovered analysis
      const revenueInsight = this.analyzeRecoveredRevenue(guaranteeStats);
      if (revenueInsight) insights.push(revenueInsight);

      // Guarantee validation rate
      const validationInsight = this.analyzeGuaranteeValidation(guaranteeStats);
      if (validationInsight) insights.push(validationInsight);
    }

    // Priority 2: Call-based insights (if we need more)
    if (insights.length < 3 && userCalls.length > 0) {
      // Analyze best performing hours
      const hourlyInsight = await this.analyzeBestHours(userCalls);
      if (hourlyInsight && insights.length < 3) insights.push(hourlyInsight);

      // Analyze best performing days
      const dayInsight = await this.analyzeBestDays(userCalls);
      if (dayInsight && insights.length < 3) insights.push(dayInsight);

      // Analyze optimal call duration
      const durationInsight = await this.analyzeOptimalDuration(userCalls);
      if (durationInsight && insights.length < 3) insights.push(durationInsight);

      // Analyze after-hours performance
      const afterHoursInsight = await this.analyzeAfterHours(userCalls);
      if (afterHoursInsight && insights.length < 3) insights.push(afterHoursInsight);

      // Analyze conversion trends
      const conversionInsight = await this.analyzeConversionTrends(userCalls);
      if (conversionInsight && insights.length < 3) insights.push(conversionInsight);
    }

    // Priority 3: Additional guarantee insights if we have data
    if (insights.length < 3 && guaranteeStats.totalSessions >= 3) {
      const reliabilityInsight = this.analyzeCustomerReliability(guaranteeStats);
      if (reliabilityInsight && insights.length < 3) insights.push(reliabilityInsight);
    }

    // Ensure we always return exactly 3 insights
    if (insights.length < 3) {
      const supplementalInsights = this.getSupplementalInsights(userCalls.length, guaranteeStats);
      insights.push(...supplementalInsights);
    }

    // Return exactly 3 insights
    return insights.slice(0, 3);
  }

  /**
   * Get guarantee statistics for a user
   */
  private async getGuaranteeStats(userId: string, timeDate: Date | null): Promise<GuaranteeStats> {
    const conditions = [eq(guaranteeSessions.userId, userId)];
    if (timeDate) {
      // Use reservationDate for filtering - more relevant for business insights
      conditions.push(gte(guaranteeSessions.reservationDate, timeDate));
    }

    // Fetch all sessions
    const sessions = await db
      .select()
      .from(guaranteeSessions)
      .where(and(...conditions));

    // Count by status
    const stats: GuaranteeStats = {
      totalSessions: sessions.length,
      validated: sessions.filter(s => s.status === 'validated').length,
      completed: sessions.filter(s => s.status === 'completed').length,
      noShowCharged: sessions.filter(s => s.status === 'noshow_charged').length,
      noShowFailed: sessions.filter(s => s.status === 'noshow_failed').length,
      cancelled: sessions.filter(s => s.status === 'cancelled').length,
      pending: sessions.filter(s => s.status === 'pending').length,
      totalRecovered: 0,
      totalFailed: 0,
    };

    // Get noshow charges for revenue calculation - use chargedAmount from sessions directly
    // This ensures we only count amounts from sessions in the filtered time window
    stats.totalRecovered = sessions
      .filter(s => s.status === 'noshow_charged' && s.chargedAmount)
      .reduce((sum, s) => sum + (s.chargedAmount || 0), 0);

    // For failed charges, fetch from noshowCharges table (only for sessions in window)
    if (stats.noShowFailed > 0) {
      const failedSessionIds = sessions
        .filter(s => s.status === 'noshow_failed')
        .map(s => s.id);

      if (failedSessionIds.length > 0) {
        const failedCharges = await db
          .select()
          .from(noshowCharges)
          .where(eq(noshowCharges.userId, userId));

        stats.totalFailed = failedCharges
          .filter(c => c.status === 'failed' && failedSessionIds.includes(c.guaranteeSessionId))
          .reduce((sum, c) => sum + c.amount, 0);
      }
    }

    return stats;
  }

  /**
   * Analyze no-show rate from guarantee data
   */
  private analyzeNoShowRate(stats: GuaranteeStats): AIInsight | null {
    const confirmedReservations = stats.completed + stats.noShowCharged + stats.noShowFailed;
    if (confirmedReservations === 0) return null;

    const noShowCount = stats.noShowCharged + stats.noShowFailed;
    const noShowRate = (noShowCount / confirmedReservations) * 100;

    if (noShowRate === 0) {
      return {
        icon: 'shield-check',
        type: 'business',
        text: `Aucun no-show sur ${confirmedReservations} réservation${confirmedReservations > 1 ? 's' : ''} garantie${confirmedReservations > 1 ? 's' : ''}. La garantie CB a un effet dissuasif excellent.`,
        level: 'good',
      };
    } else if (noShowRate <= 5) {
      return {
        icon: 'shield-check',
        type: 'business',
        text: `Taux de no-show : ${noShowRate.toFixed(1)}% (${noShowCount}/${confirmedReservations}). Performance excellente grâce à la garantie CB.`,
        level: 'good',
      };
    } else if (noShowRate <= 15) {
      return {
        icon: 'shield',
        type: 'business',
        text: `Taux de no-show : ${noShowRate.toFixed(1)}% (${noShowCount}/${confirmedReservations}). Envisagez d'augmenter le montant de la pénalité.`,
        level: 'average',
      };
    } else {
      return {
        icon: 'shield-alert',
        type: 'business',
        text: `Taux de no-show élevé : ${noShowRate.toFixed(1)}% (${noShowCount}/${confirmedReservations}). Augmentez la pénalité ou activez les rappels SMS.`,
        level: 'warning',
      };
    }
  }

  /**
   * Analyze revenue recovered from no-show penalties
   */
  private analyzeRecoveredRevenue(stats: GuaranteeStats): AIInsight | null {
    if (stats.noShowCharged === 0 && stats.noShowFailed === 0) return null;

    const recoveredEuros = stats.totalRecovered / 100;
    const failedEuros = stats.totalFailed / 100;
    const totalAttempted = recoveredEuros + failedEuros;

    if (stats.totalRecovered > 0 && stats.totalFailed === 0) {
      return {
        icon: 'euro',
        type: 'business',
        text: `${recoveredEuros.toFixed(0)}€ récupérés en pénalités no-show. 100% des débits réussis (${stats.noShowCharged} no-show${stats.noShowCharged > 1 ? 's' : ''}).`,
        level: 'good',
      };
    } else if (stats.totalRecovered > 0) {
      const successRate = (stats.totalRecovered / (stats.totalRecovered + stats.totalFailed)) * 100;
      return {
        icon: 'euro',
        type: 'business',
        text: `${recoveredEuros.toFixed(0)}€ récupérés sur ${totalAttempted.toFixed(0)}€ de no-shows (${successRate.toFixed(0)}% de réussite). ${failedEuros.toFixed(0)}€ en échec de paiement.`,
        level: successRate >= 80 ? 'good' : successRate >= 50 ? 'average' : 'warning',
      };
    } else {
      return {
        icon: 'euro',
        type: 'business',
        text: `${stats.noShowFailed} no-show${stats.noShowFailed > 1 ? 's' : ''} avec échec de débit (${failedEuros.toFixed(0)}€). Vérifiez les cartes expirées ou fonds insuffisants.`,
        level: 'warning',
      };
    }
  }

  /**
   * Analyze guarantee validation rate
   */
  private analyzeGuaranteeValidation(stats: GuaranteeStats): AIInsight | null {
    if (stats.totalSessions < 3) return null;

    const sentSessions = stats.totalSessions - stats.cancelled;
    const validatedSessions = stats.validated + stats.completed + stats.noShowCharged + stats.noShowFailed;
    
    if (sentSessions === 0) return null;
    
    const validationRate = (validatedSessions / sentSessions) * 100;
    const pendingRate = (stats.pending / sentSessions) * 100;

    if (validationRate >= 90) {
      return {
        icon: 'check-circle',
        type: 'performance',
        text: `${validationRate.toFixed(0)}% des garanties validées (${validatedSessions}/${sentSessions}). Vos clients acceptent bien le système.`,
        level: 'good',
      };
    } else if (validationRate >= 70) {
      return {
        icon: 'check-circle',
        type: 'performance',
        text: `Taux de validation : ${validationRate.toFixed(0)}%. ${stats.pending} en attente. Activez les relances automatiques.`,
        level: 'average',
      };
    } else {
      return {
        icon: 'alert-circle',
        type: 'performance',
        text: `Seulement ${validationRate.toFixed(0)}% de garanties validées. ${pendingRate.toFixed(0)}% en attente. Revoyez le message d'envoi ou le montant.`,
        level: 'warning',
      };
    }
  }

  /**
   * Analyze customer reliability patterns
   */
  private analyzeCustomerReliability(stats: GuaranteeStats): AIInsight | null {
    const totalOutcomes = stats.completed + stats.noShowCharged + stats.noShowFailed;
    if (totalOutcomes < 5) return null;

    const attendanceRate = (stats.completed / totalOutcomes) * 100;

    if (attendanceRate >= 95) {
      return {
        icon: 'users',
        type: 'business',
        text: `${attendanceRate.toFixed(0)}% de clients présents après validation CB. La garantie filtre efficacement les réservations sérieuses.`,
        level: 'good',
      };
    } else if (attendanceRate >= 85) {
      return {
        icon: 'users',
        type: 'business',
        text: `Fiabilité client : ${attendanceRate.toFixed(0)}%. Les pénalités compensent les ${(100 - attendanceRate).toFixed(0)}% d'absences.`,
        level: 'average',
      };
    } else {
      return {
        icon: 'user-x',
        type: 'business',
        text: `${(100 - attendanceRate).toFixed(0)}% d'absences malgré la garantie. Considérez un montant plus dissuasif ou un dépôt immédiat.`,
        level: 'warning',
      };
    }
  }

  /**
   * Analyze best performing hours
   */
  private async analyzeBestHours(userCalls: any[]): Promise<AIInsight | null> {
    const hourlyStats: { [hour: number]: { total: number; completed: number } } = {};

    userCalls.forEach(call => {
      const hour = new Date(call.startTime).getHours();
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { total: 0, completed: 0 };
      }
      hourlyStats[hour].total++;
      if (call.status === 'completed') {
        hourlyStats[hour].completed++;
      }
    });

    // Find hour with best conversion rate (minimum 3 calls)
    let bestHour = -1;
    let bestRate = 0;
    
    Object.entries(hourlyStats).forEach(([hour, stats]) => {
      if (stats.total >= 3) {
        const rate = (stats.completed / stats.total) * 100;
        if (rate > bestRate) {
          bestRate = rate;
          bestHour = parseInt(hour);
        }
      }
    });

    if (bestHour !== -1 && bestRate > 0) {
      const completedInHour = hourlyStats[bestHour].completed;
      const totalCompleted = userCalls.filter(c => c.status === 'completed').length;
      const percentOfTotal = totalCompleted > 0 ? Math.round((completedInHour / totalCompleted) * 100) : 0;
      
      let timeLabel: string;
      if (bestHour >= 22) {
        timeLabel = "tard le soir (après 22h)";
      } else if (bestHour >= 19) {
        timeLabel = `en fin de journée (${bestHour}h-${Math.min(bestHour + 2, 23)}h)`;
      } else {
        const endHour = Math.min(bestHour + 2, 23);
        timeLabel = `entre ${bestHour}h et ${endHour}h`;
      }
      
      return {
        icon: 'chart',
        type: 'performance',
        text: `${percentOfTotal}% des RDV confirmés ont lieu ${timeLabel}. Concentrez vos efforts marketing sur ce créneau.`,
        level: percentOfTotal >= 40 ? 'good' : percentOfTotal >= 20 ? 'average' : 'warning',
      };
    }

    return null;
  }

  /**
   * Analyze best performing days
   */
  private async analyzeBestDays(userCalls: any[]): Promise<AIInsight | null> {
    const daysOfWeek = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const dailyStats: { [day: number]: { total: number; completed: number } } = {};

    userCalls.forEach(call => {
      const day = new Date(call.startTime).getDay();
      if (!dailyStats[day]) {
        dailyStats[day] = { total: 0, completed: 0 };
      }
      dailyStats[day].total++;
      if (call.status === 'completed') {
        dailyStats[day].completed++;
      }
    });

    // Find day with most appointments
    let bestDay = -1;
    let maxCompleted = 0;
    
    Object.entries(dailyStats).forEach(([day, stats]) => {
      if (stats.completed > maxCompleted) {
        maxCompleted = stats.completed;
        bestDay = parseInt(day);
      }
    });

    if (bestDay !== -1 && maxCompleted > 0) {
      const dayName = daysOfWeek[bestDay];
      const totalCompleted = userCalls.filter(c => c.status === 'completed').length;
      const percentOfTotal = totalCompleted > 0 ? Math.round((maxCompleted / totalCompleted) * 100) : 0;
      
      // Find worst day for comparison
      let worstDay = -1;
      let minCompleted = Infinity;
      Object.entries(dailyStats).forEach(([day, stats]) => {
        if (stats.total >= 2 && stats.completed < minCompleted) {
          minCompleted = stats.completed;
          worstDay = parseInt(day);
        }
      });
      
      let worstDayInfo = "";
      if (worstDay !== -1 && worstDay !== bestDay && minCompleted === 0) {
        worstDayInfo = ` Aucun RDV confirmé le ${daysOfWeek[worstDay]}.`;
      }
      
      return {
        icon: 'calendar',
        type: 'business',
        text: `${percentOfTotal}% des RDV sont pris le ${dayName} (${maxCompleted} confirmations).${worstDayInfo}`,
        level: percentOfTotal >= 30 ? 'good' : percentOfTotal >= 15 ? 'average' : 'warning',
      };
    }

    return null;
  }

  /**
   * Analyze optimal call duration
   */
  private async analyzeOptimalDuration(userCalls: any[]): Promise<AIInsight | null> {
    const completedCalls = userCalls.filter(c => c.status === 'completed' && c.duration);
    const failedCalls = userCalls.filter(c => c.status === 'failed' && c.duration);
    
    if (completedCalls.length === 0) return null;

    const avgCompletedDuration = completedCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / completedCalls.length;
    const avgFailedDuration = failedCalls.length > 0 
      ? failedCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / failedCalls.length 
      : 0;
    
    if (avgCompletedDuration > 0) {
      const minutes = Math.floor(avgCompletedDuration / 60);
      const seconds = Math.round(avgCompletedDuration % 60);
      
      let comparison = "";
      if (avgFailedDuration > 0 && avgCompletedDuration > avgFailedDuration) {
        const diffPercent = Math.round(((avgCompletedDuration - avgFailedDuration) / avgFailedDuration) * 100);
        comparison = ` (+${diffPercent}% vs appels échoués).`;
      }
      
      return {
        icon: 'clock',
        type: 'performance',
        text: `Durée moyenne des RDV confirmés : ${minutes}min ${seconds}s${comparison}`,
        level: 'average',
      };
    }

    return null;
  }

  /**
   * Analyze after-hours performance (19h-8h)
   */
  private async analyzeAfterHours(userCalls: any[]): Promise<AIInsight | null> {
    const afterHoursCalls = userCalls.filter(call => {
      const hour = new Date(call.startTime).getHours();
      return hour >= 19 || hour < 8;
    });
    
    const totalCalls = userCalls.length;
    const afterHoursCompleted = afterHoursCalls.filter(c => c.status === 'completed').length;
    const afterHoursTotal = afterHoursCalls.length;
    
    if (afterHoursTotal === 0 && totalCalls > 5) {
      return {
        icon: 'moon',
        type: 'business',
        text: `Aucun appel reçu après 19h sur les ${totalCalls} appels. Potentiel inexploité en soirée.`,
        level: 'warning',
      };
    }

    if (afterHoursCompleted > 0) {
      const percentOfAfterHours = Math.round((afterHoursCompleted / afterHoursTotal) * 100);
      const totalCompleted = userCalls.filter(c => c.status === 'completed').length;
      const percentOfTotal = totalCompleted > 0 ? Math.round((afterHoursCompleted / totalCompleted) * 100) : 0;
      
      return {
        icon: 'moon',
        type: 'business',
        text: `${afterHoursCompleted} RDV pris en soirée (après 19h), soit ${percentOfTotal}% du total. Taux de conversion soirée : ${percentOfAfterHours}%.`,
        level: percentOfAfterHours >= 30 ? 'good' : percentOfAfterHours >= 15 ? 'average' : 'warning',
      };
    } else if (afterHoursTotal > 0) {
      return {
        icon: 'moon',
        type: 'business',
        text: `${afterHoursTotal} appel${afterHoursTotal > 1 ? 's' : ''} reçu${afterHoursTotal > 1 ? 's' : ''} après 19h, aucun converti. Script à optimiser pour les appels tardifs.`,
        level: 'warning',
      };
    }

    return null;
  }

  /**
   * Analyze conversion trends
   */
  private async analyzeConversionTrends(userCalls: any[]): Promise<AIInsight | null> {
    const totalCalls = userCalls.length;
    const completedCalls = userCalls.filter(c => c.status === 'completed').length;
    const failedCalls = userCalls.filter(c => c.status === 'failed').length;
    
    if (totalCalls === 0) return null;

    const conversionRate = (completedCalls / totalCalls) * 100;
    const failureRate = (failedCalls / totalCalls) * 100;

    if (conversionRate > 40) {
      return {
        icon: 'trending-up',
        type: 'performance',
        text: `Taux de RDV confirmés : ${Math.round(conversionRate)}% (${completedCalls}/${totalCalls} appels). Performance excellente.`,
        level: 'good',
      };
    } else if (conversionRate > 25) {
      return {
        icon: 'target',
        type: 'performance',
        text: `Taux de conversion : ${Math.round(conversionRate)}% (${completedCalls} RDV sur ${totalCalls} appels). Dans la moyenne du secteur.`,
        level: 'average',
      };
    } else if (failureRate > 30) {
      return {
        icon: 'target',
        type: 'performance',
        text: `${Math.round(failureRate)}% d'appels échoués (${failedCalls}/${totalCalls}). Revoyez le script ou les créneaux horaires.`,
        level: 'warning',
      };
    }

    return null;
  }

  /**
   * Get default insights for new users with no data
   */
  private getDefaultInsights(): AIInsight[] {
    return [
      {
        icon: 'lightbulb',
        type: 'business',
        text: "En attente de données d'appels. Les premiers insights apparaîtront après vos 5 premiers appels.",
        level: 'average',
      },
      {
        icon: 'chart',
        type: 'performance',
        text: "L'analyse des créneaux horaires sera disponible après 10 appels minimum.",
        level: 'average',
      },
      {
        icon: 'calendar',
        type: 'business',
        text: "Les tendances hebdomadaires seront calculées à partir de 7 jours d'activité.",
        level: 'average',
      },
    ];
  }

  /**
   * Get supplemental insights to fill gaps when not enough data-driven insights
   */
  private getSupplementalInsights(totalCalls: number, guaranteeStats?: GuaranteeStats): AIInsight[] {
    const supplemental: AIInsight[] = [];

    // Guarantee-related supplemental insights
    if (guaranteeStats && guaranteeStats.totalSessions > 0) {
      if (guaranteeStats.totalSessions < 3) {
        supplemental.push({
          icon: 'shield',
          type: 'business',
          text: `${guaranteeStats.totalSessions} garantie${guaranteeStats.totalSessions > 1 ? 's' : ''} CB envoyée${guaranteeStats.totalSessions > 1 ? 's' : ''}. Encore ${3 - guaranteeStats.totalSessions} pour débloquer l'analyse de fiabilité.`,
          level: 'average',
        });
      }
      if (guaranteeStats.pending > 0) {
        supplemental.push({
          icon: 'clock',
          type: 'performance',
          text: `${guaranteeStats.pending} garantie${guaranteeStats.pending > 1 ? 's' : ''} en attente de validation. Envoyez une relance pour améliorer le taux.`,
          level: 'average',
        });
      }
    } else if (guaranteeStats && guaranteeStats.totalSessions === 0 && totalCalls > 5) {
      supplemental.push({
        icon: 'shield',
        type: 'business',
        text: `Activez la garantie CB pour réduire les no-shows. Moyenne du secteur : -60% d'absences.`,
        level: 'average',
      });
    }

    // Call-related supplemental insights
    if (totalCalls > 0) {
      supplemental.push({
        icon: 'trending-up',
        type: 'business',
        text: `${totalCalls} appel${totalCalls > 1 ? 's' : ''} analysé${totalCalls > 1 ? 's' : ''}. Encore ${Math.max(0, 10 - totalCalls)} appels pour débloquer l'analyse des créneaux horaires.`,
        level: 'average',
      });
      supplemental.push({
        icon: 'calendar',
        type: 'business',
        text: `Besoin de ${Math.max(0, 5 - totalCalls)} appels supplémentaires pour identifier vos jours les plus performants.`,
        level: 'average',
      });
    }

    supplemental.push({
      icon: 'chart',
      type: 'performance',
      text: "Analyse du taux de conversion disponible après 3 appels avec différents statuts.",
      level: 'average',
    });
    supplemental.push({
      icon: 'clock',
      type: 'performance',
      text: "L'analyse de durée optimale nécessite au moins 3 RDV confirmés.",
      level: 'average',
    });
    supplemental.push({
      icon: 'target',
      type: 'business',
      text: "Les recommandations de plages horaires seront disponibles après une semaine d'activité.",
      level: 'average',
    });

    return supplemental;
  }

  /**
   * Get time filter date
   */
  private getTimeFilterDate(timeFilter?: 'hour' | 'today' | 'two_days' | 'week'): Date | null {
    if (!timeFilter) return null;
    
    const now = new Date();
    
    switch (timeFilter) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'today':
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        return today;
      case 'two_days':
        return new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }
}

export const aiInsightsService = new AIInsightsService();
