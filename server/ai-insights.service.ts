import { db } from "./db";
import { calls } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

interface AIInsight {
  icon: string;
  type: 'performance' | 'business';
  text: string;
  level?: 'good' | 'average' | 'warning';
}

export class AIInsightsService {
  /**
   * Generate personalized AI insights based on real call data
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

    if (userCalls.length === 0) {
      // Return default encouraging insights for new users
      return this.getDefaultInsights();
    }

    // Analyze best performing hours
    const hourlyInsight = await this.analyzeBestHours(userCalls);
    if (hourlyInsight) insights.push(hourlyInsight);

    // Analyze best performing days
    const dayInsight = await this.analyzeBestDays(userCalls);
    if (dayInsight) insights.push(dayInsight);

    // Analyze optimal call duration
    const durationInsight = await this.analyzeOptimalDuration(userCalls);
    if (durationInsight) insights.push(durationInsight);

    // Analyze after-hours performance
    const afterHoursInsight = await this.analyzeAfterHours(userCalls);
    if (afterHoursInsight) insights.push(afterHoursInsight);

    // Analyze conversion trends
    const conversionInsight = await this.analyzeConversionTrends(userCalls);
    if (conversionInsight) insights.push(conversionInsight);

    // Ensure we always return exactly 3 insights
    // If we have fewer than 3, supplement with default business insights
    if (insights.length < 3) {
      const supplementalInsights = this.getSupplementalInsights(userCalls.length);
      insights.push(...supplementalInsights);
    }

    // Return exactly 3 insights
    return insights.slice(0, 3);
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
      },
      {
        icon: 'chart',
        type: 'performance',
        text: "L'analyse des créneaux horaires sera disponible après 10 appels minimum.",
      },
      {
        icon: 'calendar',
        type: 'business',
        text: "Les tendances hebdomadaires seront calculées à partir de 7 jours d'activité.",
      },
    ];
  }

  /**
   * Get supplemental insights to fill gaps when not enough data-driven insights
   */
  private getSupplementalInsights(totalCalls: number): AIInsight[] {
    const supplemental: AIInsight[] = [
      {
        icon: 'trending-up',
        type: 'business',
        text: `${totalCalls} appel${totalCalls > 1 ? 's' : ''} analysé${totalCalls > 1 ? 's' : ''}. Encore ${Math.max(0, 10 - totalCalls)} appels pour débloquer l'analyse des créneaux horaires.`,
      },
      {
        icon: 'calendar',
        type: 'business',
        text: `Besoin de ${Math.max(0, 5 - totalCalls)} appels supplémentaires pour identifier vos jours les plus performants.`,
      },
      {
        icon: 'chart',
        type: 'performance',
        text: "Analyse du taux de conversion disponible après 3 appels avec différents statuts.",
      },
      {
        icon: 'clock',
        type: 'performance',
        text: "L'analyse de durée optimale nécessite au moins 3 RDV confirmés.",
      },
      {
        icon: 'target',
        type: 'business',
        text: "Les recommandations de plages horaires seront disponibles après une semaine d'activité.",
      },
    ];

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
