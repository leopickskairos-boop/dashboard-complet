/**
 * Shared utilities for call analytics and AI insights
 * Used by both AIInsightsService and AIAnalyticsService
 */

export interface TimePeriod {
  start: Date;
  end: Date;
}

export type TimeFilter = 'hour' | 'today' | 'two_days' | 'week';

/**
 * Get the start date for a time filter
 */
export function getTimeFilterDate(timeFilter?: TimeFilter): Date | null {
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

/**
 * Get the previous period (same duration) for comparison
 */
export function getPreviousPeriod(timeFilter?: TimeFilter): TimePeriod | null {
  if (!timeFilter) return null;

  const now = new Date();
  
  switch (timeFilter) {
    case 'hour': {
      const end = new Date(now.getTime() - 60 * 60 * 1000);
      const start = new Date(end.getTime() - 60 * 60 * 1000);
      return { start, end };
    }
    case 'today': {
      const end = new Date(now);
      end.setHours(0, 0, 0, 0);
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      return { start, end };
    }
    case 'two_days': {
      const end = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 2 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    case 'week': {
      const end = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end };
    }
    default:
      return null;
  }
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}min ${secs}s`;
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Aggregate calls by hour
 */
export function aggregateCallsByHour(calls: any[]): {
  [hour: number]: { total: number; completed: number; failed: number };
} {
  const hourlyStats: {
    [hour: number]: { total: number; completed: number; failed: number };
  } = {};

  calls.forEach(call => {
    const hour = new Date(call.startTime).getHours();
    if (!hourlyStats[hour]) {
      hourlyStats[hour] = { total: 0, completed: 0, failed: 0 };
    }
    hourlyStats[hour].total++;
    if (call.status === 'completed') {
      hourlyStats[hour].completed++;
    } else if (call.status === 'failed') {
      hourlyStats[hour].failed++;
    }
  });

  return hourlyStats;
}

/**
 * Aggregate calls by day of week
 */
export function aggregateCallsByDay(calls: any[]): {
  [day: number]: { total: number; completed: number; failed: number };
} {
  const dailyStats: {
    [day: number]: { total: number; completed: number; failed: number };
  } = {};

  calls.forEach(call => {
    const day = new Date(call.startTime).getDay();
    if (!dailyStats[day]) {
      dailyStats[day] = { total: 0, completed: 0, failed: 0 };
    }
    dailyStats[day].total++;
    if (call.status === 'completed') {
      dailyStats[day].completed++;
    } else if (call.status === 'failed') {
      dailyStats[day].failed++;
    }
  });

  return dailyStats;
}

/**
 * Aggregate calls by time slot
 */
export function aggregateCallsByTimeSlot(calls: any[]): {
  [slot: string]: { total: number; completed: number; failed: number };
} {
  const timeSlotStats: {
    [slot: string]: { total: number; completed: number; failed: number };
  } = {
    'Matin (8h-12h)': { total: 0, completed: 0, failed: 0 },
    'Après-midi (12h-17h)': { total: 0, completed: 0, failed: 0 },
    'Soir (17h-19h)': { total: 0, completed: 0, failed: 0 },
    'Nuit (19h-8h)': { total: 0, completed: 0, failed: 0 }
  };

  calls.forEach(call => {
    const hour = new Date(call.startTime).getHours();
    let slot = 'Nuit (19h-8h)';
    if (hour >= 8 && hour < 12) slot = 'Matin (8h-12h)';
    else if (hour >= 12 && hour < 17) slot = 'Après-midi (12h-17h)';
    else if (hour >= 17 && hour < 19) slot = 'Soir (17h-19h)';

    timeSlotStats[slot].total++;
    if (call.status === 'completed') timeSlotStats[slot].completed++;
    if (call.status === 'failed') timeSlotStats[slot].failed++;
  });

  return timeSlotStats;
}

/**
 * Calculate average duration for calls
 */
export function calculateAverageDuration(calls: any[]): number {
  const callsWithDuration = calls.filter(c => c.duration && c.duration > 0);
  if (callsWithDuration.length === 0) return 0;
  
  return callsWithDuration.reduce((sum, call) => sum + call.duration!, 0) / callsWithDuration.length;
}

/**
 * Find peak hour (hour with most calls)
 */
export function findPeakHour(calls: any[]): { hour: number; count: number } | null {
  const hourlyDistribution: { [hour: number]: number } = {};
  
  calls.forEach(call => {
    const hour = new Date(call.startTime).getHours();
    hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
  });

  let peakHour = -1;
  let peakCount = 0;
  
  Object.entries(hourlyDistribution).forEach(([hour, count]) => {
    if (count > peakCount) {
      peakCount = count;
      peakHour = parseInt(hour);
    }
  });

  return peakHour !== -1 ? { hour: peakHour, count: peakCount } : null;
}

/**
 * Find best performing hour (highest conversion rate, minimum calls threshold)
 */
export function findBestPerformingHour(calls: any[], minCalls: number = 3): { hour: number; rate: number } | null {
  const hourlyStats = aggregateCallsByHour(calls);
  
  let bestHour = -1;
  let bestRate = 0;
  
  Object.entries(hourlyStats).forEach(([hour, stats]) => {
    if (stats.total >= minCalls) {
      const rate = (stats.completed / stats.total) * 100;
      if (rate > bestRate) {
        bestRate = rate;
        bestHour = parseInt(hour);
      }
    }
  });

  return bestHour !== -1 ? { hour: bestHour, rate: bestRate } : null;
}

/**
 * Day names in French
 */
export const DAYS_OF_WEEK = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
