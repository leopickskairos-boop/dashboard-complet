import { db } from "./db";
import { calls } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

interface AIInsight {
  icon: string;
  type: 'performance' | 'business';
  text: string;
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
      const endHour = bestHour + 2;
      return {
        icon: 'chart',
        type: 'performance',
        text: `Les appels entre ${bestHour}h et ${endHour}h affichent le meilleur taux de conversion (+${Math.round(bestRate)} %).`,
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
      return {
        icon: 'calendar',
        type: 'business',
        text: `Le ${dayName} reste la journée la plus performante avec ${maxCompleted} rendez-vous confirmés.`,
      };
    }

    return null;
  }

  /**
   * Analyze optimal call duration
   */
  private async analyzeOptimalDuration(userCalls: any[]): Promise<AIInsight | null> {
    const completedCalls = userCalls.filter(c => c.status === 'completed' && c.duration);
    
    if (completedCalls.length === 0) return null;

    const avgDuration = completedCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / completedCalls.length;
    
    if (avgDuration > 0) {
      const minutes = Math.floor(avgDuration / 60);
      const seconds = Math.round(avgDuration % 60);
      return {
        icon: 'clock',
        type: 'performance',
        text: `Les appels d'environ ${minutes}min${seconds}s aboutissent le plus souvent à un rendez-vous.`,
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

    const afterHoursCompleted = afterHoursCalls.filter(c => c.status === 'completed').length;

    if (afterHoursCompleted > 0) {
      return {
        icon: 'moon',
        type: 'business',
        text: `Votre agent IA a converti ${afterHoursCompleted} appel${afterHoursCompleted > 1 ? 's' : ''} après 19h ce mois-ci.`,
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
    
    if (totalCalls === 0) return null;

    const conversionRate = (completedCalls / totalCalls) * 100;

    if (conversionRate > 30) {
      return {
        icon: 'trending-up',
        type: 'performance',
        text: `Excellent taux de conversion de ${Math.round(conversionRate)} % ce mois-ci, continuez ainsi !`,
      };
    } else if (conversionRate > 20) {
      return {
        icon: 'target',
        type: 'performance',
        text: `Taux de conversion stable à ${Math.round(conversionRate)} %, votre agent IA performe bien.`,
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
        text: "Votre agent IA est prêt à répondre 24/7 pour ne manquer aucune opportunité.",
      },
      {
        icon: 'chart',
        type: 'performance',
        text: "Les premiers appels arrivent bientôt. Votre dashboard affichera des statistiques détaillées.",
      },
      {
        icon: 'brain',
        type: 'business',
        text: "L'automatisation intelligente libère votre équipe pour des tâches à forte valeur ajoutée.",
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
        text: `Vous avez ${totalCalls} appel${totalCalls > 1 ? 's' : ''} enregistré${totalCalls > 1 ? 's' : ''}. Plus de données généreront des insights personnalisés.`,
      },
      {
        icon: 'brain',
        type: 'business',
        text: "Votre agent IA répond automatiquement 24/7, maximisant vos opportunités commerciales.",
      },
      {
        icon: 'lightbulb',
        type: 'performance',
        text: "L'automatisation intelligente économise du temps précieux pour votre équipe.",
      },
      {
        icon: 'calendar',
        type: 'business',
        text: "Continuez à enregistrer des appels pour découvrir vos créneaux les plus performants.",
      },
      {
        icon: 'target',
        type: 'performance',
        text: "Chaque appel enrichit l'analyse IA pour des recommandations plus précises.",
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
