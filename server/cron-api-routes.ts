import type { Express, Request, Response, NextFunction } from "express";
import { monthlyReportCron } from "./monthly-report.cron";
import { trialExpirationCron } from "./trial-expiration.cron";
import { storage } from "./storage";
import { pushNotificationService } from "./push-notification.service";
import { db } from "./db";
import { calls } from "@shared/schema";
import { eq, and, gte, lt } from "drizzle-orm";

const CRON_API_KEY = process.env.N8N_MASTER_API_KEY;

function requireCronApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.replace("Bearer ", "");
  
  if (!CRON_API_KEY) {
    console.warn("[CronAPI] N8N_MASTER_API_KEY not configured");
    return res.status(500).json({ error: "Cron API not configured" });
  }
  
  if (!apiKey || apiKey !== CRON_API_KEY) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  
  next();
}

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

async function getYesterdayStats(userId: string): Promise<{
  totalCalls: number;
  conversionRate: number;
  appointments: number;
}> {
  const { start, end } = getYesterdayRange();
  
  try {
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
      c.conversionResult === "converted" || 
      c.callSuccessful === true ||
      c.status === "completed"
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
    console.error(`[CronAPI] Error getting stats for user ${userId}:`, error);
    return { totalCalls: 0, conversionRate: 0, appointments: 0 };
  }
}

export function registerCronApiRoutes(app: Express): void {
  app.post("/api/cron/monthly-reports", requireCronApiKey, async (req, res) => {
    console.log("[CronAPI] Triggering monthly reports...");
    try {
      await monthlyReportCron.runNow();
      res.json({ success: true, message: "Monthly reports processed" });
    } catch (error: any) {
      console.error("[CronAPI] Monthly reports error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/cron/trial-expirations", requireCronApiKey, async (req, res) => {
    console.log("[CronAPI] Triggering trial expirations...");
    try {
      await trialExpirationCron.runNow();
      res.json({ success: true, message: "Trial expirations processed" });
    } catch (error: any) {
      console.error("[CronAPI] Trial expirations error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/cron/daily-summary", requireCronApiKey, async (req, res) => {
    console.log("[CronAPI] Triggering daily summary notifications...");
    try {
      const subscriptions = await storage.getAllActivePushSubscriptions();
      const userIds = Array.from(new Set(subscriptions.map(s => s.userId)));
      
      let processed = 0;
      for (const userId of userIds) {
        try {
          const yesterdayStats = await getYesterdayStats(userId);
          
          if (yesterdayStats.totalCalls > 0) {
            const notification = pushNotificationService.createDailySummaryNotification(yesterdayStats);
            await pushNotificationService.sendToUser(userId, notification, { 
              skipAntiSpam: true,
              skipQuietHours: true
            });
            processed++;
          }
        } catch (error) {
          console.error(`[CronAPI] Error for user ${userId}:`, error);
        }
      }
      
      res.json({ success: true, message: `Daily summaries sent to ${processed} users` });
    } catch (error: any) {
      console.error("[CronAPI] Daily summary error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/cron/trial-expiring-notifications", requireCronApiKey, async (req, res) => {
    console.log("[CronAPI] Triggering trial expiring notifications...");
    try {
      const usersWithExpiringTrials = await storage.getUsersWithExpiringTrials();
      let notified = 0;
      
      for (const user of usersWithExpiringTrials) {
        try {
          if (user.countdownEnd) {
            const daysLeft = Math.ceil(
              (new Date(user.countdownEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            
            if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
              const notification = pushNotificationService.createTrialExpiringNotification(daysLeft);
              await pushNotificationService.sendToUser(user.id, notification, { skipAntiSpam: true });
              notified++;
            }
          }
        } catch (error) {
          console.error(`[CronAPI] Error for user ${user.id}:`, error);
        }
      }
      
      res.json({ success: true, message: `Trial expiring notifications sent to ${notified} users` });
    } catch (error: any) {
      console.error("[CronAPI] Trial expiring notifications error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/cron/review-sync", requireCronApiKey, async (req, res) => {
    console.log("[CronAPI] Triggering review sync...");
    try {
      const { syncAllReviews } = await import("./crons/review-sync.cron");
      await syncAllReviews();
      res.json({ success: true, message: "Review sync completed" });
    } catch (error: any) {
      console.error("[CronAPI] Review sync error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/cron/integration-sync", requireCronApiKey, async (req, res) => {
    console.log("[CronAPI] Triggering integration sync...");
    try {
      const { runIntegrationSync } = await import("./crons/integration-sync.cron");
      await runIntegrationSync();
      res.json({ success: true, message: "Integration sync completed" });
    } catch (error: any) {
      console.error("[CronAPI] Integration sync error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/cron/health", requireCronApiKey, async (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      endpoints: [
        "POST /api/cron/monthly-reports",
        "POST /api/cron/trial-expirations",
        "POST /api/cron/daily-summary",
        "POST /api/cron/trial-expiring-notifications",
        "POST /api/cron/review-sync",
        "POST /api/cron/integration-sync"
      ]
    });
  });

  console.log("[CronAPI] External cron API routes registered");
}
