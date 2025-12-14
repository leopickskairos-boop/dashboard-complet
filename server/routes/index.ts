// Routes Orchestrator - Modular Route Registration
// This file imports and registers all modular route files

import type { Express } from "express";
import { createServer, type Server } from "http";

// Import modular route files
import authRouter from "./auth.routes";
import subscriptionRouter, { handleStripeWebhook } from "./subscription.routes";
import guaranteeRouter from "./guarantee.routes";
import reviewsRouter from "./reviews.routes";
import reviewsAiRouter from "./reviews-ai.routes";
import reviewsN8nRouter from "./reviews-n8n.routes";
import shortLinksRouter from "./short-links.routes";
import n8nRouter from "./n8n.routes";
import adminRouter from "./admin.routes";

// Import other existing routes that will be integrated separately
import { registerMarketingRoutes } from "../marketing-routes";
import integrationRoutes from "../integration-routes";

// Re-export stripe webhook handler for raw body middleware
export { handleStripeWebhook };

/**
 * Register all modular routes on the Express app
 * 
 * This function replaces the monolithic registerRoutes function
 * by delegating to smaller, focused route modules.
 */
export async function registerModularRoutes(app: Express): Promise<Server> {
  // ===== STRIPE WEBHOOK (needs raw body - registered before JSON parsing) =====
  // Note: This is handled separately in index.ts with express.raw()
  
  // ===== AUTH ROUTES =====
  app.use("/api/auth", authRouter);
  
  // ===== SUBSCRIPTION/BILLING ROUTES =====
  app.use("/api/subscription", subscriptionRouter);
  
  // ===== CB GUARANTEE ROUTES =====
  app.use("/api/guarantee", guaranteeRouter);
  
  // ===== REVIEWS ROUTES =====
  app.use("/api/reviews", reviewsRouter);
  app.use("/api/ai", reviewsAiRouter);
  app.use("/api/n8n/reviews", reviewsN8nRouter);
  
  // ===== SHORT LINKS ROUTES =====
  app.use("/api/short", shortLinksRouter);
  
  // ===== N8N INTEGRATION ROUTES =====
  app.use("/api/n8n", n8nRouter);
  
  // ===== ADMIN ROUTES =====
  app.use("/api/admin", adminRouter);
  
  // ===== MARKETING ROUTES (existing module) =====
  registerMarketingRoutes(app);
  
  // ===== INTEGRATION ROUTES (existing module) =====
  app.use("/api/integrations", integrationRoutes);
  
  console.log("✅ All modular routes registered successfully");
  
  // Create and return HTTP server
  const httpServer = createServer(app);
  return httpServer;
}

export default registerModularRoutes;
