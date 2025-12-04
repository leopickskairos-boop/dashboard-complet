// SpeedAI Push Notification Service
import webpush from 'web-push';
import { storage } from './storage';
import type { PushSubscription } from '@shared/schema';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@speedai.fr',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('[PushNotificationService] VAPID keys configured');
} else {
  console.warn('[PushNotificationService] VAPID keys not configured - push notifications disabled');
}

// Notification types
export type NotificationType = 
  | 'daily_summary'
  | 'alert'
  | 'win'
  | 'affiliation'
  | 'trial_expiring'
  | 'system';

// Notification payload structure
export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    type: NotificationType;
    url?: string;
    notificationId?: string;
    callbackUrl?: string;
    [key: string]: any;
  };
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

// Anti-spam rules configuration
const ANTI_SPAM_CONFIG = {
  maxDailyNotifications: 10,
  maxHourlyNotifications: 3,
  minIntervalMinutes: 5,
  quietHoursDefault: { start: 22, end: 8 }, // 22:00 to 08:00
};

class PushNotificationService {
  private notificationCounts: Map<string, { daily: number; hourly: number; lastSent: Date }> = new Map();

  // Check if we're in quiet hours
  private isQuietHours(quietHoursStart?: string, quietHoursEnd?: string): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    
    const startHour = quietHoursStart 
      ? parseInt(quietHoursStart.split(':')[0]) 
      : ANTI_SPAM_CONFIG.quietHoursDefault.start;
    const endHour = quietHoursEnd 
      ? parseInt(quietHoursEnd.split(':')[0]) 
      : ANTI_SPAM_CONFIG.quietHoursDefault.end;

    if (startHour > endHour) {
      // Quiet hours span midnight (e.g., 22:00 to 08:00)
      return currentHour >= startHour || currentHour < endHour;
    } else {
      // Quiet hours within same day
      return currentHour >= startHour && currentHour < endHour;
    }
  }

  // Check anti-spam rules
  private checkAntiSpam(userId: string): { allowed: boolean; reason?: string } {
    const counts = this.notificationCounts.get(userId);
    
    if (!counts) {
      return { allowed: true };
    }

    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const minIntervalAgo = new Date(now.getTime() - ANTI_SPAM_CONFIG.minIntervalMinutes * 60 * 1000);

    // Check minimum interval
    if (counts.lastSent > minIntervalAgo) {
      return { 
        allowed: false, 
        reason: `Minimum interval not met (${ANTI_SPAM_CONFIG.minIntervalMinutes} minutes)` 
      };
    }

    // Check hourly limit
    if (counts.hourly >= ANTI_SPAM_CONFIG.maxHourlyNotifications) {
      return { 
        allowed: false, 
        reason: `Hourly limit reached (${ANTI_SPAM_CONFIG.maxHourlyNotifications})` 
      };
    }

    // Check daily limit
    if (counts.daily >= ANTI_SPAM_CONFIG.maxDailyNotifications) {
      return { 
        allowed: false, 
        reason: `Daily limit reached (${ANTI_SPAM_CONFIG.maxDailyNotifications})` 
      };
    }

    return { allowed: true };
  }

  // Update anti-spam counters
  private updateAntiSpamCounters(userId: string): void {
    const now = new Date();
    const counts = this.notificationCounts.get(userId) || { daily: 0, hourly: 0, lastSent: now };
    
    // Reset daily counter at midnight
    const lastSentDate = counts.lastSent.toDateString();
    const todayDate = now.toDateString();
    if (lastSentDate !== todayDate) {
      counts.daily = 0;
    }

    // Reset hourly counter after an hour
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    if (counts.lastSent < hourAgo) {
      counts.hourly = 0;
    }

    counts.daily++;
    counts.hourly++;
    counts.lastSent = now;
    
    this.notificationCounts.set(userId, counts);
  }

  // Send notification to a single subscription
  async sendToSubscription(
    subscription: PushSubscription,
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; error?: string }> {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return { success: false, error: 'VAPID keys not configured' };
    }

    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dhKey,
          auth: subscription.authKey,
        },
      };

      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload)
      );

      console.log(`[PushNotificationService] Sent notification to ${subscription.endpoint.substring(0, 50)}...`);
      return { success: true };
    } catch (error: any) {
      console.error('[PushNotificationService] Send error:', error.message);
      
      // Handle expired subscriptions
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log('[PushNotificationService] Removing expired subscription');
        await storage.deletePushSubscription(subscription.endpoint);
      }
      
      return { success: false, error: error.message };
    }
  }

  // Send notification to a user (all their subscriptions)
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
    options?: {
      skipAntiSpam?: boolean;
      skipQuietHours?: boolean;
    }
  ): Promise<{ sent: number; failed: number; skipped: string[] }> {
    const result = { sent: 0, failed: 0, skipped: [] as string[] };

    // Check quiet hours
    if (!options?.skipQuietHours && this.isQuietHours()) {
      result.skipped.push('Quiet hours active');
      console.log(`[PushNotificationService] Skipped notification for ${userId}: quiet hours`);
      return result;
    }

    // Check anti-spam
    if (!options?.skipAntiSpam) {
      const spamCheck = this.checkAntiSpam(userId);
      if (!spamCheck.allowed) {
        result.skipped.push(spamCheck.reason || 'Anti-spam limit');
        console.log(`[PushNotificationService] Skipped notification for ${userId}: ${spamCheck.reason}`);
        return result;
      }
    }

    // Get all subscriptions for this user
    const subscriptions = await storage.getPushSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      result.skipped.push('No subscriptions found');
      return result;
    }

    // Send to all subscriptions
    for (const subscription of subscriptions) {
      if (!subscription.isActive) {
        result.skipped.push(`Subscription ${subscription.id} inactive`);
        continue;
      }

      const sendResult = await this.sendToSubscription(subscription, payload);
      if (sendResult.success) {
        result.sent++;
      } else {
        result.failed++;
      }
    }

    // Update anti-spam counters if at least one notification was sent
    if (result.sent > 0) {
      this.updateAntiSpamCounters(userId);
    }

    console.log(`[PushNotificationService] User ${userId}: ${result.sent} sent, ${result.failed} failed`);
    return result;
  }

  // Send notification to all users (broadcast)
  async broadcast(
    payload: PushNotificationPayload,
    options?: {
      skipAntiSpam?: boolean;
      skipQuietHours?: boolean;
    }
  ): Promise<{ totalSent: number; totalFailed: number; userResults: Map<string, any> }> {
    const subscriptions = await storage.getAllActivePushSubscriptions();
    const userResults = new Map<string, any>();
    let totalSent = 0;
    let totalFailed = 0;

    // Group by user
    const byUser = new Map<string, PushSubscription[]>();
    for (const sub of subscriptions) {
      const userSubs = byUser.get(sub.userId) || [];
      userSubs.push(sub);
      byUser.set(sub.userId, userSubs);
    }

    // Send to each user
    for (const [userId, userSubscriptions] of byUser) {
      const result = await this.sendToUser(userId, payload, options);
      userResults.set(userId, result);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    console.log(`[PushNotificationService] Broadcast: ${totalSent} sent, ${totalFailed} failed to ${byUser.size} users`);
    return { totalSent, totalFailed, userResults };
  }

  // Pre-built notification templates
  createDailySummaryNotification(stats: {
    totalCalls: number;
    conversionRate: number;
    appointments: number;
  }): PushNotificationPayload {
    return {
      title: 'Bilan quotidien SpeedAI',
      body: `${stats.totalCalls} appels | ${stats.conversionRate}% conversion | ${stats.appointments} RDV`,
      icon: '/speedai-icon-192.png',
      badge: '/speedai-badge-72.png',
      tag: 'daily-summary',
      data: {
        type: 'daily_summary',
        url: '/dashboard',
      },
      actions: [
        { action: 'view', title: 'Voir le détail' },
      ],
    };
  }

  createAlertNotification(alert: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
  }): PushNotificationPayload {
    return {
      title: `${alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'} ${alert.title}`,
      body: alert.message,
      icon: '/speedai-icon-192.png',
      badge: '/speedai-badge-72.png',
      tag: `alert-${Date.now()}`,
      requireInteraction: alert.severity === 'critical',
      data: {
        type: 'alert',
        url: '/dashboard?tab=alerts',
        severity: alert.severity,
      },
      actions: [
        { action: 'view', title: 'Voir' },
        { action: 'dismiss', title: 'Ignorer' },
      ],
    };
  }

  createWinNotification(win: {
    title: string;
    description: string;
    callId?: string;
  }): PushNotificationPayload {
    return {
      title: `🎉 ${win.title}`,
      body: win.description,
      icon: '/speedai-icon-192.png',
      badge: '/speedai-badge-72.png',
      tag: `win-${Date.now()}`,
      data: {
        type: 'win',
        url: win.callId ? `/dashboard?call=${win.callId}` : '/dashboard',
      },
    };
  }

  createTrialExpiringNotification(daysLeft: number): PushNotificationPayload {
    return {
      title: 'Votre essai expire bientôt',
      body: `Il vous reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} d'essai gratuit. Passez à l'abonnement pour continuer.`,
      icon: '/speedai-icon-192.png',
      badge: '/speedai-badge-72.png',
      tag: 'trial-expiring',
      requireInteraction: true,
      data: {
        type: 'trial_expiring',
        url: '/dashboard?tab=subscription',
        daysLeft,
      },
      actions: [
        { action: 'view', title: 'S\'abonner' },
      ],
    };
  }

  createAffiliationNotification(message: string): PushNotificationPayload {
    return {
      title: 'Programme d\'affiliation SpeedAI',
      body: message,
      icon: '/speedai-icon-192.png',
      badge: '/speedai-badge-72.png',
      tag: 'affiliation',
      data: {
        type: 'affiliation',
        url: '/dashboard?tab=affiliation',
      },
    };
  }
}

export const pushNotificationService = new PushNotificationService();
