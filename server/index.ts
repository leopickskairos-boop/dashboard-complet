import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { registerCronApiRoutes } from "./cron-api-routes";
import { setupVite, serveStatic, log } from "./vite";
import { monthlyReportCron } from "./monthly-report.cron";
import { trialExpirationCron } from "./trial-expiration.cron";
import { initPushNotificationCrons } from "./push-notification.cron";
import { startReviewSyncCron } from "./crons/review-sync.cron";
import { startIntegrationSyncCron } from "./crons/integration-sync.cron";
import { startAppointmentReminderCron } from "./crons/appointment-reminder.cron";
import { waitlistScheduler } from "./services/waitlist-scheduler.service";

const DISABLE_INTERNAL_CRONS = process.env.DISABLE_INTERNAL_CRONS === 'true';

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Stripe webhook needs raw body
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

// Regular JSON parsing for other routes
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  
  // Register cron API routes for external triggering (always available)
  registerCronApiRoutes(app);

  // Start internal cron jobs only if not disabled
  // In production with Autoscale, set DISABLE_INTERNAL_CRONS=true and use external triggers (N8N/cron-job.org)
  if (DISABLE_INTERNAL_CRONS) {
    console.log('[Server] Internal cron jobs DISABLED - use external API triggers');
  } else {
    // Start monthly report cron job
    monthlyReportCron.start();
    console.log('[Server] Monthly report cron job initialized');

    // Start trial expiration cron job
    trialExpirationCron.start();
    console.log('[Server] Trial expiration cron job initialized');

    // Start push notification cron jobs
    initPushNotificationCrons();
    console.log('[Server] Push notification cron jobs initialized');

    // Start review sync cron job
    startReviewSyncCron();
    console.log('[Server] Review sync cron job initialized');

    // Start integration sync cron job
    startIntegrationSyncCron();
    console.log('[Server] Integration sync cron job initialized');

    // Start appointment reminder cron job
    startAppointmentReminderCron();
    console.log('[Server] Appointment reminder cron job initialized');

    // Initialize waitlist scheduler (rehydrates active slots)
    waitlistScheduler.initialize();
    console.log('[Server] Waitlist scheduler initialized');
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  // reusePort is not supported on macOS, only use it in production/Replit
  const listenOptions: any = {
    port,
    host: "0.0.0.0",
  };
  if (process.env.NODE_ENV === 'production' && process.env.REPL_ID) {
    listenOptions.reusePort = true;
  }
  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
