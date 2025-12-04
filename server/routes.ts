// Reference: javascript_stripe blueprint for Stripe integration
import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { fileStorage } from "./file-storage.service";
import { aiInsightsService } from "./ai-insights.service";
import { aiAnalyticsService } from "./ai-analytics.service";
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateVerificationToken,
  getVerificationTokenExpiry,
  toPublicUser,
  requireAuth,
  requireVerified,
  requireSubscription,
} from "./auth";
import { requireApiKey } from "./api-key-auth";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmail,
} from "./gmail-email";
import {
  insertUserSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  insertNotificationSchema,
  n8nLogSchema,
  n8nLogFiltersSchema,
  n8nCallWebhookSchema,
} from "@shared/schema";
import { z } from "zod";
import {
  notifySubscriptionAlert,
  notifyPasswordChanged,
} from "./notifications";
import { pushNotificationService } from "./push-notification.service";

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        isVerified: boolean;
        accountStatus: string;
      };
      logout?: (callback: (err: any) => void) => void;
    }
  }
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("Missing required Stripe secret: STRIPE_WEBHOOK_SECRET");
}

if (!process.env.STRIPE_PRICE_ID) {
  throw new Error("Missing required Stripe secret: STRIPE_PRICE_ID");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== AUTHENTICATION ROUTES =====

  // Signup
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "Un compte existe déjà avec cet email" });
      }

      // Hash password
      const hashedPassword = await hashPassword(data.password);

      // Create Stripe Customer immediately (before user creation)
      let stripeCustomerId: string | undefined;
      try {
        const customer = await stripe.customers.create({
          email: data.email,
          metadata: {
            source: "speedai_signup",
          },
        });
        stripeCustomerId = customer.id;
      } catch (stripeError) {
        console.error("Failed to create Stripe customer:", stripeError);
        // Continue anyway - can be created later if needed
      }

      // Calculate trial period (30 days from now)
      const countdownStart = new Date();
      const countdownEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days

      // Create user with trial period
      const user = await storage.createUser({
        email: data.email,
        password: hashedPassword,
        stripeCustomerId,
        countdownStart,
        countdownEnd,
        accountStatus: "trial",
      });

      // Generate verification token
      const verificationToken = generateVerificationToken();
      const tokenExpiry = getVerificationTokenExpiry();
      await storage.setVerificationToken(
        user.id,
        verificationToken,
        tokenExpiry,
      );

      // Send verification email (don't fail if email sending fails)
      try {
        await sendVerificationEmail(user.email, verificationToken);
      } catch (emailError) {
        console.error(
          "Failed to send verification email (non-critical):",
          emailError,
        );
        // Continue anyway - user can verify via manual link if needed
      }

      res.status(201).json({
        message:
          "Inscription réussie. Veuillez vérifier votre email. Vous bénéficiez de 30 jours d'essai gratuit.",
        userId: user.id,
        trialDays: 30,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Données invalides", errors: error.errors });
      }
      console.error("Signup error:", error);
      res.status(500).json({ message: "Erreur lors de l'inscription" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res
          .status(401)
          .json({ message: "Email ou mot de passe incorrect" });
      }

      // Verify password
      const isValid = await comparePassword(data.password, user.password);
      if (!isValid) {
        return res
          .status(401)
          .json({ message: "Email ou mot de passe incorrect" });
      }

      // Generate token
      const token = generateToken(user.id);

      // Set httpOnly cookie
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // DEBUG LOG: Track successful login (development only)
      if (process.env.NODE_ENV === "development") {
        console.log("[BACKEND LOGIN] User authenticated:", {
          userId: user.id,
          email: user.email,
          role: user.role,
          accountStatus: (user as any).accountStatus,
        });
      }

      res.json({
        message: "Connexion réussie",
        user: toPublicUser(user),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides" });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Erreur lors de la connexion" });
    }
  });

  // Get current user
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = (req as any).user;

    // DEBUG LOG: Track /api/auth/me response (development only)
    if (process.env.NODE_ENV === "development") {
      console.log("[BACKEND /api/auth/me] Returning user:", {
        userId: user.id,
        email: user.email,
        role: user.role,
      });
    }

    res.json(toPublicUser(user));
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ message: "Déconnexion réussie" });
  });

  // Verify email
  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const verificationSchema = z.object({
        token: z.string().min(1, "Token requis"),
      });

      const { token } = verificationSchema.parse(req.body);

      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.status(400).json({ message: "Token invalide ou expiré" });
      }

      // Check token expiry
      if (user.verificationTokenExpiry) {
        const now = new Date();
        const expiry = new Date(user.verificationTokenExpiry);
        if (now > expiry) {
          return res.status(400).json({ message: "Token expiré" });
        }
      }

      // Verify email
      await storage.verifyEmail(user.id);

      res.json({ message: "Email vérifié avec succès" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides" });
      }
      console.error("Verify email error:", error);
      res.status(500).json({ message: "Erreur lors de la vérification" });
    }
  });

  // Resend verification email
  app.post("/api/auth/resend-verification", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;

      if (user.isVerified) {
        return res.status(400).json({ message: "Email déjà vérifié" });
      }

      // Generate new token
      const verificationToken = generateVerificationToken();
      const tokenExpiry = getVerificationTokenExpiry();
      await storage.setVerificationToken(
        user.id,
        verificationToken,
        tokenExpiry,
      );

      // Send email
      await sendVerificationEmail(user.email, verificationToken);

      res.json({ message: "Email de vérification renvoyé" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Erreur lors de l'envoi" });
    }
  });

  // Forgot password - request reset
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const data = forgotPasswordSchema.parse(req.body);

      // Find user by email (but don't reveal if user exists - security)
      const user = await storage.getUserByEmail(data.email);

      // Always return success message to prevent email enumeration
      if (!user) {
        return res.json({
          message:
            "Si cet email existe dans notre système, un lien de réinitialisation a été envoyé.",
        });
      }

      // Generate reset token (1 hour expiry)
      const resetToken = generateVerificationToken(); // Reuse same generator
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 1); // 1 hour expiry

      await storage.setResetPasswordToken(user.id, resetToken, tokenExpiry);

      // Send password reset email (don't fail if email sending fails)
      try {
        await sendPasswordResetEmail(user.email, resetToken);
      } catch (emailError) {
        console.error(
          "Failed to send password reset email (non-critical):",
          emailError,
        );
        // Continue anyway - user can request another reset if needed
      }

      res.json({
        message:
          "Si cet email existe dans notre système, un lien de réinitialisation a été envoyé.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Email invalide" });
      }
      console.error("Forgot password error:", error);
      res
        .status(500)
        .json({ message: "Erreur lors de la demande de réinitialisation" });
    }
  });

  // Reset password - actually reset with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const data = resetPasswordSchema.parse(req.body);

      // Find user by reset token
      const user = await storage.getUserByResetPasswordToken(data.token);
      if (!user) {
        return res.status(400).json({ message: "Token invalide ou expiré" });
      }

      // Check token expiry
      if (user.resetPasswordTokenExpiry) {
        const now = new Date();
        const expiry = new Date(user.resetPasswordTokenExpiry);
        if (now > expiry) {
          return res.status(400).json({
            message:
              "Token expiré. Veuillez demander un nouveau lien de réinitialisation.",
          });
        }
      }

      // Hash new password
      const hashedPassword = await hashPassword(data.password);

      // Update password and clear reset token
      await storage.resetPassword(user.id, hashedPassword);

      res.json({
        message:
          "Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides" });
      }
      console.error("Reset password error:", error);
      res.status(500).json({
        message: "Erreur lors de la réinitialisation du mot de passe",
      });
    }
  });

  // ===== SUBSCRIPTION ROUTES =====

  // Create subscription
  app.post(
    "/api/subscription/create",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const user = (req as any).user;

        // If user already has a subscription, retrieve it
        if (user.stripeSubscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(
            user.stripeSubscriptionId,
          );

          if (
            subscription.latest_invoice &&
            typeof subscription.latest_invoice !== "string"
          ) {
            const paymentIntent = (subscription.latest_invoice as any)
              .payment_intent;
            if (paymentIntent && typeof paymentIntent !== "string") {
              return res.json({
                subscriptionId: subscription.id,
                clientSecret: paymentIntent.client_secret,
              });
            }
          }
        }

        // Create Stripe customer
        let customerId = user.stripeCustomerId;
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            metadata: { userId: user.id },
          });
          customerId = customer.id;
          await storage.updateStripeInfo(user.id, {
            stripeCustomerId: customerId,
          });
        }

        // Create subscription
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: STRIPE_PRICE_ID }],
          payment_behavior: "default_incomplete",
          payment_settings: { save_default_payment_method: "on_subscription" },
          expand: ["latest_invoice.payment_intent"],
        });

        // Update user with subscription ID
        await storage.updateStripeInfo(user.id, {
          stripeSubscriptionId: subscription.id,
        });

        const invoice = subscription.latest_invoice;
        if (invoice && typeof invoice !== "string") {
          const paymentIntent = (invoice as any).payment_intent;
          if (paymentIntent && typeof paymentIntent !== "string") {
            return res.json({
              subscriptionId: subscription.id,
              clientSecret: paymentIntent.client_secret,
            });
          }
        }

        res
          .status(500)
          .json({ message: "Erreur lors de la création de l'abonnement" });
      } catch (error: any) {
        console.error("Create subscription error:", error);
        res.status(500).json({
          message:
            error.message || "Erreur lors de la création de l'abonnement",
        });
      }
    },
  );

  // Stripe webhook
  app.post("/api/webhooks/stripe", async (req, res) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      return res.status(400).json({ message: "No signature" });
    }

    let event: Stripe.Event;

    try {
      // Use raw body for webhook verification
      const rawBody = (req as any).rawBody || req.body;
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    try {
      switch (event.type) {
        case "customer.subscription.created": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          // Find user by customer ID
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            const updateData: any = {
              subscriptionStatus: subscription.status,
            };

            if ((subscription as any).current_period_end) {
              updateData.subscriptionCurrentPeriodEnd = new Date(
                (subscription as any).current_period_end * 1000,
              );
            }

            await storage.updateStripeInfo(user.id, updateData);

            // Update account status to 'active' when subscription is created
            await storage.updateUser(user.id, { accountStatus: "active" });

            // Notify user about subscription creation
            await notifySubscriptionAlert(
              storage,
              user.id,
              "subscription_created",
              "Votre abonnement SpeedAI a été créé avec succès.",
            );
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          // Find user by customer ID
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            const updateData: any = {
              subscriptionStatus: subscription.status,
            };

            if ((subscription as any).current_period_end) {
              updateData.subscriptionCurrentPeriodEnd = new Date(
                (subscription as any).current_period_end * 1000,
              );
            }

            await storage.updateStripeInfo(user.id, updateData);

            // Notify user if subscription was renewed
            if (subscription.status === "active") {
              await notifySubscriptionAlert(
                storage,
                user.id,
                "subscription_renewed",
                "Votre abonnement SpeedAI a été renouvelé avec succès.",
              );
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.updateStripeInfo(user.id, {
              subscriptionStatus: "canceled",
            });

            // Notify user about subscription expiration
            await notifySubscriptionAlert(
              storage,
              user.id,
              "subscription_expired",
              "Votre abonnement SpeedAI a expiré. Renouvelez-le pour continuer à utiliser nos services.",
            );
          }
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          const invoiceSubscription = (invoice as any).subscription;
          if (invoiceSubscription) {
            const subscription = await stripe.subscriptions.retrieve(
              invoiceSubscription as string,
            );
            const customerId = subscription.customer as string;

            const user = await storage.getUserByStripeCustomerId(customerId);
            if (user) {
              const updateData: any = {
                subscriptionStatus: "active",
              };

              if ((subscription as any).current_period_end) {
                updateData.subscriptionCurrentPeriodEnd = new Date(
                  (subscription as any).current_period_end * 1000,
                );
              }

              await storage.updateStripeInfo(user.id, updateData);

              // Update account status to 'active' when payment succeeds
              await storage.updateUser(user.id, { accountStatus: "active" });
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const invoiceSubscription = (invoice as any).subscription;
          if (invoiceSubscription && invoice.customer) {
            const customerId = invoice.customer as string;
            const user = await storage.getUserByStripeCustomerId(customerId);
            if (user) {
              await storage.updateStripeInfo(user.id, {
                subscriptionStatus: "past_due",
              });
            }
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook handler error:", error);
      res.status(500).json({ message: "Webhook handler failed" });
    }
  });

  // ===== DASHBOARD ROUTES (Protected) =====

  // Get call statistics
  app.get(
    "/api/calls/stats",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const timeFilter = req.query.timeFilter as
          | "hour"
          | "today"
          | "two_days"
          | "week"
          | undefined;

        const stats = await storage.getStats(userId, timeFilter);
        res.json(stats);
      } catch (error) {
        console.error("Error fetching stats:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la récupération des statistiques" });
      }
    },
  );

  // Get enriched call statistics with N8N data
  app.get(
    "/api/calls/enriched-stats",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const timeFilter = req.query.timeFilter as
          | "hour"
          | "today"
          | "two_days"
          | "week"
          | undefined;

        const calls = await storage.getCalls(userId, { timeFilter });
        
        // Calculate enriched metrics from N8N data
        const totalCalls = calls.length;
        
        // Conversion results breakdown
        const conversionCounts = new Map<string, number>();
        calls.forEach((call) => {
          const result = (call as any).conversionResult || 'unknown';
          conversionCounts.set(result, (conversionCounts.get(result) || 0) + 1);
        });
        const conversionResults = Array.from(conversionCounts.entries())
          .map(([result, count]) => ({
            result,
            count,
            percentage: totalCalls > 0 ? (count / totalCalls) * 100 : 0,
          }))
          .sort((a, b) => b.count - a.count);
        
        // Client mood distribution
        const moodCounts = new Map<string, number>();
        calls.forEach((call) => {
          const mood = (call as any).clientMood;
          if (mood) {
            moodCounts.set(mood, (moodCounts.get(mood) || 0) + 1);
          }
        });
        const clientMoods = Array.from(moodCounts.entries())
          .map(([mood, count]) => ({
            mood,
            count,
            percentage: totalCalls > 0 ? (count / totalCalls) * 100 : 0,
          }))
          .sort((a, b) => b.count - a.count);
        
        // Service type distribution
        const serviceCounts = new Map<string, number>();
        calls.forEach((call) => {
          const service = (call as any).serviceType;
          if (service) {
            serviceCounts.set(service, (serviceCounts.get(service) || 0) + 1);
          }
        });
        const serviceTypes = Array.from(serviceCounts.entries())
          .map(([serviceType, count]) => ({
            serviceType,
            count,
            percentage: totalCalls > 0 ? (count / totalCalls) * 100 : 0,
          }))
          .sort((a, b) => b.count - a.count);
        
        // Booking metrics
        const callsWithConfidence = calls.filter((c: any) => c.bookingConfidence !== null);
        const averageBookingConfidence = callsWithConfidence.length > 0
          ? callsWithConfidence.reduce((sum: number, c: any) => sum + (c.bookingConfidence || 0), 0) / callsWithConfidence.length
          : 0;
        
        const lastMinuteBookings = calls.filter((c: any) => c.isLastMinute === true).length;
        const appointmentsTaken = calls.filter((c: any) => c.appointmentDate !== null).length;
        
        // Client insights
        const returningClients = calls.filter((c: any) => c.isReturningClient === true).length;
        const upsellAccepted = calls.filter((c: any) => c.upsellAccepted === true).length;
        
        // Quality metrics
        const callsWithTranscript = calls.filter((c: any) => c.transcript && c.transcript.length > 0).length;
        
        // Top keywords
        const keywordCounts = new Map<string, number>();
        calls.forEach((call: any) => {
          const keywords = call.keywords || [];
          keywords.forEach((kw: string) => {
            const normalized = kw.toLowerCase().trim();
            if (normalized.length > 2) {
              keywordCounts.set(normalized, (keywordCounts.get(normalized) || 0) + 1);
            }
          });
        });
        const topKeywords = Array.from(keywordCounts.entries())
          .map(([keyword, count]) => ({ keyword, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        
        res.json({
          totalCalls,
          conversionResults,
          clientMoods,
          serviceTypes,
          averageBookingConfidence,
          lastMinuteBookings,
          lastMinutePercentage: appointmentsTaken > 0 ? (lastMinuteBookings / appointmentsTaken) * 100 : 0,
          returningClients,
          returningClientPercentage: totalCalls > 0 ? (returningClients / totalCalls) * 100 : 0,
          upsellAccepted,
          upsellConversionRate: totalCalls > 0 ? (upsellAccepted / totalCalls) * 100 : 0,
          callsWithTranscript,
          transcriptPercentage: totalCalls > 0 ? (callsWithTranscript / totalCalls) * 100 : 0,
          topKeywords,
        });
      } catch (error) {
        console.error("Error fetching enriched stats:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la récupération des statistiques enrichies" });
      }
    },
  );

  // ===== N8N REPORT DATA EXTRACTION API =====
  // This endpoint is used by N8N to extract all client data for PDF report generation
  // Queries by agent_id (SpeedAI client identifier)
  app.get(
    "/api/n8n/client-report-data/:agentId",
    async (req, res) => {
      try {
        const apiKey = req.headers.authorization?.replace("Bearer ", "");
        const { agentId } = req.params;
        const { month, year } = req.query;
        
        // Validate API key
        if (!apiKey) {
          return res.status(401).json({ error: "API key required" });
        }
        
        // Get user by API key (must be admin for this endpoint)
        const authenticatedUser = await authenticateByApiKey(apiKey);
        if (!authenticatedUser) {
          return res.status(401).json({ error: "Invalid API key" });
        }
        
        // Only admins can access client report data
        const isAdmin = authenticatedUser.role === "admin";
        if (!isAdmin) {
          return res.status(403).json({ error: "Admin access required" });
        }
        
        // Get the SpeedAI client by agent_id
        const speedaiClient = await storage.getSpeedaiClientByAgentId(agentId);
        if (!speedaiClient) {
          return res.status(404).json({ error: "SpeedAI client not found", agent_id: agentId });
        }
        
        // Determine the period (default: last month)
        const now = new Date();
        const reportMonth = month ? parseInt(month as string) : now.getMonth(); // 0-indexed, so current month - 1 for last month
        const reportYear = year ? parseInt(year as string) : now.getFullYear();
        
        // Get start and end dates for the period
        const startDate = new Date(reportYear, reportMonth - 1, 1);
        const endDate = new Date(reportYear, reportMonth, 0, 23, 59, 59, 999);
        
        // Get all calls for this agent_id in the period
        const periodCalls = await storage.getCallsByAgentId(agentId, {
          month: reportMonth,
          year: reportYear,
        });
        
        // Calculate comprehensive metrics
        const totalCalls = periodCalls.length;
        const answeredCalls = periodCalls.filter((c) => c.status === "completed").length;
        const missedCalls = periodCalls.filter((c) => c.status === "missed").length;
        
        // Duration metrics
        const callsWithDuration = periodCalls.filter((c) => c.duration && c.duration > 0);
        const totalDuration = callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0);
        const avgDuration = callsWithDuration.length > 0 ? totalDuration / callsWithDuration.length : 0;
        
        // Conversion metrics
        const conversionCounts: Record<string, number> = {};
        periodCalls.forEach((call: any) => {
          const result = call.conversionResult || 'unknown';
          conversionCounts[result] = (conversionCounts[result] || 0) + 1;
        });
        
        // Client mood distribution
        const moodCounts: Record<string, number> = {};
        periodCalls.forEach((call: any) => {
          if (call.clientMood) {
            moodCounts[call.clientMood] = (moodCounts[call.clientMood] || 0) + 1;
          }
        });
        
        // Service types
        const serviceCounts: Record<string, number> = {};
        periodCalls.forEach((call: any) => {
          if (call.serviceType) {
            serviceCounts[call.serviceType] = (serviceCounts[call.serviceType] || 0) + 1;
          }
        });
        
        // Top keywords
        const keywordCounts: Record<string, number> = {};
        periodCalls.forEach((call: any) => {
          const keywords = call.keywords || [];
          keywords.forEach((kw: string) => {
            const normalized = kw.toLowerCase().trim();
            if (normalized.length > 2) {
              keywordCounts[normalized] = (keywordCounts[normalized] || 0) + 1;
            }
          });
        });
        const topKeywords = Object.entries(keywordCounts)
          .map(([keyword, count]) => ({ keyword, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);
        
        // Appointments by day of week
        const appointmentsByDay: Record<string, number> = {};
        periodCalls.forEach((call: any) => {
          if (call.appointmentDayOfWeek) {
            appointmentsByDay[call.appointmentDayOfWeek] = (appointmentsByDay[call.appointmentDayOfWeek] || 0) + 1;
          }
        });
        
        // Hourly distribution
        const hourlyDistribution: Record<string, number> = {};
        periodCalls.forEach((call) => {
          const hour = new Date(call.startTime).getHours();
          const hourKey = `${hour}:00`;
          hourlyDistribution[hourKey] = (hourlyDistribution[hourKey] || 0) + 1;
        });
        
        // Quality metrics
        const callsWithConfidence = periodCalls.filter((c: any) => c.bookingConfidence !== null);
        const avgBookingConfidence = callsWithConfidence.length > 0
          ? callsWithConfidence.reduce((sum: number, c: any) => sum + (c.bookingConfidence || 0), 0) / callsWithConfidence.length
          : 0;
        
        const returningClients = periodCalls.filter((c: any) => c.isReturningClient === true).length;
        const lastMinuteBookings = periodCalls.filter((c: any) => c.isLastMinute === true).length;
        const upsellAccepted = periodCalls.filter((c: any) => c.upsellAccepted === true).length;
        
        // Build complete report data
        const reportData = {
          client: {
            agentId: speedaiClient.agentId,
            businessName: speedaiClient.businessName,
            businessType: speedaiClient.businessType,
            contactEmail: speedaiClient.contactEmail,
            plan: speedaiClient.plan,
            isActive: speedaiClient.isActive,
          },
          period: {
            month: reportMonth,
            year: reportYear,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          summary: {
            totalCalls,
            answeredCalls,
            missedCalls,
            answerRate: totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0,
            totalDurationMinutes: Math.round(totalDuration / 60),
            averageDurationSeconds: Math.round(avgDuration),
          },
          conversions: {
            breakdown: conversionCounts,
            total: Object.values(conversionCounts).reduce((a, b) => a + b, 0),
          },
          clientInsights: {
            moodDistribution: moodCounts,
            returningClients,
            returningClientRate: totalCalls > 0 ? (returningClients / totalCalls) * 100 : 0,
          },
          services: {
            distribution: serviceCounts,
          },
          bookings: {
            byDayOfWeek: appointmentsByDay,
            avgConfidence: Math.round(avgBookingConfidence),
            lastMinuteCount: lastMinuteBookings,
            upsellAccepted,
            upsellRate: totalCalls > 0 ? (upsellAccepted / totalCalls) * 100 : 0,
          },
          activity: {
            hourlyDistribution,
            topKeywords,
          },
          calls: periodCalls.map((call: any) => ({
            id: call.id,
            callId: call.callId,
            phoneNumber: call.phoneNumber,
            status: call.status,
            duration: call.duration,
            startTime: call.startTime,
            summary: call.summary,
            transcript: call.transcript,
            tags: call.tags,
            conversionResult: call.conversionResult,
            clientMood: call.clientMood,
            serviceType: call.serviceType,
            bookingConfidence: call.bookingConfidence,
          })),
          generatedAt: new Date().toISOString(),
        };
        
        console.log(`[N8N Report Data] Exported data for agent ${agentId} - Period: ${reportMonth}/${reportYear} - ${totalCalls} calls`);
        
        res.json(reportData);
      } catch (error) {
        console.error("Error generating N8N report data:", error);
        res.status(500).json({ error: "Failed to generate report data" });
      }
    },
  );

  // Get all SpeedAI clients (for N8N to know which clients to generate reports for)
  app.get(
    "/api/n8n/clients",
    async (req, res) => {
      try {
        const apiKey = req.headers.authorization?.replace("Bearer ", "");
        
        if (!apiKey) {
          return res.status(401).json({ error: "API key required" });
        }
        
        const authenticatedUser = await authenticateByApiKey(apiKey);
        if (!authenticatedUser) {
          return res.status(401).json({ error: "Invalid API key" });
        }
        
        // Only admins can list all clients
        if (authenticatedUser.role !== "admin") {
          return res.status(403).json({ error: "Admin access required" });
        }
        
        const clients = await storage.getAllSpeedaiClients();
        
        res.json({
          total: clients.length,
          clients: clients.map(c => ({
            agentId: c.agentId,
            businessName: c.businessName,
            businessType: c.businessType,
            contactEmail: c.contactEmail,
            plan: c.plan,
            isActive: c.isActive,
            firstCallAt: c.firstCallAt,
            lastCallAt: c.lastCallAt,
          })),
        });
      } catch (error) {
        console.error("Error fetching SpeedAI clients:", error);
        res.status(500).json({ error: "Failed to fetch clients" });
      }
    },
  );

  // Helper function to authenticate by API key
  async function authenticateByApiKey(apiKey: string): Promise<any> {
    try {
      const bcrypt = await import("bcryptjs");
      const usersWithKeys = await storage.getAllUsersWithApiKey();
      
      for (const user of usersWithKeys) {
        if (user.apiKeyHash) {
          const isMatch = await bcrypt.compare(apiKey, user.apiKeyHash);
          if (isMatch) {
            return user;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Error authenticating by API key:", error);
      return null;
    }
  }

  // Get AI-powered insights based on real call data
  app.get(
    "/api/calls/ai-insights",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const timeFilter = req.query.timeFilter as
          | "hour"
          | "today"
          | "two_days"
          | "week"
          | undefined;

        const insights = await aiInsightsService.generateInsights(
          userId,
          timeFilter,
        );
        res.json(insights);
      } catch (error) {
        console.error("Error generating AI insights:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la génération des insights IA" });
      }
    },
  );

  // Get deep analytics for specific KPI metric
  app.get(
    "/api/analytics/:metric",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const metric = req.params.metric as string;
        const timeFilter = req.query.timeFilter as
          | "hour"
          | "today"
          | "two_days"
          | "week"
          | undefined;

        // Validate metric parameter
        const validMetrics = ["volume", "conversion", "timeslots", "duration"];
        if (!validMetrics.includes(metric)) {
          return res.status(400).json({
            message: `Métrique invalide. Valeurs acceptées: ${validMetrics.join(", ")}`,
          });
        }

        // Dispatch to appropriate service method
        let insight;
        switch (metric) {
          case "volume":
            insight = await aiAnalyticsService.analyzeCallVolume(
              userId,
              timeFilter,
            );
            break;
          case "conversion":
            insight = await aiAnalyticsService.analyzeConversionRate(
              userId,
              timeFilter,
            );
            break;
          case "timeslots":
            insight = await aiAnalyticsService.analyzeTimeSlots(
              userId,
              timeFilter,
            );
            break;
          case "duration":
            insight = await aiAnalyticsService.analyzeAverageDuration(
              userId,
              timeFilter,
            );
            break;
        }

        res.json(insight);
      } catch (error) {
        console.error(
          `Error generating ${req.params.metric} analytics:`,
          error,
        );
        res
          .status(500)
          .json({ message: "Erreur lors de l'analyse approfondie" });
      }
    },
  );

  // Get calls list with filters
  app.get(
    "/api/calls",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const timeFilter = req.query.timeFilter as
          | "hour"
          | "today"
          | "two_days"
          | "week"
          | undefined;
        const statusFilter = req.query.statusFilter as string | undefined;
        const appointmentsOnly = req.query.appointmentsOnly === "true";

        const calls = await storage.getCalls(userId, {
          timeFilter,
          statusFilter,
          appointmentsOnly,
        });
        res.json(calls);
      } catch (error) {
        console.error("Error fetching calls:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la récupération des appels" });
      }
    },
  );

  // Get call detail by ID
  app.get(
    "/api/calls/:id",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const callId = req.params.id;

        const call = await storage.getCallById(callId, userId);
        if (!call) {
          return res.status(404).json({ message: "Appel non trouvé" });
        }

        res.json(call);
      } catch (error) {
        console.error("Error fetching call detail:", error);
        res.status(500).json({
          message: "Erreur lors de la récupération du détail de l'appel",
        });
      }
    },
  );

  // Get chart data for visualizations
  app.get(
    "/api/calls/chart-data",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const timeFilter = req.query.timeFilter as
          | "hour"
          | "today"
          | "two_days"
          | "week"
          | undefined;

        const chartData = await storage.getChartData(userId, timeFilter);
        res.json(chartData);
      } catch (error) {
        console.error("Error fetching chart data:", error);
        res.status(500).json({
          message: "Erreur lors de la récupération des données de graphique",
        });
      }
    },
  );

  // ===== ACCOUNT MANAGEMENT ROUTES =====

  // Change email
  app.post(
    "/api/account/change-email",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const { newEmail, password } = req.body;

        // Validate input
        const changeEmailSchema = z.object({
          newEmail: z.string().email("Email invalide"),
          password: z.string().min(1, "Mot de passe requis"),
        });
        const data = changeEmailSchema.parse({ newEmail, password });

        // Get current user
        const user = await storage.getUserById(userId);
        if (!user) {
          return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        // Verify password
        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ message: "Mot de passe incorrect" });
        }

        // Check if new email already exists
        const existingUser = await storage.getUserByEmail(data.newEmail);
        if (existingUser && existingUser.id !== userId) {
          return res
            .status(400)
            .json({ message: "Cet email est déjà utilisé" });
        }

        // Update email
        await storage.updateUserEmail(userId, data.newEmail);

        res.json({ message: "Email mis à jour avec succès" });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error changing email:", error);
        res.status(500).json({ message: "Erreur lors du changement d'email" });
      }
    },
  );

  // Change password
  app.post(
    "/api/account/change-password",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const { currentPassword, newPassword } = req.body;

        // Validate input
        const changePasswordSchema = z.object({
          currentPassword: z.string().min(1, "Mot de passe actuel requis"),
          newPassword: z
            .string()
            .min(
              8,
              "Le nouveau mot de passe doit contenir au moins 8 caractères",
            ),
        });
        const data = changePasswordSchema.parse({
          currentPassword,
          newPassword,
        });

        // Get current user
        const user = await storage.getUserById(userId);
        if (!user) {
          return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        // Verify current password
        const isPasswordValid = await comparePassword(
          data.currentPassword,
          user.password,
        );
        if (!isPasswordValid) {
          return res
            .status(401)
            .json({ message: "Mot de passe actuel incorrect" });
        }

        // Hash and update new password
        const hashedPassword = await hashPassword(data.newPassword);
        await storage.updateUserPassword(userId, hashedPassword);

        // Notify user about password change
        await notifyPasswordChanged(storage, userId);

        res.json({ message: "Mot de passe mis à jour avec succès" });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error changing password:", error);
        res
          .status(500)
          .json({ message: "Erreur lors du changement de mot de passe" });
      }
    },
  );

  // Delete account
  app.post("/api/account/delete", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { password } = req.body;

      // Validate input
      const deleteAccountSchema = z.object({
        password: z.string().min(1, "Mot de passe requis"),
      });
      const data = deleteAccountSchema.parse({ password });

      // Get current user
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      // Verify password
      const isPasswordValid = await comparePassword(
        data.password,
        user.password,
      );
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Mot de passe incorrect" });
      }

      // Cancel Stripe subscription if exists
      if (user.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch (stripeError) {
          console.error("Error canceling Stripe subscription:", stripeError);
          // Continue with account deletion even if Stripe fails
        }
      }

      // Delete user account
      await storage.deleteUser(userId);

      // Clear session
      if (req.logout) {
        req.logout(() => {
          res.json({ message: "Compte supprimé avec succès" });
        });
      } else {
        res.json({ message: "Compte supprimé avec succès" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Error deleting account:", error);
      res
        .status(500)
        .json({ message: "Erreur lors de la suppression du compte" });
    }
  });

  // Get API key status (never return the actual key)
  app.get(
    "/api/account/api-key",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const user = await storage.getUserById(userId);

        if (!user) {
          return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        // SECURITY: Never return the actual API key - only return if it exists
        res.json({
          hasApiKey: !!user.apiKeyHash,
          message: user.apiKeyHash
            ? "Clé API configurée. Pour des raisons de sécurité, elle ne peut pas être affichée à nouveau."
            : "Aucune clé API configurée",
        });
      } catch (error) {
        console.error("Error fetching API key status:", error);
        res.status(500).json({
          message: "Erreur lors de la récupération du statut de la clé API",
        });
      }
    },
  );

  // Regenerate API key (returns plain text key ONCE)
  app.post(
    "/api/account/api-key/regenerate",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const { apiKey, apiKeyHash } = await storage.regenerateApiKey(userId);

        // SECURITY: Return the plain text key ONCE - it will never be shown again
        res.json({
          message:
            "Clé API régénérée avec succès. Copiez-la maintenant, elle ne sera plus affichée.",
          apiKey, // Plain text - shown ONLY this one time
          warning:
            "⚠️ Conservez cette clé en sécurité. Elle ne sera plus jamais affichée.",
        });
      } catch (error) {
        console.error("Error regenerating API key:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la régénération de la clé API" });
      }
    },
  );

  // Get payment history
  app.get(
    "/api/account/payments",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Get current user
        const user = await storage.getUserById(userId);
        if (!user || !user.stripeCustomerId) {
          return res.json([]);
        }

        // Fetch payment history from Stripe
        const charges = await stripe.charges.list({
          customer: user.stripeCustomerId,
          limit: 10,
        });

        // Format payments for frontend
        const payments = charges.data.map((charge) => ({
          id: charge.id,
          amount: charge.amount,
          created: charge.created,
          status: charge.status,
          description: charge.description,
        }));

        res.json(payments);
      } catch (error) {
        console.error("Error fetching payment history:", error);
        res.status(500).json({
          message:
            "Erreur lors de la récupération de l'historique des paiements",
        });
      }
    },
  );

  // Get current payment method
  app.get(
    "/api/account/payment-method",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Get current user
        const user = await storage.getUserById(userId);
        if (!user || !user.stripeCustomerId) {
          return res.json(null);
        }

        // Fetch customer payment methods
        try {
          const paymentMethods = await stripe.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: "card",
            limit: 1,
          });

          if (paymentMethods.data.length === 0) {
            return res.json(null);
          }

          const card = paymentMethods.data[0].card;
          if (!card) {
            return res.json(null);
          }

          // Return formatted payment method info
          res.json({
            brand: card.brand,
            last4: card.last4,
            expMonth: card.exp_month,
            expYear: card.exp_year,
          });
        } catch (stripeError: any) {
          // If customer doesn't exist in Stripe or other Stripe error, return null gracefully
          console.warn("Stripe payment method fetch failed for customer:", {
            customerId: user.stripeCustomerId,
            userId: user.id,
            error: stripeError.message,
            action: "returning_null",
          });
          return res.json(null);
        }
      } catch (error) {
        console.error("Error fetching payment method:", error);
        res.status(500).json({
          message: "Erreur lors de la récupération de la méthode de paiement",
        });
      }
    },
  );

  // Create Stripe Customer Portal session
  app.post(
    "/api/account/create-portal-session",
    requireAuth,
    requireVerified,
    requireSubscription,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Get current user
        const user = await storage.getUserById(userId);
        if (!user || !user.stripeCustomerId) {
          return res
            .status(400)
            .json({ message: "Aucun client Stripe associé" });
        }

        // Get return URL from request or use default
        const returnUrl =
          process.env.NODE_ENV === "production"
            ? "https://your-domain.com/account"
            : `${req.protocol}://${req.get("host")}/account`;

        try {
          // Create portal session with payment method update flow
          const session = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: returnUrl,
            flow_data: {
              type: "payment_method_update",
            },
          });

          res.json({ url: session.url });
        } catch (stripeError: any) {
          console.error("Stripe portal session creation failed:", {
            customerId: user.stripeCustomerId,
            userId: user.id,
            error: stripeError.message,
            type: stripeError.type,
          });
          return res.status(400).json({
            message:
              "Impossible de créer la session. Veuillez réessayer ou contacter le support.",
          });
        }
      } catch (error) {
        console.error("Error creating portal session:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la création de la session portal" });
      }
    },
  );

  // ============================
  // Notifications Routes
  // ============================

  // Validation schemas for notifications
  const getNotificationsQuerySchema = z.object({
    timeFilter: z
      .enum(["day", "two_days", "three_days", "week", "month"])
      .optional(),
    typeFilter: z
      .enum([
        "daily_summary",
        "failed_calls",
        "active_call",
        "password_changed",
        "payment_updated",
        "subscription_renewed",
        "subscription_created",
        "subscription_expired",
        "subscription_expiring_soon",
      ])
      .optional(),
    isRead: z.enum(["true", "false"]).optional(),
  });

  const notificationIdParamSchema = z.object({
    id: z.string().uuid("ID invalide"),
  });

  // Get all notifications with filters
  app.get(
    "/api/notifications",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Validate query parameters
        const queryValidation = getNotificationsQuerySchema.safeParse(
          req.query,
        );
        if (!queryValidation.success) {
          return res.status(400).json({
            message: queryValidation.error.errors[0].message,
          });
        }

        const { timeFilter, typeFilter, isRead } = queryValidation.data;
        const filters: any = {};

        if (timeFilter) {
          filters.timeFilter = timeFilter;
        }

        if (typeFilter) {
          filters.typeFilter = typeFilter;
        }

        if (isRead !== undefined) {
          filters.isRead = isRead === "true";
        }

        const notifications = await storage.getNotifications(userId, filters);
        res.json(notifications);
      } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({
          message: "Erreur lors de la récupération des notifications",
        });
      }
    },
  );

  // Create notification
  app.post(
    "/api/notifications",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Validate notification data
        const validation = insertNotificationSchema.safeParse({
          ...req.body,
          userId,
        });

        if (!validation.success) {
          return res.status(400).json({
            message: validation.error.errors[0].message,
          });
        }

        const notification = await storage.createNotification(validation.data);
        res.status(201).json(notification);
      } catch (error) {
        console.error("Error creating notification:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la création de la notification" });
      }
    },
  );

  // Get unread notifications count
  app.get(
    "/api/notifications/unread-count",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const count = await storage.getUnreadNotificationsCount(userId);
        res.json({ count });
      } catch (error) {
        console.error("Error fetching unread count:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la récupération du compteur" });
      }
    },
  );

  // Mark all notifications as read
  app.post(
    "/api/notifications/mark-all-read",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        await storage.markAllNotificationsAsRead(userId);
        res.json({
          message: "Toutes les notifications ont été marquées comme lues",
        });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la mise à jour des notifications" });
      }
    },
  );

  // Mark notification as read
  app.patch(
    "/api/notifications/:id/read",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Validate ID parameter
        const paramValidation = notificationIdParamSchema.safeParse(req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: paramValidation.error.errors[0].message,
          });
        }

        const { id } = paramValidation.data;

        // Verify notification belongs to user
        const notification = await storage.getNotificationById(id, userId);
        if (!notification) {
          return res.status(404).json({ message: "Notification non trouvée" });
        }

        await storage.markNotificationAsRead(id, userId);
        res.json({ message: "Notification marquée comme lue" });
      } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({
          message: "Erreur lors de la mise à jour de la notification",
        });
      }
    },
  );

  // Delete notification
  app.delete(
    "/api/notifications/:id",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Validate ID parameter
        const paramValidation = notificationIdParamSchema.safeParse(req.params);
        if (!paramValidation.success) {
          return res.status(400).json({
            message: paramValidation.error.errors[0].message,
          });
        }

        const { id } = paramValidation.data;

        // Verify notification belongs to user
        const notification = await storage.getNotificationById(id, userId);
        if (!notification) {
          return res.status(404).json({ message: "Notification non trouvée" });
        }

        await storage.deleteNotification(id, userId);
        res.json({ message: "Notification supprimée" });
      } catch (error) {
        console.error("Error deleting notification:", error);
        res.status(500).json({
          message: "Erreur lors de la suppression de la notification",
        });
      }
    },
  );

  // Get notification preferences
  app.get(
    "/api/notifications/preferences",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        let preferences = await storage.getNotificationPreferences(userId);

        // If no preferences exist, create default ones
        if (!preferences) {
          preferences = await storage.upsertNotificationPreferences(userId, {
            dailySummaryEnabled: true,
            failedCallsEnabled: true,
            activeCallEnabled: true,
            subscriptionAlertsEnabled: true,
          });
        }

        res.json(preferences);
      } catch (error) {
        console.error("Error fetching notification preferences:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la récupération des préférences" });
      }
    },
  );

  // Update notification preferences
  app.patch(
    "/api/notifications/preferences",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Validate input
        const schema = z.object({
          dailySummaryEnabled: z.boolean().optional(),
          failedCallsEnabled: z.boolean().optional(),
          activeCallEnabled: z.boolean().optional(),
          subscriptionAlertsEnabled: z.boolean().optional(),
        });

        const data = schema.parse(req.body);

        const preferences = await storage.upsertNotificationPreferences(
          userId,
          data,
        );
        res.json(preferences);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Error updating notification preferences:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la mise à jour des préférences" });
      }
    },
  );

  // ===== PUSH NOTIFICATION ROUTES =====

  // Subscribe to push notifications
  app.post(
    "/api/push/subscribe",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Validate subscription data
        const schema = z.object({
          subscription: z.object({
            endpoint: z.string().url(),
            keys: z.object({
              p256dh: z.string(),
              auth: z.string(),
            }),
            expirationTime: z.number().nullable().optional(),
          }),
        });

        const { subscription } = schema.parse(req.body);

        // Store the subscription
        await storage.createPushSubscription({
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          expirationTime: subscription.expirationTime 
            ? new Date(subscription.expirationTime) 
            : null,
          isActive: true,
        });

        console.log(`[Push] New subscription for user ${userId}`);
        res.json({ success: true, message: "Subscription enregistrée" });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Données de subscription invalides" });
        }
        console.error("Error saving push subscription:", error);
        res.status(500).json({ message: "Erreur lors de l'enregistrement" });
      }
    },
  );

  // Unsubscribe from push notifications
  app.post(
    "/api/push/unsubscribe",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const { endpoint } = req.body;

        if (endpoint) {
          await storage.deletePushSubscription(endpoint);
        } else {
          await storage.deletePushSubscriptionsByUserId(userId);
        }

        console.log(`[Push] Unsubscribed user ${userId}`);
        res.json({ success: true, message: "Désinscription effectuée" });
      } catch (error) {
        console.error("Error removing push subscription:", error);
        res.status(500).json({ message: "Erreur lors de la désinscription" });
      }
    },
  );

  // Get push subscription status
  app.get(
    "/api/push/status",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const subscriptions = await storage.getPushSubscriptions(userId);

        res.json({
          isSubscribed: subscriptions.length > 0,
          subscriptionCount: subscriptions.length,
          activeCount: subscriptions.filter(s => s.isActive).length,
        });
      } catch (error) {
        console.error("Error getting push status:", error);
        res.status(500).json({ message: "Erreur lors de la récupération du statut" });
      }
    },
  );

  // Send test notification (for debugging)
  app.post(
    "/api/push/test",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        const result = await pushNotificationService.sendToUser(userId, {
          title: "Test SpeedAI",
          body: "Ceci est une notification de test. Tout fonctionne correctement!",
          icon: "/speedai-icon-192.png",
          tag: "test",
          data: {
            type: "system",
            url: "/dashboard",
          },
        }, { skipAntiSpam: true });

        if (result.sent > 0) {
          res.json({ success: true, message: "Notification de test envoyée", ...result });
        } else if (result.skipped.length > 0) {
          res.json({ success: false, message: result.skipped.join(", "), ...result });
        } else {
          res.json({ success: false, message: "Aucune notification envoyée", ...result });
        }
      } catch (error) {
        console.error("Error sending test notification:", error);
        res.status(500).json({ message: "Erreur lors de l'envoi de la notification" });
      }
    },
  );

  // ===== MONTHLY REPORTS ROUTES =====

  // Get list of monthly reports for current user
  app.get("/api/reports", requireAuth, requireVerified, async (req, res) => {
    try {
      const userId = req.user!.id;
      const reports = await storage.getMonthlyReports(userId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching monthly reports:", error);
      res
        .status(500)
        .json({ message: "Erreur lors de la récupération des rapports" });
    }
  });

  // Download a specific monthly report PDF
  app.get(
    "/api/reports/:id/download",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;
        const reportId = req.params.id;

        // Get report and verify ownership
        const report = await storage.getMonthlyReportById(reportId, userId);

        if (!report) {
          return res.status(404).json({ message: "Rapport introuvable" });
        }

        // Read PDF file
        const pdfBuffer = await fileStorage.read(report.pdfPath);

        // Set headers for PDF download
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="Rapport-Mensuel-${reportId}.pdf"`,
        );
        res.send(pdfBuffer);
      } catch (error) {
        console.error("Error downloading report:", error);
        res
          .status(500)
          .json({ message: "Erreur lors du téléchargement du rapport" });
      }
    },
  );

  // ===== WEBHOOK ROUTES (API Key Authentication) =====

  // N8N Webhook - Create a call from external automation with rich data
  // Route: POST /api/webhooks/n8n
  // Auth: Bearer token (API key)
  // Body: Full N8N payload with all call details, metadata, and analytics
  app.post("/api/webhooks/n8n", requireApiKey, async (req, res) => {
    try {
      const userId = req.user!.id;

      // Validate incoming data using shared schema
      const data = n8nCallWebhookSchema.parse(req.body);
      const meta = data.metadata || {};

      console.log(`📞 N8N Webhook: Nouvel appel reçu pour user ${userId}`, {
        phoneNumber: data.phoneNumber,
        status: data.status,
        event_type: data.event_type || meta.event_type,
        call_id: data.call_id,
        hasMetadata: !!data.metadata,
      });

      // Build comprehensive call data from all fields
      const callData: any = {
        userId,
        
        // Basic call info
        phoneNumber: data.phoneNumber,
        status: data.status,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        duration: data.duration,
        
        // External references
        callId: data.call_id,
        agentId: data.agent_id,
        
        // Call type and event
        eventType: data.event_type || meta.event_type,
        
        // Call outcome
        callAnswered: data.call_answered,
        isOutOfScope: data.is_out_of_scope,
        conversionResult: data.conversion_result,
        callSuccessful: data.call_successful,
        disconnectionReason: data.disconnection_reason,
        
        // Content
        summary: data.summary,
        transcript: data.transcript,
        tags: data.tags,
        
        // Appointment details
        appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : undefined,
        appointmentHour: data.appointmentHour,
        appointmentDayOfWeek: data.appointmentDayOfWeek,
        bookingDelayDays: data.booking_delay_days,
        isLastMinute: data.is_last_minute,
        groupCategory: data.group_category || meta.group_category,
        
        // Client info from metadata
        clientName: meta.client_name,
        clientEmail: meta.client_email,
        clientMood: meta.client_mood,
        isReturningClient: meta.is_returning_client,
        
        // Business context from metadata
        agencyName: meta.agency_name,
        companyName: meta.company_name,
        serviceType: meta.service_type,
        nbPersonnes: meta.nb_personnes,
        
        // Call quality metrics from metadata
        bookingConfidence: meta.booking_confidence,
        callQuality: meta.call_quality,
        languageDetected: meta.language_detected,
        
        // Analysis fields from metadata
        questionsAsked: meta.questions_asked,
        objections: meta.objections,
        keywords: meta.keywords,
        painPoints: meta.pain_points,
        compliments: meta.compliments,
        upsellAccepted: meta.upsell_accepted,
        competitorMentioned: meta.competitor_mentioned,
        
        // Special cases from metadata
        preferences: meta.preferences,
        specialOccasion: meta.special_occasion,
        originalDate: meta.original_date,
        originalTime: meta.original_time,
        modificationReason: meta.modification_reason,
        cancellationReason: meta.cancellation_reason,
        cancellationTime: meta.cancellation_time ? new Date(meta.cancellation_time) : undefined,
        
        // Technical from metadata
        calendarId: meta.calendar_id,
        timezone: meta.timezone,
        recordingUrl: meta.recording_url,
        collectedAt: data.collected_at ? new Date(data.collected_at) : new Date(),
        
        // Store full metadata for any additional fields
        metadata: data.metadata,
      };
      
      // Remove undefined values to avoid DB issues
      Object.keys(callData).forEach(key => {
        if (callData[key] === undefined) {
          delete callData[key];
        }
      });
      
      const call = await storage.createCall(callData);

      // Auto-create or update SpeedAI client record based on agent_id
      if (data.agent_id) {
        await storage.createOrUpdateSpeedaiClient(data.agent_id, {
          businessName: meta.company_name || meta.agency_name,
          businessType: meta.service_type,
          contactEmail: meta.client_email, // Will be updated with most recent
        });
        console.log(`🏢 SpeedAI Client: Updated/Created for agent_id: ${data.agent_id}`);
      }

      console.log(`✅ N8N Webhook: Appel créé avec succès - ID: ${call.id}`, {
        eventType: callData.eventType,
        conversionResult: callData.conversionResult,
        clientName: callData.clientName,
        hasTranscript: !!callData.transcript,
        agentId: data.agent_id,
      });

      res.status(201).json({
        success: true,
        call_id: call.id,
        stored_fields: Object.keys(callData).length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ N8N Webhook: Validation error:", error.errors);
        return res.status(400).json({
          success: false,
          error: "Données invalides",
          details: error.errors,
        });
      }
      console.error("❌ N8N Webhook error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ N8N Webhook error details:", errorMessage);
      res.status(500).json({
        success: false,
        error: "Erreur lors de la création de l'appel",
        details: errorMessage,
      });
    }
  });

  // ===== ADMIN ROUTES (Require Admin Authentication) =====

  // Import requireAdmin
  const { requireAdmin } = await import("./admin-auth");

  // Get all users with stats (with optional email search)
  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { search } = req.query;
      const searchQuery =
        typeof search === "string" ? search.toLowerCase().trim() : "";

      const users = await storage.getAllUsers();

      // Filter by email if search query provided
      const filteredUsers = searchQuery
        ? users.filter((user) => user.email.toLowerCase().includes(searchQuery))
        : users;

      // Get stats for each user
      const usersWithStats = await Promise.all(
        filteredUsers.map(async (user) => {
          const stats = await storage.getUserStats(user.id);
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            subscriptionStatus: user.subscriptionStatus || "none",
            accountStatus: (user as any).accountStatus || "active",
            plan: (user as any).plan || null,
            countdownEnd: (user as any).countdownEnd || null,
            createdAt: user.createdAt,
            ...stats,
          };
        }),
      );

      res.json(usersWithStats);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res
        .status(500)
        .json({ message: "Erreur lors de la récupération des utilisateurs" });
    }
  });

  // Suspend user account
  app.post(
    "/api/admin/users/:id/suspend",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const user = await storage.suspendUser(id);

        if (!user) {
          return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        res.json({ message: "Compte suspendu", user: toPublicUser(user) });
      } catch (error: any) {
        console.error("Error suspending user:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la suspension du compte" });
      }
    },
  );

  // Activate user account
  app.post(
    "/api/admin/users/:id/activate",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const user = await storage.activateUser(id);

        if (!user) {
          return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        res.json({ message: "Compte activé", user: toPublicUser(user) });
      } catch (error: any) {
        console.error("Error activating user:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de l'activation du compte" });
      }
    },
  );

  // Assign plan to user (admin only)
  app.post(
    "/api/admin/users/:id/assign-plan",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { plan } = req.body;

        // Validate plan value
        const validPlans = [null, "basic", "standard", "premium"];
        if (!validPlans.includes(plan)) {
          return res.status(400).json({ message: "Plan invalide" });
        }

        const user = await storage.assignPlan(id, plan);

        if (!user) {
          return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        res.json({
          message: "Plan assigné avec succès",
          user: toPublicUser(user),
        });
      } catch (error: any) {
        console.error("Error assigning plan:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de l'assignation du plan" });
      }
    },
  );

  // Delete user account (admin only)
  app.delete(
    "/api/admin/users/:id",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const { id } = req.params;
        const currentUser = (req as any).user;

        // Prevent admin from deleting themselves
        if (id === currentUser.id) {
          return res.status(400).json({
            message: "Vous ne pouvez pas supprimer votre propre compte",
          });
        }

        await storage.deleteUser(id);
        res.json({ message: "Compte supprimé avec succès" });
      } catch (error: any) {
        console.error("Error deleting user:", error);
        res
          .status(500)
          .json({ message: "Erreur lors de la suppression du compte" });
      }
    },
  );

  // Get N8N logs for all clients (admin only)
  app.get("/api/admin/logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId, event, startDate, limit = "100" } = req.query;

      const baseDir = path.join(process.cwd(), "reports", "logs");

      // Check if logs directory exists
      if (!fs.existsSync(baseDir)) {
        return res.json({ logs: [], total: 0, hasMore: false });
      }

      const allLogs: any[] = [];

      // If userId filter is provided, only read that user's logs
      if (userId && typeof userId === "string") {
        const userDir = path.join(baseDir, userId);

        if (fs.existsSync(userDir)) {
          const files = fs.readdirSync(userDir);

          for (const file of files) {
            if (file.endsWith(".json")) {
              try {
                const filePath = path.join(userDir, file);
                const content = fs.readFileSync(filePath, "utf-8");
                const logData = JSON.parse(content);

                // Apply event filter
                if (
                  event &&
                  typeof event === "string" &&
                  logData.event !== event
                ) {
                  continue;
                }

                // Apply date filter
                if (startDate && typeof startDate === "string") {
                  const logDate = new Date(logData.timestamp);
                  const filterDate = new Date(startDate);
                  if (logDate < filterDate) {
                    continue;
                  }
                }

                allLogs.push({
                  ...logData,
                  fileName: file,
                  userId: userId,
                });
              } catch (err) {
                console.error(`Error reading log file ${file}:`, err);
              }
            }
          }
        }
      } else {
        // Read logs from all clients
        const clientDirs = fs.readdirSync(baseDir);

        for (const clientId of clientDirs) {
          const clientPath = path.join(baseDir, clientId);

          if (fs.statSync(clientPath).isDirectory()) {
            const files = fs.readdirSync(clientPath);

            for (const file of files) {
              if (file.endsWith(".json")) {
                try {
                  const filePath = path.join(clientPath, file);
                  const content = fs.readFileSync(filePath, "utf-8");
                  const logData = JSON.parse(content);

                  // Apply event filter
                  if (
                    event &&
                    typeof event === "string" &&
                    logData.event !== event
                  ) {
                    continue;
                  }

                  // Apply date filter
                  if (startDate && typeof startDate === "string") {
                    const logDate = new Date(logData.timestamp);
                    const filterDate = new Date(startDate);
                    if (logDate < filterDate) {
                      continue;
                    }
                  }

                  allLogs.push({
                    ...logData,
                    fileName: file,
                    userId: clientId,
                  });
                } catch (err) {
                  console.error(`Error reading log file ${file}:`, err);
                }
              }
            }
          }
        }
      }

      // Sort by timestamp descending (most recent first)
      allLogs.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // Apply pagination
      const limitNum = parseInt(limit as string) || 100;
      const paginatedLogs = allLogs.slice(0, limitNum);

      res.json({
        logs: paginatedLogs,
        total: allLogs.length,
        hasMore: allLogs.length > limitNum,
      });
    } catch (error: any) {
      console.error("Error fetching N8N logs:", error);
      res
        .status(500)
        .json({ message: "Erreur lors de la récupération des logs" });
    }
  });

  // Get all clients data (admin only) - Comprehensive overview for N8N integration
  app.get(
    "/api/admin/clients-data",
    requireAuth,
    requireAdmin,
    async (req, res) => {
      try {
        const currentUser = (req as any).user;
        const { client_id } = req.query;

        // Security logging
        console.log(
          `[ADMIN ACCESS] Client Data viewed by: ${currentUser.email} at ${new Date().toISOString()}`,
        );

        // Get all users from database
        let users = await storage.getAllUsers();

        // Filter by client_id if provided
        if (client_id && typeof client_id === "string") {
          users = users.filter((u) => u.id === client_id);
        }

        // Sort by createdAt descending (most recent first)
        users.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

        // Build comprehensive client data
        const baseLogsDir = path.join(process.cwd(), "reports", "logs");
        const frontendUrl =
          process.env.FRONTEND_URL ||
          process.env.REPLIT_DEV_DOMAIN ||
          "http://localhost:5000";

        const clientsData = users.map((user) => {
          let latestLog = null;
          let latestLogDate = null;

          // Safely check if user has log directory and read latest log
          try {
            const clientLogDir = path.join(baseLogsDir, user.id);

            if (fs.existsSync(clientLogDir)) {
              const files = fs.readdirSync(clientLogDir);
              const logFiles = files.filter((f) => f.endsWith(".json"));

              if (logFiles.length > 0) {
                // Find the most recent log file by modification time
                let mostRecentFile = null;
                let mostRecentTime = 0;

                for (const file of logFiles) {
                  try {
                    const filePath = path.join(clientLogDir, file);
                    const stats = fs.statSync(filePath);
                    if (stats.mtimeMs > mostRecentTime) {
                      mostRecentTime = stats.mtimeMs;
                      mostRecentFile = file;
                    }
                  } catch (fileErr) {
                    // Skip unreadable files, continue with others
                    console.error(
                      `Error reading log file ${file} for client ${user.id}:`,
                      fileErr,
                    );
                  }
                }

                if (mostRecentFile) {
                  latestLog = mostRecentFile;
                  latestLogDate = new Date(mostRecentTime).toISOString();
                }
              }
            }
          } catch (err) {
            // Log error but continue processing other clients
            console.error(`Error processing logs for client ${user.id}:`, err);
          }

          return {
            client_id: user.id,
            email: user.email,
            router_url: `${frontendUrl}/api/logs/router/${user.id}`,
            api_key_hash: user.apiKeyHash || null,
            latest_log: latestLog,
            latest_log_date: latestLogDate,
            accountStatus: user.accountStatus,
            subscriptionStatus: user.subscriptionStatus || null,
            createdAt: user.createdAt,
          };
        });

        res.json(clientsData);
      } catch (error: any) {
        console.error("Error fetching clients data:", error);
        res.status(500).json({
          message: "Erreur lors de la récupération des données clients",
        });
      }
    },
  );

  // ===== N8N LOGS ROUTER - MULTI-CLIENT INFRASTRUCTURE =====

  /**
   * ✅ Route dynamique pour recevoir les logs de chaque client via N8N
   *
   * Bénéfices :
   * - 🔹 Multi-clients : Chaque client a son propre "canal" de réception
   * - 🔹 Traçabilité : Chaque appel est horodaté et stocké
   * - 🔹 Scalabilité : Infrastructure prête pour CRM, API tierces
   * - 🔹 Automatisation : N8N envoie automatiquement vers le bon espace
   * - 🔹 Sécurité future : Token unique par client (TODO: implémenter auth)
   *
   * Exemple d'appel N8N :
   * POST https://vocaledash.com/api/logs/router/speedai_001
   * Body JSON = { timestamp, event, data, ... }
   *
   * TODO: Sécuriser avec API key ou token par client
   * TODO: Optionnel - Sauvegarder aussi en base PostgreSQL pour analytics
   */
  app.post("/api/logs/router/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      const data = req.body;

      // Validation basique
      if (!clientId) {
        return res.status(400).json({
          success: false,
          message: "Client ID manquant dans l'URL.",
        });
      }

      console.log(
        `🧾 Log N8N reçu pour le client ${clientId}:`,
        JSON.stringify(data).substring(0, 200) + "...",
      );

      // Création de l'arborescence : /reports/logs/{clientId}/
      const baseDir = path.join(process.cwd(), "reports", "logs");
      const clientDir = path.join(baseDir, clientId);

      // Crée les dossiers s'ils n'existent pas
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
        console.log(`[N8N Logs] Dossier base créé: ${baseDir}`);
      }
      if (!fs.existsSync(clientDir)) {
        fs.mkdirSync(clientDir, { recursive: true });
        console.log(`[N8N Logs] Dossier client créé: ${clientDir}`);
      }

      // Sauvegarde du log sous forme de fichier JSON horodaté
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = path.join(clientDir, `log-${timestamp}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

      console.log(`✅ Log N8N enregistré: ${filePath}`);

      res.status(200).json({
        success: true,
        message: `Log enregistré avec succès pour le client ${clientId}`,
        file: filePath,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("❌ Erreur réception logs N8N:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * ✅ Route pour lire les logs N8N d'un client
   *
   * GET /api/logs/client/:id
   * Query params: startDate, endDate, event, limit, offset
   *
   * Sécurité :
   * - Authentifié (requireAuth)
   * - Utilisateur peut seulement lire ses propres logs (req.user.id === :id)
   * - Admin peut lire les logs de n'importe quel client
   *
   * Réponse : { logs: N8NLogWithMetadata[], total: number, hasMore: boolean }
   */
  app.get("/api/logs/client/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = (req as any).user;

      // Validation de sécurité : utilisateur peut uniquement lire ses propres logs
      // sauf s'il est admin
      if (currentUser.id !== id && currentUser.role !== "admin") {
        return res.status(403).json({
          message: "Vous n'êtes pas autorisé à accéder à ces logs",
        });
      }

      // Validation des filtres avec Zod
      const filtersResult = n8nLogFiltersSchema.safeParse({
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        event: req.query.event as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      });

      if (!filtersResult.success) {
        return res.status(400).json({
          message: "Paramètres de filtrage invalides",
          errors: filtersResult.error.flatten(),
        });
      }

      const filters = filtersResult.data;

      // Chemin du dossier des logs du client
      const clientDir = path.join(process.cwd(), "reports", "logs", id);

      // Vérifier si le dossier existe
      if (!fs.existsSync(clientDir)) {
        return res.json({
          logs: [],
          total: 0,
          hasMore: false,
        });
      }

      // Lire tous les fichiers du dossier
      const files = await fs.promises.readdir(clientDir);

      // Filtrer uniquement les fichiers JSON avec pattern log-*.json
      const logFiles = files
        .filter((file) => file.startsWith("log-") && file.endsWith(".json"))
        .sort()
        .reverse(); // Tri inversé pour avoir les plus récents en premier

      // Parser les logs avec gestion d'erreurs
      const parsedLogs: Array<{
        log: z.infer<typeof n8nLogSchema>;
        fileName: string;
        fileTimestamp: string;
      }> = [];

      for (const fileName of logFiles) {
        try {
          const filePath = path.join(clientDir, fileName);
          const fileContent = await fs.promises.readFile(filePath, "utf-8");
          const rawLog = JSON.parse(fileContent);

          // Valider avec Zod
          const validationResult = n8nLogSchema.safeParse(rawLog);

          if (validationResult.success) {
            // Extraire le timestamp du nom de fichier (log-2025-11-11T22-36-32-613Z.json)
            const fileTimestamp = fileName
              .replace("log-", "")
              .replace(".json", "")
              .replace(/-/g, ":");

            parsedLogs.push({
              log: validationResult.data,
              fileName,
              fileTimestamp: fileTimestamp.replace(/:/g, "-"),
            });
          } else {
            console.warn(
              `⚠️ Log invalide ignoré: ${fileName}`,
              validationResult.error,
            );
          }
        } catch (error) {
          console.error(`❌ Erreur lecture log ${fileName}:`, error);
          // Continue avec les autres fichiers
        }
      }

      // Appliquer les filtres
      let filteredLogs = parsedLogs;

      // Filtre par date de début
      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(
          ({ log }) => new Date(log.timestamp) >= new Date(filters.startDate!),
        );
      }

      // Filtre par date de fin
      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(
          ({ log }) => new Date(log.timestamp) <= new Date(filters.endDate!),
        );
      }

      // Filtre par type d'événement
      if (filters.event) {
        filteredLogs = filteredLogs.filter(
          ({ log }) => log.event === filters.event,
        );
      }

      const total = filteredLogs.length;

      // Pagination
      const paginatedLogs = filteredLogs.slice(
        filters.offset,
        filters.offset + filters.limit,
      );

      // Transformer en format de réponse
      const logsWithMetadata = paginatedLogs.map(
        ({ log, fileName, fileTimestamp }) => ({
          ...log,
          fileName,
          fileTimestamp,
        }),
      );

      res.json({
        logs: logsWithMetadata,
        total,
        hasMore: filters.offset + filters.limit < total,
      });
    } catch (error: any) {
      console.error("❌ Erreur lecture logs N8N:", error);
      res.status(500).json({
        message: "Erreur lors de la lecture des logs",
        error: error.message,
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
