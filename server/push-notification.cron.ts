// SpeedAI Push Notification Cron Jobs
import * as cron from 'node-cron';
import { storage } from './storage';
import { pushNotificationService } from './push-notification.service';
import { db } from './db';
import { calls } from '@shared/schema';
import { eq, and, gte, lt, count } from 'drizzle-orm';

// Helper to get yesterday's date range (00:00:00 to 23:59:59)
function getYesterdayRange(): { start: Date; end: Date } {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const start = new Date(yesterday);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(yesterday);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

// Get accurate yesterday stats directly from database
async function getYesterdayStats(userId: string): Promise<{
  totalCalls: number;
  conversionRate: number;
  appointments: number;
}> {
  const { start, end } = getYesterdayRange();
  
  try {
    // Get all yesterday's calls for this user
    const yesterdaysCalls = await db
      .select()
      .from(calls)
      .where(
        and(
          eq(calls.userId, userId),
          gte(calls.startTime, start),
          lt(calls.startTime, end)
        )
      );
    
    const totalCalls = yesterdaysCalls.length;
    const conversions = yesterdaysCalls.filter(c => 
      c.conversionResult === 'converted' || 
      c.callSuccessful === true ||
      c.status === 'completed'
    ).length;
    
    const conversionRate = totalCalls > 0 
      ? Math.round((conversions / totalCalls) * 100) 
      : 0;
    
    return {
      totalCalls,
      conversionRate,
      appointments: conversions,
    };
  } catch (error) {
    console.error(`[getYesterdayStats] Error for user ${userId}:`, error);
    return { totalCalls: 0, conversionRate: 0, appointments: 0 };
  }
}

// Send daily summary notifications at 9:00 AM (for yesterday's data)
export function initDailySummaryCron() {
  cron.schedule('0 9 * * *', async () => {
    console.log('[DailySummaryCron] Starting daily summary notifications for yesterday...');
    
    try {
      // Get all active push subscriptions grouped by user
      const subscriptions = await storage.getAllActivePushSubscriptions();
      const userIds = [...new Set(subscriptions.map(s => s.userId))];
      
      console.log(`[DailySummaryCron] Processing ${userIds.length} users...`);
      
      for (const userId of userIds) {
        try {
          // Get accurate yesterday's stats
          const yesterdayStats = await getYesterdayStats(userId);
          
          // Only send if there were calls yesterday
          if (yesterdayStats.totalCalls > 0) {
            const notification = pushNotificationService.createDailySummaryNotification(yesterdayStats);
            
            // Daily summary is sent at 9AM which is after quiet hours (ends at 8AM)
            // So we skip quiet hours but apply anti-spam for edge cases
            await pushNotificationService.sendToUser(userId, notification, { 
              skipAntiSpam: true,  // This is the scheduled daily notification
              skipQuietHours: true // 9AM is after default quiet hours
            });
            
            console.log(`[DailySummaryCron] Sent summary to user ${userId}: ${yesterdayStats.totalCalls} calls, ${yesterdayStats.conversionRate}% conversion`);
          }
        } catch (error) {
          console.error(`[DailySummaryCron] Error for user ${userId}:`, error);
        }
      }
      
      console.log('[DailySummaryCron] Daily summary notifications completed');
    } catch (error) {
      console.error('[DailySummaryCron] Error:', error);
    }
  }, {
    timezone: 'Europe/Paris'
  });
  
  console.log('[DailySummaryCron] Cron job started - will run daily at 9:00 AM Paris time');
}

// Send trial expiring notifications at 10:00 AM
export function initTrialExpiringNotificationsCron() {
  cron.schedule('0 10 * * *', async () => {
    console.log('[TrialExpiringNotificationsCron] Checking trial expirations...');
    
    try {
      const usersWithExpiringTrials = await storage.getUsersWithExpiringTrials();
      
      for (const user of usersWithExpiringTrials) {
        try {
          if (user.countdownEnd) {
            const daysLeft = Math.ceil(
              (new Date(user.countdownEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            
            // Send notifications at 7 days, 3 days, and 1 day before expiration
            if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
              const notification = pushNotificationService.createTrialExpiringNotification(daysLeft);
              await pushNotificationService.sendToUser(user.id, notification, { skipAntiSpam: true });
              console.log(`[TrialExpiringNotificationsCron] Notified user ${user.email} - ${daysLeft} days left`);
            }
          }
        } catch (error) {
          console.error(`[TrialExpiringNotificationsCron] Error for user ${user.id}:`, error);
        }
      }
      
      console.log('[TrialExpiringNotificationsCron] Check completed');
    } catch (error) {
      console.error('[TrialExpiringNotificationsCron] Error:', error);
    }
  }, {
    timezone: 'Europe/Paris'
  });
  
  console.log('[TrialExpiringNotificationsCron] Cron job started - will run daily at 10:00 AM Paris time');
}

// Initialize all push notification cron jobs
export function initPushNotificationCrons() {
  initDailySummaryCron();
  initTrialExpiringNotificationsCron();
  console.log('[PushNotificationCrons] All push notification cron jobs initialized');
}
