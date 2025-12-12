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
import { registerMarketingRoutes } from "./marketing-routes";
import integrationRoutes from "./integration-routes";
import { sendCardRequestEmail, sendConfirmationEmail, isEmailConfigured } from "./services/guarantee-email.service";
import { sendGuaranteeCardRequestSms, sendGuaranteeConfirmationSms, isSmsConfigured } from "./services/twilio-sms.service";

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

// Helper function to get frontend URL
function getFrontendUrl(): string {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  // In production, REPLIT_DOMAINS contains the production URL(s)
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    const productionDomain = domains.find(d => d.includes('.replit.app')) || domains[0];
    return `https://${productionDomain}`;
  }
  // In development
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'http://localhost:5000';
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== DIAGNOSTIC ENDPOINT (temporary for debugging) =====
  app.get("/api/debug/api-key-status", async (req, res) => {
    try {
      const usersWithApiKeys = await storage.getAllUsersWithApiKey();
      const dbHost = process.env.PGHOST || 'unknown';
      
      res.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        database: {
          host: dbHost.substring(0, 20) + '...',
          connected: true
        },
        usersWithApiKeys: usersWithApiKeys.length,
        users: usersWithApiKeys.map(u => ({
          email: u.email,
          hasHash: !!u.apiKeyHash,
          hashPrefix: u.apiKeyHash?.substring(0, 15) + '...',
          accountStatus: (u as any).accountStatus || 'unknown',
          subscriptionStatus: u.subscriptionStatus
        })),
        codeVersion: "2024-12-08-v2-nullable-fields"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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
      console.log("[BACKEND /api/auth/me] Full user data:", {
        userId: user.id,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        subscriptionStatus: user.subscriptionStatus,
        plan: user.plan,
        subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
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

        case "checkout.session.completed": {
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          
          // Only handle CB Guarantee sessions (mode: setup)
          if (checkoutSession.mode === 'setup') {
            console.log('🔔 [Stripe Webhook] CB Guarantee checkout completed:', checkoutSession.id);
            
            try {
              // Find the guarantee session by checkout_session_id
              const guaranteeSession = await storage.getGuaranteeSessionByCheckoutSessionId(checkoutSession.id);
              
              if (!guaranteeSession) {
                console.log('⚠️ [Stripe Webhook] Guarantee session not found for checkout:', checkoutSession.id);
                // Don't fail webhook - session might have been deleted
                break;
              }
              
              // Only process pending sessions
              if (guaranteeSession.status !== 'pending') {
                console.log('ℹ️ [Stripe Webhook] Session already processed, status:', guaranteeSession.status);
                break;
              }
              
              // Retrieve setup intent to get payment method ID
              let paymentMethodId = null;
              if (checkoutSession.setup_intent) {
                try {
                  // Get config for Stripe account
                  const config = await storage.getGuaranteeConfig(guaranteeSession.userId);
                  if (config?.stripeAccountId) {
                    const setupIntent = await stripe.setupIntents.retrieve(
                      checkoutSession.setup_intent as string,
                      { stripeAccount: config.stripeAccountId }
                    );
                    paymentMethodId = setupIntent.payment_method as string;
                  }
                } catch (setupErr) {
                  console.error('⚠️ [Stripe Webhook] Error retrieving setup intent:', setupErr);
                }
              }
              
              // Update session to validated status
              const updatedSession = await storage.updateGuaranteeSession(guaranteeSession.id, {
                status: 'validated',
                validatedAt: new Date(),
                setupIntentId: checkoutSession.setup_intent as string,
                customerStripeId: checkoutSession.customer as string,
                paymentMethodId: paymentMethodId,
              });
              
              if (!updatedSession) {
                console.error('❌ [Stripe Webhook] Failed to update session:', guaranteeSession.id);
                // Still respond 200 to Stripe, but log the error
                break;
              }
              
              console.log('✅ [Stripe Webhook] Session validated:', guaranteeSession.id);
              
              // Get config for sending confirmation notifications
              const config = await storage.getGuaranteeConfig(guaranteeSession.userId);
              
              // Send confirmation email if enabled
              if (config && config.autoSendEmailOnValidation !== false && guaranteeSession.customerEmail && isEmailConfigured(config)) {
                try {
                  const emailResult = await sendConfirmationEmail({
                    config,
                    session: updatedSession,
                  });
                  console.log(`📧 [Stripe Webhook] Confirmation email ${emailResult.success ? 'sent' : 'failed'} for ${guaranteeSession.customerEmail}`);
                } catch (emailError) {
                  console.error('[Stripe Webhook] Error sending confirmation email:', emailError);
                }
              }
              
              // Send confirmation SMS if enabled (uses SpeedAI platform Twilio)
              if (config && config.autoSendSmsOnValidation && guaranteeSession.customerPhone && isSmsConfigured()) {
                try {
                  const smsResult = await sendGuaranteeConfirmationSms(
                    guaranteeSession.customerPhone,
                    guaranteeSession.customerName,
                    config.companyName || 'Établissement',
                    new Date(guaranteeSession.reservationDate),
                    guaranteeSession.reservationTime,
                    guaranteeSession.nbPersons
                  );
                  console.log(`📱 [Stripe Webhook] Confirmation SMS ${smsResult.success ? 'sent' : 'failed'} for ${guaranteeSession.customerPhone}`);
                } catch (smsError) {
                  console.error('[Stripe Webhook] Error sending confirmation SMS:', smsError);
                }
              }
              
              // Call N8N webhook to trigger Calendar booking (now that card is validated)
              const N8N_WEBHOOK_CB_VALIDEE = process.env.N8N_WEBHOOK_CB_VALIDEE;
              
              if (N8N_WEBHOOK_CB_VALIDEE) {
                try {
                  // Send ALL stored info to N8N for calendar booking
                  const n8nPayload = {
                    // ========== FLOW CONTROL FLAGS FOR N8N ==========
                    // These flags tell N8N that payment is validated and calendar can be booked
                    payment_validated: true,  // TRUE = Card validated, proceed with calendar
                    calendar_booking_allowed: true,  // TRUE = OK to book Google Calendar NOW
                    workflow_control: {
                      action_required: "BOOK_CALENDAR_NOW",
                      can_book_calendar: true,
                      reason: "Customer validated card on Stripe - proceed with calendar booking",
                      instructions: [
                        "1. Card validation CONFIRMED by Stripe",
                        "2. You can NOW book the Google Calendar event",
                        "3. After booking, call POST /api/guarantee/confirm-booking with session_id"
                      ]
                    },
                    // ================================================
                    
                    // Status
                    status: 'validated',
                    event: 'cb_validated',
                    action: 'book_calendar',
                    
                    // API key for N8N to call back the dashboard
                    api_key: process.env.N8N_MASTER_API_KEY,
                    dashboard_url: process.env.REPLIT_DEV_DOMAIN 
                      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
                      : 'https://speedai-b2b-platform-v2.replit.app',
                    
                    // Session ID
                    session_id: guaranteeSession.id,
                    
                    // Agent/Business info
                    agent_id: guaranteeSession.agentId,
                    business_type: guaranteeSession.businessType,
                    
                    // Customer info
                    customer_name: guaranteeSession.customerName,
                    customer_email: guaranteeSession.customerEmail,
                    customer_phone: guaranteeSession.customerPhone,
                    
                    // Reservation info
                    reservation_date: guaranteeSession.reservationDate,
                    reservation_time: guaranteeSession.reservationTime,
                    nb_persons: guaranteeSession.nbPersons,
                    duration: guaranteeSession.duration,
                    
                    // Calendar/Company info for Google Calendar
                    calendar_id: guaranteeSession.calendarId,
                    company_name: guaranteeSession.companyName || config?.companyName,
                    company_email: guaranteeSession.companyEmail,
                    timezone: guaranteeSession.timezone || 'Europe/Paris',
                    
                    // Garage-specific fields
                    vehicule: guaranteeSession.vehicule,
                    type_service: guaranteeSession.typeService,
                    
                    // Notification settings (for N8N to know if emails/SMS are enabled)
                    email_enabled: config ? isEmailConfigured(config) && config.autoSendEmailOnValidation !== false : false,
                    sms_enabled: config ? isSmsConfigured() && config.autoSendSmsOnValidation === true : false,
                    
                    // Timestamp
                    validated_at: updatedSession.validatedAt?.toISOString(),
                  };
                  
                  const n8nResponse = await fetch(N8N_WEBHOOK_CB_VALIDEE, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(n8nPayload),
                  });
                  
                  console.log('✅ [N8N] Webhook called for CB validation + calendar booking:', guaranteeSession.id, 'Response:', n8nResponse.status);
                  console.log('📤 [N8N] Payload sent:', JSON.stringify(n8nPayload, null, 2));
                } catch (n8nError) {
                  console.error('❌ [N8N] Error calling webhook:', n8nError);
                  // Don't fail the Stripe webhook - N8N call is non-blocking
                }
              } else {
                console.log('ℹ️ [N8N] N8N_WEBHOOK_CB_VALIDEE not configured, skipping webhook call');
              }
            } catch (cbError) {
              console.error('❌ [Stripe Webhook] Error processing CB Guarantee:', cbError);
              // Still respond 200 to prevent Stripe retries, but log the error
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

  // Simple in-memory rate limiter for push endpoints
  const pushRateLimits = new Map<string, { count: number; resetTime: number }>();
  const PUSH_RATE_LIMIT = { maxRequests: 10, windowMs: 60000 }; // 10 requests per minute
  
  function checkPushRateLimit(userId: string): boolean {
    const now = Date.now();
    const limit = pushRateLimits.get(userId);
    
    if (!limit || now > limit.resetTime) {
      pushRateLimits.set(userId, { count: 1, resetTime: now + PUSH_RATE_LIMIT.windowMs });
      return true;
    }
    
    if (limit.count >= PUSH_RATE_LIMIT.maxRequests) {
      return false;
    }
    
    limit.count++;
    return true;
  }

  // Subscribe to push notifications
  app.post(
    "/api/push/subscribe",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userId = req.user!.id;

        // Rate limiting
        if (!checkPushRateLimit(userId)) {
          return res.status(429).json({ message: "Trop de requêtes. Réessayez plus tard." });
        }

        // Validate subscription data
        const schema = z.object({
          subscription: z.object({
            endpoint: z.string().url().refine(
              url => url.startsWith('https://'),
              'Endpoint must use HTTPS'
            ),
            keys: z.object({
              p256dh: z.string().min(20, 'Invalid p256dh key'),
              auth: z.string().min(10, 'Invalid auth key'),
            }),
            expirationTime: z.number().nullable().optional(),
          }),
        });

        const { subscription } = schema.parse(req.body);

        // Store the subscription
        await storage.createPushSubscription({
          userId,
          endpoint: subscription.endpoint,
          p256dhKey: subscription.keys.p256dh,
          authKey: subscription.keys.auth,
          isActive: true,
        });

        console.log(`[Push] New subscription for user ${userId}`);
        res.json({ success: true, message: "Subscription enregistrée" });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Données de subscription invalides", errors: error.errors });
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
        }, { skipAntiSpam: true, skipQuietHours: true });

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

      // Helper to parse flexible datetime (string, number, or null)
      const parseFlexibleDate = (value: string | number | null | undefined): Date | undefined => {
        if (value === null || value === undefined) return undefined;
        if (typeof value === 'number') {
          // Detect if timestamp is in seconds or milliseconds
          const ts = value > 9999999999 ? value : value * 1000;
          return new Date(ts);
        }
        return new Date(value);
      };

      // Build comprehensive call data from all fields
      const callData: any = {
        userId,
        
        // Basic call info
        phoneNumber: data.phoneNumber,
        status: data.status,
        startTime: parseFlexibleDate(data.startTime) || new Date(), // Default to now if missing
        endTime: parseFlexibleDate(data.endTime),
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
        
        // Appointment details (nullable for non-booking calls)
        appointmentDate: parseFlexibleDate(data.appointmentDate),
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
        collectedAt: parseFlexibleDate(data.collected_at) || new Date(),
        
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

  // ===== CB GUARANTEE (ANTI NO-SHOW) ROUTES =====
  
  // Helper function to parse French date formats like "20 décembre 2025" or "2025-12-20"
  function parseFrenchDate(dateString: string): Date {
    // If it's already an ISO format, parse directly
    if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
      return new Date(dateString);
    }
    
    // French month names mapping
    const frenchMonths: { [key: string]: number } = {
      'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3,
      'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7, 'aout': 7,
      'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11, 'decembre': 11
    };
    
    // Try to parse "20 décembre 2025" format
    const frenchDateRegex = /(\d{1,2})\s+(\w+)\s+(\d{4})/i;
    const match = dateString.match(frenchDateRegex);
    
    if (match) {
      const day = parseInt(match[1], 10);
      const monthName = match[2].toLowerCase();
      const year = parseInt(match[3], 10);
      const month = frenchMonths[monthName];
      
      if (month !== undefined) {
        return new Date(year, month, day, 12, 0, 0); // Noon to avoid timezone issues
      }
    }
    
    // Fallback: try standard Date parsing
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    // If all else fails, return today's date
    console.warn(`[Guarantee] Could not parse date: "${dateString}", using today's date`);
    return new Date();
  }
  
  // Validation schemas for guarantee APIs
  const guaranteeConfigUpdateSchema = z.object({
    enabled: z.boolean().optional(),
    penaltyAmount: z.number().min(1).max(200).optional(),
    cancellationDelay: z.number().min(1).max(72).optional(),
    applyTo: z.enum(['all', 'min_persons', 'weekend']).optional(),
    minPersons: z.number().min(1).max(20).optional(),
    logoUrl: z.string().url().nullable().optional(),
    brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    senderEmail: z.string().email().nullable().optional(), // Adresse email Resend
    gmailSenderEmail: z.string().email().nullable().optional(), // Deprecated
    gmailSenderName: z.string().max(100).nullable().optional(),
    termsUrl: z.string().url().nullable().optional(),
    companyName: z.string().max(200).nullable().optional(),
    companyAddress: z.string().max(500).nullable().optional(),
    companyPhone: z.string().max(20).nullable().optional(),
    smsEnabled: z.boolean().optional(), // Toggle SMS notifications
  });

  const guaranteeSessionCreateSchema = z.object({
    reservation_id: z.string().min(1).max(200),
    customer_name: z.string().min(1).max(200),
    customer_email: z.string().email().optional(),
    customer_phone: z.string().max(20).optional(),
    nb_persons: z.number().min(1).max(100).optional().default(1),
    reservation_date: z.string().min(1), // ISO date string ou format texte "15 janvier 2025"
    reservation_time: z.string().optional(), // HH:MM
    
    // Agent/Business info (pour N8N callback)
    agent_id: z.string().optional(), // ID agent Retell
    business_type: z.string().optional(), // restaurant, garage, etc.
    
    // Infos pour créer le RDV après validation (N8N callback)
    calendar_id: z.string().optional(), // ID/email du calendrier Google
    company_name: z.string().optional(),
    company_email: z.string().email().optional(),
    timezone: z.string().default("Europe/Paris"),
    duration: z.number().int().optional(), // Durée en minutes
    
    // Champs spécifiques garage
    vehicule: z.string().optional(),
    type_service: z.string().optional(),
  });

  const guaranteeStatusUpdateSchema = z.object({
    status: z.enum(['attended', 'noshow']),
  });

  // ===== EMAIL LOOKUP ENDPOINT (N8N) =====
  // Cascading email search: external_customers → marketing_contacts
  // GET /api/lookup-email?phone=+33612345678&agent_id=xxx
  app.get("/api/lookup-email", async (req, res) => {
    try {
      const { phone, agent_id } = req.query;
      
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ 
          success: false,
          error: "phone parameter required" 
        });
      }
      
      let userId: string | undefined;
      
      if (agent_id && typeof agent_id === 'string') {
        const userWithAgent = await storage.getUserByAgentId(agent_id);
        if (userWithAgent) {
          userId = userWithAgent.id;
        }
      }
      
      const result = await storage.findEmailByPhone(phone, userId);
      
      if (result) {
        console.log(`[Lookup] Email found for ${phone}: ${result.email} (source: ${result.source})`);
        return res.json({
          success: true,
          found: true,
          email: result.email,
          name: result.name || null,
          source: result.source,
        });
      }
      
      console.log(`[Lookup] No email found for ${phone}`);
      return res.json({
        success: true,
        found: false,
        email: null,
        skip_email: true,
      });
    } catch (error: any) {
      console.error('[Lookup] Error:', error);
      res.status(500).json({ 
        success: false,
        error: "Server error" 
      });
    }
  });

  // ===== GUARANTEE PUBLIC ENDPOINTS (N8N) =====
  
  // Handle missing agent_id - return JSON error instead of HTML
  app.get("/api/guarantee/status/", (req, res) => {
    res.status(400).json({ 
      guarantee_enabled: false,
      error: "agent_id requis dans l'URL",
      example: "/api/guarantee/status/agent_xxxxx"
    });
  });
  
  // Check if guarantee is enabled for an agent (called by N8N before creating session)
  // GET /api/guarantee/status/:agent_id
  app.get("/api/guarantee/status/:agent_id", async (req, res) => {
    try {
      const { agent_id } = req.params;
      
      if (!agent_id) {
        return res.status(400).json({ 
          guarantee_enabled: false,
          error: "agent_id requis" 
        });
      }
      
      // Find user by agent_id (stored in users table or check calls table)
      // First, try to find from calls table which has agentId
      const userWithAgent = await storage.getUserByAgentId(agent_id);
      
      if (!userWithAgent) {
        return res.json({ 
          guarantee_enabled: false,
          reason: "agent_not_found"
        });
      }
      
      // Get guarantee config for this user
      const config = await storage.getGuaranteeConfig(userWithAgent.id);
      
      if (!config || !config.enabled) {
        return res.json({ 
          guarantee_enabled: false,
          reason: "disabled"
        });
      }
      
      if (!config.stripeAccountId) {
        return res.json({ 
          guarantee_enabled: false,
          reason: "stripe_not_connected"
        });
      }
      
      // Return enabled with config details
      res.json({
        guarantee_enabled: true,
        config: {
          penalty_amount: config.penaltyAmount,
          cancellation_delay: config.cancellationDelay,
          apply_to: config.applyTo,
          min_persons: config.minPersons,
          company_name: config.companyName,
        }
      });
    } catch (error: any) {
      console.error('[Guarantee] Error checking status:', error);
      res.status(500).json({ 
        guarantee_enabled: false,
        error: "Erreur serveur" 
      });
    }
  });
  
  // Get guarantee config for current user
  app.get("/api/guarantee/config", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const config = await storage.getGuaranteeConfig(userId);
      
      // Get user info for company defaults
      const user = await storage.getUser(userId);
      
      res.json({
        config: config || {
          enabled: false,
          penaltyAmount: 30,
          cancellationDelay: 24,
          applyTo: 'all',
          minPersons: 1,
          brandColor: '#C8B88A',
        },
        stripeConnected: !!config?.stripeAccountId,
        user: {
          email: user?.email,
        }
      });
    } catch (error: any) {
      console.error('[Guarantee] Error getting config:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update guarantee config
  app.put("/api/guarantee/config", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Validate request body
      const validationResult = guaranteeConfigUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Données invalides",
          errors: validationResult.error.errors
        });
      }
      
      const updates = validationResult.data;
      
      // If enabling, check Stripe is connected and fully set up
      if (updates.enabled === true) {
        const existingConfig = await storage.getGuaranteeConfig(userId);
        if (!existingConfig?.stripeAccountId) {
          // Remove enabled from updates but allow other changes
          delete updates.enabled;
          if (Object.keys(updates).length === 0) {
            return res.status(400).json({ 
              message: "Connectez d'abord votre compte Stripe pour activer la garantie" 
            });
          }
          // Save other changes without enabling
          const config = await storage.upsertGuaranteeConfig(userId, updates);
          return res.json({ 
            success: true, 
            config,
            warning: "Configuration sauvegardée. Connectez Stripe pour activer la garantie."
          });
        }
        
        // Verify Stripe account is ready
        try {
          const account = await stripe.accounts.retrieve(existingConfig.stripeAccountId);
          if (!account.charges_enabled || !account.details_submitted) {
            // Remove enabled from updates but allow other changes
            delete updates.enabled;
            if (Object.keys(updates).length === 0) {
              return res.status(400).json({ 
                message: "Veuillez compléter la configuration de votre compte Stripe" 
              });
            }
            // Save other changes without enabling
            const config = await storage.upsertGuaranteeConfig(userId, updates);
            return res.json({ 
              success: true, 
              config,
              warning: "Configuration sauvegardée. Complétez Stripe pour activer la garantie."
            });
          }
        } catch (stripeError) {
          return res.status(400).json({ 
            message: "Erreur lors de la vérification du compte Stripe" 
          });
        }
      }
      
      const config = await storage.upsertGuaranteeConfig(userId, updates);
      
      res.json({ 
        success: true, 
        config 
      });
    } catch (error: any) {
      console.error('[Guarantee] Error updating config:', error);
      res.status(500).json({ message: "Erreur lors de la mise à jour" });
    }
  });

  // Send test email for guarantee configuration
  app.post("/api/guarantee/test-email", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      const config = await storage.getGuaranteeConfig(userId);
      if (!config) {
        return res.status(400).json({ message: "Configuration de garantie non trouvée" });
      }
      
      // Create a fake session for test
      // Note: En mode dev Resend, on envoie à l'email du propriétaire du compte Resend
      const resendOwnerEmail = 'leopickskairos@gmail.com';
      const targetEmail = process.env.NODE_ENV === 'production' ? user.email : resendOwnerEmail;
      
      const testSession = {
        id: 'test-' + Date.now(),
        userId,
        reservationId: 'TEST-' + Date.now(),
        customerName: user.email?.split('@')[0] || 'Client Test',
        customerEmail: targetEmail,
        customerPhone: null,
        nbPersons: 2,
        reservationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Dans 7 jours
        reservationTime: '19:30',
        status: 'pending' as const,
        stripeSetupIntentId: null,
        stripePaymentMethodId: null,
        cardLast4: null,
        cardBrand: null,
        penaltyAmount: config.penaltyAmount,
        chargeAttempts: 0,
        chargedAt: null,
        chargeAmount: null,
        chargeError: null,
        emailSentAt: null,
        smsSentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        agentId: null,
        businessType: null,
        calendarId: null,
        companyName: config.companyName,
        companyEmail: null,
        timezone: 'Europe/Paris',
        duration: null,
        vehicule: null,
        typeService: null,
      };
      
      const { sendCardRequestEmail } = await import('./services/guarantee-email.service');
      const testUrl = `${getFrontendUrl()}/guarantee/validate/test-session`;
      
      const result = await sendCardRequestEmail({
        config,
        session: testSession,
        checkoutUrl: testUrl
      });
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `Email de test envoyé à ${user.email}`,
          messageId: result.messageId
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: result.error || "Erreur lors de l'envoi"
        });
      }
    } catch (error: any) {
      console.error('[Guarantee] Error sending test email:', error);
      res.status(500).json({ message: "Erreur lors de l'envoi de l'email de test" });
    }
  });

  // Send test SMS for guarantee configuration
  app.post("/api/guarantee/test-sms", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      const config = await storage.getGuaranteeConfig(userId);
      if (!config) {
        return res.status(400).json({ message: "Configuration de garantie non trouvée" });
      }

      // Get phone number from request body
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ message: "Numéro de téléphone requis" });
      }

      // Check if SMS is configured
      const { isSmsConfigured, sendGuaranteeCardRequestSms } = await import('./services/twilio-sms.service');
      
      if (!isSmsConfigured()) {
        return res.status(400).json({ 
          success: false,
          message: "Service SMS non configuré. Contactez l'administrateur SpeedAI."
        });
      }
      
      const customerName = user.email?.split('@')[0] || 'Client Test';
      const companyName = config.companyName || 'Votre établissement';
      const testUrl = `${getFrontendUrl()}/g/test-session`;
      const testDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      const result = await sendGuaranteeCardRequestSms(
        phoneNumber,
        customerName,
        companyName,
        testUrl,
        testDate,
        2 // nb persons
      );
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `SMS de test envoyé au ${phoneNumber}`,
          messageId: result.messageId
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: result.error || "Erreur lors de l'envoi du SMS"
        });
      }
    } catch (error: any) {
      console.error('[Guarantee] Error sending test SMS:', error);
      res.status(500).json({ message: "Erreur lors de l'envoi du SMS de test" });
    }
  });

  // Create Stripe Connect Express account and generate onboarding link
  app.post("/api/guarantee/connect-stripe", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      // Check if already connected
      const existingConfig = await storage.getGuaranteeConfig(userId);
      if (existingConfig?.stripeAccountId) {
        // Verify the account still exists and get status
        try {
          const account = await stripe.accounts.retrieve(existingConfig.stripeAccountId);
          if (account.charges_enabled && account.details_submitted) {
            return res.json({ 
              already_connected: true,
              accountId: existingConfig.stripeAccountId
            });
          }
          // Account exists but not fully onboarded - generate new onboarding link
          console.log('[Guarantee] Account not fully onboarded, generating new link');
          const accountLink = await stripe.accountLinks.create({
            account: existingConfig.stripeAccountId,
            refresh_url: `${getFrontendUrl()}/settings/guarantee?stripe_refresh=true`,
            return_url: `${getFrontendUrl()}/settings/guarantee?stripe_connected=true`,
            type: 'account_onboarding',
          });
          return res.json({ 
            url: accountLink.url,
            accountId: existingConfig.stripeAccountId
          });
        } catch (e: any) {
          console.log('[Guarantee] Existing account invalid, creating new one:', e.message);
          // Account no longer valid, clear it and create new
          await storage.upsertGuaranteeConfig(userId, { stripeAccountId: null });
        }
      }
      
      // Create a new Stripe Connect Express account
      console.log('[Guarantee] Creating new Stripe Connect Express account for:', user.email);
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          userId: userId,
          platform: 'speedai',
        },
      });
      
      console.log('[Guarantee] Created Stripe account:', account.id);
      
      // Save the account ID
      await storage.upsertGuaranteeConfig(userId, {
        stripeAccountId: account.id,
      });
      
      // Generate onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${getFrontendUrl()}/settings/guarantee?stripe_refresh=true`,
        return_url: `${getFrontendUrl()}/settings/guarantee?stripe_connected=true`,
        type: 'account_onboarding',
      });
      
      console.log('[Guarantee] Generated onboarding link for account:', account.id);
      
      res.json({ 
        url: accountLink.url,
        accountId: account.id
      });
    } catch (error: any) {
      console.error('[Guarantee] Error creating Stripe Connect:', error);
      res.status(500).json({ message: error.message || "Erreur lors de la connexion Stripe" });
    }
  });

  // Stripe Connect return handler (after onboarding)
  app.get("/api/guarantee/stripe-callback", async (req, res) => {
    // This endpoint is kept for legacy OAuth support, but now we use account links
    // which redirect directly to /settings/guarantee with query params
    const { error, error_description } = req.query;
    
    if (error) {
      console.error('[Guarantee] Callback error:', error, error_description);
      return res.redirect(`/settings/guarantee?stripe_error=${encodeURIComponent(error_description as string || 'Erreur')}`);
    }
    
    // For account links, Stripe redirects directly to return_url with no additional params
    res.redirect('/settings/guarantee?stripe_connected=true');
  });
  
  // Legacy OAuth callback handler (kept for compatibility)
  app.get("/api/guarantee/stripe-oauth-callback", async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;
      
      // Handle OAuth errors
      if (error) {
        console.error('[Guarantee] OAuth error:', error, error_description);
        return res.redirect(`/settings/guarantee?stripe_error=${encodeURIComponent(error_description as string || 'Autorisation refusée')}`);
      }
      
      if (!code || !state) {
        return res.redirect('/settings/guarantee?stripe_error=Paramètres manquants');
      }
      
      // Decode state to get userId
      let stateData;
      try {
        stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
      } catch (e) {
        return res.redirect('/settings/guarantee?stripe_error=État invalide');
      }
      
      const { userId, timestamp } = stateData;
      
      // Check state is not too old (15 minutes)
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        return res.redirect('/settings/guarantee?stripe_error=Session expirée, veuillez réessayer');
      }
      
      // Exchange authorization code for access token
      const response = await fetch('https://connect.stripe.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          client_secret: process.env.STRIPE_SECRET_KEY!,
        }),
      });
      
      const tokenData = await response.json();
      
      if (tokenData.error) {
        console.error('[Guarantee] Token exchange error:', tokenData);
        return res.redirect(`/settings/guarantee?stripe_error=${encodeURIComponent(tokenData.error_description || 'Erreur de connexion')}`);
      }
      
      const stripeAccountId = tokenData.stripe_user_id;
      
      if (!stripeAccountId) {
        return res.redirect('/settings/guarantee?stripe_error=ID de compte non reçu');
      }
      
      // Save the connected account ID
      await storage.upsertGuaranteeConfig(userId, {
        stripeAccountId,
      });
      
      console.log('[Guarantee] Stripe account connected:', stripeAccountId, 'for user:', userId);
      
      // Redirect back to settings with success
      res.redirect('/settings/guarantee?stripe_connected=true');
    } catch (error: any) {
      console.error('[Guarantee] Callback error:', error);
      res.redirect(`/settings/guarantee?stripe_error=${encodeURIComponent('Erreur de connexion')}`);
    }
  });

  // Get Stripe Connect account status
  app.get("/api/guarantee/stripe-status", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const config = await storage.getGuaranteeConfig(userId);
      
      if (!config?.stripeAccountId) {
        return res.json({
          connected: false,
          detailsSubmitted: false,
          chargesEnabled: false,
          payoutsEnabled: false,
        });
      }
      
      const account = await stripe.accounts.retrieve(config.stripeAccountId);
      
      res.json({
        connected: true,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        businessProfile: account.business_profile,
      });
    } catch (error: any) {
      console.error('[Guarantee] Error getting Stripe status:', error);
      res.status(500).json({ message: "Erreur lors de la vérification Stripe" });
    }
  });

  // Disconnect Stripe Connect account
  app.post("/api/guarantee/disconnect-stripe", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      await storage.upsertGuaranteeConfig(userId, {
        stripeAccountId: null,
        enabled: false,
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Guarantee] Error disconnecting Stripe:', error);
      res.status(500).json({ message: "Erreur lors de la déconnexion" });
    }
  });

  // ===== GUARANTEE SESSIONS (N8N + Dashboard) =====
  
  // Create guarantee session (called by N8N via API key)
  // Returns enriched response with customer & config info for N8N email templates
  app.post("/api/guarantee/create-session", requireApiKey, async (req, res) => {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      
      // Validate request body
      const validationResult = guaranteeSessionCreateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          success: false,
          guaranteeRequired: false,
          message: "Données invalides",
          errors: validationResult.error.errors
        });
      }
      
      const data = validationResult.data;
      const nbPersons = data.nb_persons || 1;
      
      // Get user's guarantee config
      const config = await storage.getGuaranteeConfig(userId);
      
      // Get user info for company defaults
      const user = await storage.getUser(userId);
      
      // Check if guarantee is disabled
      if (!config || !config.enabled) {
        return res.json({ 
          success: true,
          guaranteeRequired: false,
          reason: "disabled",
          message: "Garantie CB non activée pour ce compte"
        });
      }
      
      // Check applyTo conditions
      const reservationDate = parseFrenchDate(data.reservation_date);
      const dayOfWeek = reservationDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6; // Fri, Sat, Sun
      
      if (config.applyTo === 'min_persons' && nbPersons < (config.minPersons || 4)) {
        return res.json({
          success: true,
          guaranteeRequired: false,
          reason: "min_persons_not_met",
          message: `Garantie applicable à partir de ${config.minPersons} personnes`,
          minPersonsRequired: config.minPersons,
          actualPersons: nbPersons
        });
      }
      
      if (config.applyTo === 'weekend' && !isWeekend) {
        return res.json({
          success: true,
          guaranteeRequired: false,
          reason: "not_weekend",
          message: "Garantie applicable uniquement les week-ends (vendredi, samedi, dimanche)"
        });
      }
      
      if (!config.stripeAccountId) {
        return res.json({ 
          success: true,
          guaranteeRequired: false,
          reason: "stripe_not_connected",
          message: "Compte Stripe non connecté" 
        });
      }
      
      // Verify Stripe account is charges_enabled before creating session
      try {
        const account = await stripe.accounts.retrieve(config.stripeAccountId);
        if (!account.charges_enabled) {
          return res.json({ 
            success: true,
            guaranteeRequired: false,
            reason: "stripe_not_ready",
            message: "Compte Stripe non prêt pour les paiements" 
          });
        }
      } catch (stripeError) {
        return res.json({ 
          success: true,
          guaranteeRequired: false,
          reason: "stripe_error",
          message: "Erreur de vérification du compte Stripe" 
        });
      }
      
      // Build config response for N8N email templates
      const configResponse = {
        companyName: config.companyName || "Établissement",
        companyAddress: config.companyAddress || null,
        companyPhone: config.companyPhone || null,
        logoUrl: config.logoUrl || null,
        brandColor: config.brandColor || "#C8B88A",
        penaltyAmount: config.penaltyAmount || 30,
        cancellationDelay: config.cancellationDelay || 24,
        gmailSenderName: config.gmailSenderName || config.companyName || "Réservation",
        gmailSenderEmail: config.gmailSenderEmail || user?.email || null,
        termsUrl: config.termsUrl || null,
      };
      
      const frontendUrl = getFrontendUrl();
      
      // Check if session already exists (idempotency)
      const existingSession = await storage.getGuaranteeSessionByReservationId(data.reservation_id);
      if (existingSession) {
        return res.json({
          success: true,
          guaranteeRequired: true,
          alreadyExists: true,
          sessionId: existingSession.id,
          url: `${frontendUrl}/guarantee/validate/${existingSession.id}`,
          status: existingSession.status,
          customer: {
            name: existingSession.customerName,
            email: existingSession.customerEmail,
            phone: existingSession.customerPhone,
            nbPersons: existingSession.nbPersons,
            reservationDate: data.reservation_date,
            reservationTime: existingSession.reservationTime,
          },
          config: configResponse,
          penalty: {
            amountPerPerson: config.penaltyAmount || 30,
            totalAmount: (config.penaltyAmount || 30) * existingSession.nbPersons,
            currency: "EUR",
          },
        });
      }
      
      // Create Stripe Checkout session in setup mode
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'setup',
        payment_method_types: ['card'],
        customer_email: data.customer_email,
        success_url: `${frontendUrl}/guarantee/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/guarantee/annulation`,
        metadata: {
          speedai_user_id: userId,
          reservation_id: data.reservation_id,
          customer_name: data.customer_name,
          nb_persons: String(nbPersons),
        },
      }, {
        stripeAccount: config.stripeAccountId,
      });
      
      // Create guarantee session in DB with all N8N callback fields
      const session = await storage.createGuaranteeSession({
        userId,
        reservationId: data.reservation_id,
        customerName: data.customer_name,
        customerEmail: data.customer_email,
        customerPhone: data.customer_phone,
        nbPersons: nbPersons,
        reservationDate: parseFrenchDate(data.reservation_date),
        reservationTime: data.reservation_time,
        checkoutSessionId: checkoutSession.id,
        penaltyAmount: config.penaltyAmount,
        status: 'pending',
        // Agent/Business info for N8N callback
        agentId: data.agent_id,
        businessType: data.business_type,
        // Calendar/Company info for N8N callback
        calendarId: data.calendar_id,
        companyName: data.company_name || config.companyName,
        companyEmail: data.company_email,
        timezone: data.timezone || 'Europe/Paris',
        duration: data.duration,
        // Garage-specific fields
        vehicule: data.vehicule,
        typeService: data.type_service,
      });
      
      // Track email/SMS sending results
      const notificationResults = {
        emailSent: false,
        smsSent: false,
        emailError: null as string | null,
        smsError: null as string | null,
      };
      
      // Use our short URL instead of the long Stripe checkout URL
      // This is cleaner and more professional for SMS/email
      const shortValidationUrl = `${frontendUrl}/guarantee/validate/${session.id}`;
      
      // Send email if configured and enabled
      if (config.autoSendEmailOnCreate !== false && data.customer_email && isEmailConfigured(config)) {
        try {
          const emailResult = await sendCardRequestEmail({
            config,
            session,
            checkoutUrl: shortValidationUrl,
          });
          notificationResults.emailSent = emailResult.success;
          if (!emailResult.success) {
            notificationResults.emailError = emailResult.error || 'Unknown error';
          }
          console.log(`📧 [Guarantee] Card request email ${emailResult.success ? 'sent' : 'failed'} for ${data.customer_email}`);
        } catch (emailError: any) {
          console.error('[Guarantee] Error sending card request email:', emailError);
          notificationResults.emailError = emailError.message;
        }
      }
      
      // Send SMS if configured and enabled (uses SpeedAI platform Twilio)
      if (config.autoSendSmsOnCreate && data.customer_phone && isSmsConfigured()) {
        try {
          const smsResult = await sendGuaranteeCardRequestSms(
            data.customer_phone,
            data.customer_name,
            config.companyName || 'Établissement',
            shortValidationUrl,
            parseFrenchDate(data.reservation_date),
            nbPersons
          );
          notificationResults.smsSent = smsResult.success;
          if (!smsResult.success) {
            notificationResults.smsError = smsResult.error || 'Unknown error';
          }
          console.log(`📱 [Guarantee] Card request SMS ${smsResult.success ? 'sent' : 'failed'} for ${data.customer_phone}`);
        } catch (smsError: any) {
          console.error('[Guarantee] Error sending card request SMS:', smsError);
          notificationResults.smsError = smsError.message;
        }
      }
      
      // Return enriched response for N8N with explicit flow control
      res.json({
        success: true,
        guaranteeRequired: true,
        sessionId: session.id,
        url: `${frontendUrl}/guarantee/validate/${session.id}`,
        checkoutUrl: checkoutSession.url,
        status: 'pending',
        
        // ========== FLOW CONTROL FLAGS FOR N8N ==========
        // These flags tell N8N exactly what to do next
        workflow_control: {
          action_required: "WAIT_FOR_STRIPE_VALIDATION",
          can_book_calendar: false,
          reason: "Customer must validate card on Stripe before calendar booking",
          next_trigger: "Dashboard will call N8N_WEBHOOK_CB_VALIDEE when card is validated",
          instructions: [
            "1. DO NOT book Google Calendar yet",
            "2. WAIT for the dashboard to trigger your webhook",
            "3. Calendar booking webhook will be called ONLY after Stripe validation",
            "4. Check 'payment_validated: true' in the callback payload"
          ]
        },
        payment_validated: false,  // Explicit flag: false = DO NOT proceed with calendar
        calendar_booking_allowed: false,  // Explicit flag: false = BLOCK calendar booking
        // ================================================
        
        customer: {
          name: data.customer_name,
          email: data.customer_email,
          phone: data.customer_phone,
          nbPersons: nbPersons,
          reservationDate: data.reservation_date,
          reservationTime: data.reservation_time,
        },
        config: configResponse,
        penalty: {
          amountPerPerson: config.penaltyAmount || 30,
          totalAmount: (config.penaltyAmount || 30) * nbPersons,
          currency: "EUR",
        },
        notifications: notificationResults,
      });
    } catch (error: any) {
      console.error('[Guarantee] Error creating session:', error);
      res.status(500).json({ 
        success: false,
        guaranteeRequired: false,
        message: "Erreur lors de la création de la session" 
      });
    }
  });

  // Get reservations with guarantee (for dashboard)
  app.get("/api/guarantee/reservations", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const period = (req.query.period as 'today' | 'week' | 'month') || 'week';
      
      // Get all sessions
      const allSessions = await storage.getGuaranteeSessions(userId, { period });
      
      // Separate by status
      const pending = allSessions.filter(s => s.status === 'pending');
      const validated = allSessions.filter(s => s.status === 'validated');
      
      // Get today's validated reservations
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayReservations = validated.filter(s => {
        const resDate = new Date(s.reservationDate);
        return resDate >= today && resDate < tomorrow;
      });
      
      // Calculate validation rate
      const totalWithGuarantee = pending.length + validated.length;
      const validationRate = totalWithGuarantee > 0 
        ? Math.round((validated.length / totalWithGuarantee) * 100) 
        : 0;
      
      res.json({
        pending,
        validated,
        today: todayReservations,
        stats: {
          pendingCount: pending.length,
          validatedCount: validated.length,
          todayCount: todayReservations.length,
          validationRate,
        }
      });
    } catch (error: any) {
      console.error('[Guarantee] Error getting reservations:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update reservation status (attended / noshow)
  app.post("/api/guarantee/reservations/:id/status", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.id;
      
      // Validate request body
      const validationResult = guaranteeStatusUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Statut invalide",
          errors: validationResult.error.errors
        });
      }
      
      const { status } = validationResult.data;
      
      const session = await storage.getGuaranteeSessionById(sessionId);
      
      // Ownership check: ensure session belongs to requesting user
      if (!session || session.userId !== userId) {
        return res.status(404).json({ message: "Session non trouvée" });
      }
      
      if (session.status !== 'validated') {
        return res.status(400).json({ message: "Session non validée" });
      }
      
      if (status === 'attended') {
        // Mark as completed
        await storage.updateGuaranteeSession(sessionId, {
          status: 'completed',
        });
        
        return res.json({ success: true, charged: false });
      }
      
      if (status === 'noshow') {
        // Get config for Stripe account
        const config = await storage.getGuaranteeConfig(userId);
        
        if (!config?.stripeAccountId) {
          return res.status(400).json({ message: "Compte Stripe non connecté" });
        }
        
        try {
          // Get the setup intent to retrieve payment method
          const setupIntent = await stripe.setupIntents.retrieve(
            session.setupIntentId!,
            { stripeAccount: config.stripeAccountId }
          );
          
          const paymentMethodId = setupIntent.payment_method as string;
          
          // Calculate amount in cents
          const amountCents = session.penaltyAmount * session.nbPersons * 100;
          
          // Create and confirm PaymentIntent
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: 'eur',
            customer: session.customerStripeId || undefined,
            payment_method: paymentMethodId,
            confirm: true,
            off_session: true,
            description: `Pénalité no-show - Réservation du ${new Date(session.reservationDate).toLocaleDateString('fr-FR')}`,
            metadata: {
              reservation_id: session.reservationId,
              session_id: sessionId,
            },
          }, {
            stripeAccount: config.stripeAccountId,
          });
          
          // Update session
          await storage.updateGuaranteeSession(sessionId, {
            status: 'noshow_charged',
            chargedAmount: amountCents,
            chargedAt: new Date(),
            paymentMethodId,
          });
          
          // Log charge
          await storage.createNoshowCharge({
            guaranteeSessionId: sessionId,
            userId,
            paymentIntentId: paymentIntent.id,
            amount: amountCents,
            currency: 'eur',
            status: 'succeeded',
          });
          
          return res.json({ 
            success: true, 
            charged: true,
            amount: amountCents / 100,
          });
        } catch (stripeError: any) {
          console.error('[Guarantee] Stripe charge failed:', stripeError);
          
          // Update session as failed
          await storage.updateGuaranteeSession(sessionId, {
            status: 'noshow_failed',
          });
          
          // Log failed charge
          await storage.createNoshowCharge({
            guaranteeSessionId: sessionId,
            userId,
            amount: session.penaltyAmount * session.nbPersons * 100,
            currency: 'eur',
            status: 'failed',
            failureReason: stripeError.message,
          });
          
          return res.json({ 
            success: false, 
            error: stripeError.message,
          });
        }
      }
      
      res.status(400).json({ message: "Statut invalide" });
    } catch (error: any) {
      console.error('[Guarantee] Error updating reservation status:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Resend guarantee link
  app.post("/api/guarantee/resend/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.id;
      
      const session = await storage.getGuaranteeSessionById(sessionId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({ message: "Session non trouvée" });
      }
      
      const config = await storage.getGuaranteeConfig(userId);
      
      if (!config?.stripeAccountId) {
        return res.status(400).json({ message: "Compte Stripe non connecté" });
      }
      
      // Create new Stripe Checkout session
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'setup',
        payment_method_types: ['card'],
        customer_email: session.customerEmail || undefined,
        success_url: `${process.env.PUBLIC_URL || 'https://speedai.fr'}/guarantee/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.PUBLIC_URL || 'https://speedai.fr'}/guarantee/annulation`,
        metadata: {
          speedai_user_id: userId,
          reservation_id: session.reservationId,
          customer_name: session.customerName,
          nb_persons: String(session.nbPersons),
        },
      }, {
        stripeAccount: config.stripeAccountId,
      });
      
      // Update session
      await storage.updateGuaranteeSession(sessionId, {
        checkoutSessionId: checkoutSession.id,
        reminderCount: session.reminderCount + 1,
        lastReminderAt: new Date(),
      });
      
      res.json({
        success: true,
        checkout_url: checkoutSession.url,
        public_url: `${process.env.PUBLIC_URL || 'https://speedai.fr'}/g/${sessionId}`,
      });
    } catch (error: any) {
      console.error('[Guarantee] Error resending link:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Cancel guarantee session
  app.post("/api/guarantee/cancel/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const sessionId = req.params.id;
      
      const session = await storage.getGuaranteeSessionById(sessionId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({ message: "Session non trouvée" });
      }
      
      await storage.updateGuaranteeSession(sessionId, {
        status: 'cancelled',
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Guarantee] Error cancelling session:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ===== GUARANTEE STATS & HISTORY =====
  
  // Get guarantee stats
  app.get("/api/guarantee/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const period = (req.query.period as 'week' | 'month' | 'year' | 'all') || 'month';
      
      const stats = await storage.getGuaranteeStats(userId, period);
      
      res.json(stats);
    } catch (error: any) {
      console.error('[Guarantee] Error getting stats:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get no-show history
  app.get("/api/guarantee/history", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const period = (req.query.period as 'week' | 'month' | 'year' | 'all') || 'month';
      
      const charges = await storage.getNoshowCharges(userId, period);
      
      // Get session details for each charge
      const chargesWithDetails = await Promise.all(
        charges.map(async (charge) => {
          const session = await storage.getGuaranteeSessionById(charge.guaranteeSessionId);
          return {
            ...charge,
            session,
          };
        })
      );
      
      res.json(chargesWithDetails);
    } catch (error: any) {
      console.error('[Guarantee] Error getting history:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ===== N8N GUARANTEE SESSION DETAILS (for workflow after CB validation) =====
  
  // Get session details for N8N workflow (after CB validation)
  // This endpoint is used by N8N to get all info needed for Calendar event + confirmation emails
  app.get("/api/guarantee/session-details/:sessionId", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      // Validate N8N Master Key
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          success: false, 
          error: "Missing authorization header" 
        });
      }
      
      const apiKey = authHeader.split(' ')[1];
      const N8N_MASTER_KEY = process.env.N8N_MASTER_API_KEY;
      
      if (!N8N_MASTER_KEY || apiKey !== N8N_MASTER_KEY) {
        return res.status(401).json({ 
          success: false, 
          error: "Invalid API key" 
        });
      }
      
      const sessionId = req.params.sessionId;
      
      // Validate sessionId format
      if (!sessionId || sessionId.length > 100) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid session ID" 
        });
      }
      
      // Get the session
      const session = await storage.getGuaranteeSessionById(sessionId);
      
      if (!session) {
        return res.status(404).json({ 
          success: false, 
          error: "Session not found" 
        });
      }
      
      // Get the config for this user
      const config = await storage.getGuaranteeConfig(session.userId);
      
      if (!config) {
        return res.status(404).json({ 
          success: false, 
          error: "Client config not found" 
        });
      }
      
      // Get user info for additional contact details
      const user = await storage.getUser(session.userId);
      
      // Calculate reservation end time (reservation time + 2 hours by default)
      let reservationTimeEnd = null;
      if (session.reservationTime) {
        const [hours, minutes] = session.reservationTime.split(':').map(Number);
        const endHours = hours + 2; // Default 2 hours duration
        reservationTimeEnd = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
      
      // Format date for response
      const reservationDate = session.reservationDate 
        ? new Date(session.reservationDate).toISOString().split('T')[0]
        : null;
      
      const response = {
        success: true,
        sessionId: session.id,
        status: session.status,
        customer: {
          name: session.customerName,
          email: session.customerEmail,
          phone: session.customerPhone,
          nbPersons: session.nbPersons,
          reservationDate: reservationDate,
          reservationTime: session.reservationTime,
          reservationTimeEnd: reservationTimeEnd,
        },
        config: {
          companyName: config.companyName || null,
          companyAddress: config.companyAddress || null,
          companyPhone: config.companyPhone || null,
          logoUrl: config.logoUrl || null,
          brandColor: config.brandColor || '#C8B88A',
          penaltyAmount: config.penaltyAmount,
          cancellationDelay: config.cancellationDelay,
          gmailSenderName: config.gmailSenderName || null,
          gmailSenderEmail: config.gmailSenderEmail || user?.email || null,
          calendarId: null, // Will be added when user connects their Google Calendar
        },
        penalty: {
          amountPerPerson: session.penaltyAmount,
          totalAmount: session.penaltyAmount * session.nbPersons,
          currency: 'EUR',
        },
        reservationId: session.reservationId,
        validatedAt: session.validatedAt,
      };
      
      console.log('✅ [N8N] Session details retrieved for:', sessionId);
      
      res.json(response);
    } catch (error: any) {
      console.error('[N8N] Error getting session details:', error);
      res.status(500).json({ 
        success: false, 
        error: "Server error" 
      });
    }
  });

  // ===== N8N CALENDAR BOOKING CONFIRMATION =====
  // This endpoint is called by N8N after creating the Google Calendar event
  // It allows N8N to confirm the booking and store the calendar event ID
  app.post("/api/guarantee/confirm-booking", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      // Validate N8N Master Key
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          success: false, 
          error: "Missing authorization header" 
        });
      }
      
      const apiKey = authHeader.split(' ')[1];
      const N8N_MASTER_KEY = process.env.N8N_MASTER_API_KEY;
      
      if (!N8N_MASTER_KEY || apiKey !== N8N_MASTER_KEY) {
        return res.status(401).json({ 
          success: false, 
          error: "Invalid API key" 
        });
      }
      
      const { 
        session_id, 
        calendar_event_id, 
        calendar_event_link,
        booking_status,
        error_message
      } = req.body;
      
      // Validate session_id
      if (!session_id || typeof session_id !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: "session_id is required" 
        });
      }
      
      // Get the session
      const session = await storage.getGuaranteeSessionById(session_id);
      
      if (!session) {
        return res.status(404).json({ 
          success: false, 
          error: "Session not found" 
        });
      }
      
      // Log the confirmation
      console.log(`📅 [N8N] Calendar booking confirmation for session ${session_id}:`, {
        calendar_event_id,
        calendar_event_link,
        booking_status,
        error_message
      });
      
      // If booking was successful, update status to 'completed' (meaning full flow done)
      if (booking_status === 'success' || booking_status === 'booked') {
        // Note: We keep status as 'validated' since the CB is validated
        // The calendar_event_id could be stored if we add that field to schema later
        console.log(`✅ [N8N] Calendar event created: ${calendar_event_id}`);
      } else if (booking_status === 'failed') {
        console.error(`❌ [N8N] Calendar booking failed for session ${session_id}:`, error_message);
      }
      
      res.json({ 
        success: true, 
        message: "Booking confirmation received",
        session_id,
        received: {
          calendar_event_id,
          booking_status
        }
      });
    } catch (error: any) {
      console.error('[N8N] Error confirming booking:', error);
      res.status(500).json({ 
        success: false, 
        error: "Server error" 
      });
    }
  });

  // ===== PUBLIC GUARANTEE PAGE =====
  
  // Get public session info (no auth required)
  app.get("/api/guarantee/public/session/:sessionId", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      
      // Validate sessionId format (basic UUID-like check)
      if (!sessionId || sessionId.length > 100) {
        return res.status(400).json({ message: "ID de session invalide" });
      }
      
      const session = await storage.getGuaranteeSessionById(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session non trouvée" });
      }
      
      // Check if session has expired (7 days after creation for pending sessions)
      if (session.status === 'pending') {
        const createdAt = new Date(session.createdAt);
        const expiryDate = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (new Date() > expiryDate) {
          return res.status(410).json({ message: "Session expirée" });
        }
      }
      
      // Get config for branding
      const config = await storage.getGuaranteeConfig(session.userId);
      
      res.json({
        id: session.id,
        status: session.status,
        customerName: session.customerName,
        nbPersons: session.nbPersons,
        reservationDate: session.reservationDate,
        reservationTime: session.reservationTime,
        penaltyAmount: session.penaltyAmount,
        cancellationDelay: config?.cancellationDelay || 24,
        logoUrl: config?.logoUrl,
        brandColor: config?.brandColor || '#C8B88A',
        companyName: config?.companyName,
        companyAddress: config?.companyAddress,
        companyPhone: config?.companyPhone,
      });
    } catch (error: any) {
      console.error('[Guarantee] Error getting public session:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get checkout URL for public page
  app.post("/api/guarantee/public/checkout/:sessionId", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      
      // Validate sessionId format
      if (!sessionId || sessionId.length > 100) {
        return res.status(400).json({ message: "ID de session invalide" });
      }
      
      const session = await storage.getGuaranteeSessionById(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session non trouvée" });
      }
      
      if (session.status !== 'pending') {
        return res.status(400).json({ 
          message: "Cette réservation a déjà été confirmée",
          status: session.status,
        });
      }
      
      // Check expiration (7 days for our session)
      const createdAt = new Date(session.createdAt);
      const expiryDate = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (new Date() > expiryDate) {
        return res.status(410).json({ message: "Session expirée" });
      }
      
      const config = await storage.getGuaranteeConfig(session.userId);
      
      if (!config?.stripeAccountId) {
        return res.status(400).json({ message: "Configuration Stripe manquante" });
      }
      
      let checkoutUrl: string | null = null;
      
      // Try to retrieve existing Stripe checkout session
      if (session.checkoutSessionId) {
        try {
          const checkoutSession = await stripe.checkout.sessions.retrieve(
            session.checkoutSessionId,
            { stripeAccount: config.stripeAccountId }
          );
          
          if (checkoutSession.status === 'complete') {
            return res.status(400).json({ 
              message: "Cette réservation a déjà été confirmée" 
            });
          }
          
          // Check if session is still valid (Stripe sessions expire after 24h)
          if (checkoutSession.url && checkoutSession.status === 'open') {
            checkoutUrl = checkoutSession.url;
          }
        } catch (stripeError: any) {
          // Session expired or invalid - we'll create a new one
          console.log(`[Guarantee] Stripe session expired or invalid, creating new one: ${stripeError.message}`);
        }
      }
      
      // Create new Stripe checkout session if needed
      if (!checkoutUrl) {
        console.log(`[Guarantee] Creating new Stripe checkout session for ${sessionId}`);
        
        const frontendUrl = getFrontendUrl();
        const totalAmount = (session.penaltyAmount || 30) * (session.nbPersons || 1);
        
        const newCheckoutSession = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          mode: 'setup',
          customer_email: session.customerEmail || undefined,
          success_url: `${frontendUrl}/guarantee/confirmation?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${frontendUrl}/guarantee/annulation?session_id=${sessionId}`,
          metadata: {
            guarantee_session_id: sessionId,
            penalty_amount: String(session.penaltyAmount || 30),
            nb_persons: String(session.nbPersons || 1),
            total_penalty: String(totalAmount),
          },
          setup_intent_data: {
            metadata: {
              guarantee_session_id: sessionId,
              penalty_amount: String(session.penaltyAmount || 30),
              nb_persons: String(session.nbPersons || 1),
            },
          },
        }, {
          stripeAccount: config.stripeAccountId,
        });
        
        // Update session with new checkout session ID
        await storage.updateGuaranteeSession(sessionId, {
          checkoutSessionId: newCheckoutSession.id,
        });
        
        checkoutUrl = newCheckoutSession.url;
        console.log(`[Guarantee] New checkout session created: ${newCheckoutSession.id}`);
      }
      
      if (!checkoutUrl) {
        return res.status(500).json({ message: "Impossible de créer la session de paiement" });
      }
      
      res.json({
        checkout_url: checkoutUrl,
      });
    } catch (error: any) {
      console.error('[Guarantee] Error getting checkout URL:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Endpoint to validate session after Stripe checkout - verifies with Stripe directly
  app.post("/api/guarantee/webhook/checkout-complete", async (req, res) => {
    try {
      const { checkout_session_id } = req.body;
      
      if (!checkout_session_id || typeof checkout_session_id !== 'string') {
        return res.status(400).json({ message: "checkout_session_id requis" });
      }
      
      // Find session by checkout session ID
      const session = await storage.getGuaranteeSessionByCheckoutSessionId(checkout_session_id);
      
      if (!session) {
        return res.status(404).json({ message: "Session non trouvée" });
      }
      
      // Already validated, return success
      if (session.status === 'validated') {
        return res.json({ success: true, already_validated: true });
      }
      
      // Get user's config for Stripe account
      const config = await storage.getGuaranteeConfig(session.userId);
      
      if (!config?.stripeAccountId) {
        return res.status(400).json({ message: "Configuration Stripe manquante" });
      }
      
      // CRITICAL: Verify the checkout session with Stripe directly
      // This prevents spoofing of checkout completion
      let stripeCheckoutSession;
      try {
        stripeCheckoutSession = await stripe.checkout.sessions.retrieve(
          checkout_session_id,
          { expand: ['setup_intent', 'setup_intent.payment_method'] },
          { stripeAccount: config.stripeAccountId }
        );
      } catch (stripeError: any) {
        console.error('[Guarantee] Stripe verification failed:', stripeError);
        return res.status(400).json({ message: "Session de paiement invalide" });
      }
      
      // Verify the session is actually complete
      if (stripeCheckoutSession.status !== 'complete') {
        return res.status(400).json({ 
          message: "Session de paiement non complétée",
          stripe_status: stripeCheckoutSession.status
        });
      }
      
      // Extract verified data from Stripe response
      const setupIntent = stripeCheckoutSession.setup_intent as any;
      const paymentMethodId = setupIntent?.payment_method?.id || setupIntent?.payment_method;
      const customerStripeId = stripeCheckoutSession.customer as string;
      
      // Update session as validated with Stripe-verified data
      await storage.updateGuaranteeSession(session.id, {
        status: 'validated',
        validatedAt: new Date(),
        setupIntentId: setupIntent?.id,
        customerStripeId: customerStripeId || null,
        paymentMethodId: paymentMethodId || null,
      });
      
      // Send confirmation email and SMS
      try {
        if (session.customerEmail) {
          const { sendConfirmationEmail } = await import('./services/guarantee-email.service');
          await sendConfirmationEmail({ config, session });
          console.log(`📧 [Guarantee] Confirmation email sent to ${session.customerEmail}`);
        }
        
        if (session.customerPhone) {
          const { sendGuaranteeConfirmationSms } = await import('./services/twilio-sms.service');
          await sendGuaranteeConfirmationSms(
            session.customerPhone,
            session.customerName,
            config.companyName || 'Notre établissement',
            new Date(session.reservationDate),
            session.reservationTime || null,
            session.nbPersons
          );
          console.log(`📱 [Guarantee] Confirmation SMS sent to ${session.customerPhone}`);
        }
      } catch (notifError) {
        console.error('[Guarantee] Error sending confirmation notifications:', notifError);
        // Don't fail the request if notifications fail
      }
      
      // Trigger N8N Workflow 2 for Google Calendar booking
      try {
        const n8nWebhookUrl = 'https://djeydejy.app.n8n.cloud/webhook/garantie-nouvelle-resa';
        
        // Fetch user data for API key
        const user = await storage.getUser(session.userId);
        
        // Fetch SpeedAI client data for additional business info
        let speedaiClient = null;
        if (session.agentId) {
          speedaiClient = await storage.getSpeedaiClientByAgentId(session.agentId);
        }
        
        // Calculate datetime for Google Calendar
        const timezone = session.timezone || config.timezone || speedaiClient?.timezone || 'Europe/Paris';
        const reservationDate = new Date(session.reservationDate);
        
        // Parse reservation time (format: "HH:MM" or "HHhMM")
        let hours = 12, minutes = 0;
        if (session.reservationTime) {
          const timeMatch = session.reservationTime.match(/(\d{1,2})[h:](\d{2})/i);
          if (timeMatch) {
            hours = parseInt(timeMatch[1], 10);
            minutes = parseInt(timeMatch[2], 10);
          }
        }
        
        // Build start and end datetime in ISO format with timezone offset
        const startDate = new Date(reservationDate);
        startDate.setHours(hours, minutes, 0, 0);
        
        // Duration from session or default 60 minutes
        const durationMinutes = session.duration || 60;
        const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
        
        // Format as ISO string
        const startDatetime = startDate.toISOString();
        const endDatetime = endDate.toISOString();
        
        // timeMin/timeMax for Google Calendar query (same day range)
        const dayStart = new Date(reservationDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(reservationDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        const webhookPayload = {
          // Event info
          event: 'card_validated',
          session_id: session.id,
          reservation_id: session.reservationId,
          validated_at: new Date().toISOString(),
          payment_method_id: paymentMethodId,
          
          // ===== GOOGLE CALENDAR REQUIRED FIELDS =====
          calendar_id: session.calendarId || config.calendarId || null,
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          timeZone: timezone,
          calendar_platform: 'google_calendar',
          
          // Reservation datetime
          start_datetime: startDatetime,
          end_datetime: endDatetime,
          
          // ===== CUSTOMER INFO =====
          nom_client: session.customerName,
          customer_name: session.customerName,
          client_email: session.customerEmail,
          customer_email: session.customerEmail,
          client_phone: session.customerPhone,
          customer_phone: session.customerPhone,
          
          // ===== RESERVATION DETAILS =====
          nb_personnes: session.nbPersons,
          nb_persons: session.nbPersons,
          date_demandee: session.reservationDate,
          reservation_date: session.reservationDate,
          heure_demandee: session.reservationTime,
          reservation_time: session.reservationTime,
          minimum_duration: durationMinutes,
          duration: durationMinutes,
          
          // ===== BUSINESS CONFIGURATION =====
          agency_id: session.agentId,
          agent_id: session.agentId,
          business_type: session.businessType || speedaiClient?.businessType || 'restaurant',
          company_name: session.companyName || config.companyName || speedaiClient?.businessName,
          agency_name: speedaiClient?.businessName || config.companyName,
          company_email: session.companyEmail || config.senderEmail || speedaiClient?.contactEmail,
          company_phone: config.companyPhone || speedaiClient?.contactPhone,
          company_address: config.companyAddress,
          
          // ===== EMAIL/SMS SETTINGS =====
          email_from_resend: config.senderEmail || 'garantie@rdv-notif.tech',
          email_enabled: config.autoSendEmailOnValidation ?? true,
          sms_enabled: config.smsEnabled ?? false,
          auto_send_email_on_create: config.autoSendEmailOnCreate ?? true,
          auto_send_sms_on_create: config.autoSendSmsOnCreate ?? false,
          auto_send_email_on_validation: config.autoSendEmailOnValidation ?? true,
          auto_send_sms_on_validation: config.autoSendSmsOnValidation ?? false,
          
          // ===== TIMEZONE & CAPACITY =====
          timezone: timezone,
          max_capacity: config.minPersons || 1,
          penalty_amount: config.penaltyAmount || 30,
          cancellation_delay: config.cancellationDelay || 24,
          
          // ===== BRANDING =====
          logo_url: config.logoUrl,
          brand_color: config.brandColor || '#C8B88A',
          terms_url: config.termsUrl,
          
          // ===== DESCRIPTION FOR CALENDAR EVENT =====
          resume: `Réservation ${session.customerName} - ${session.nbPersons} pers.`,
          description: `📅 Réservation ${session.businessType || 'Restaurant'}\n👤 Client : ${session.customerName}\n👥 Personnes : ${session.nbPersons}\n📞 Téléphone : ${session.customerPhone || 'N/A'}\n📧 Email : ${session.customerEmail || 'N/A'}\n🔒 CB Garantie validée`,
          
          // ===== VEHICLE/SERVICE (for garages) =====
          vehicule: session.vehicule,
          type_service: session.typeService,
          
          // ===== SPEEDAI DASHBOARD ACCESS =====
          // Each client has their own API key and dashboard access
          api_key: user?.apiKey || null, // Client's SpeedAI API key for N8N callbacks
          dashboard_url: process.env.FRONTEND_URL || 'https://speedai-b2b-platform-v2.replit.app',
          user_id: session.userId,
          user_email: user?.email,
        };
        
        console.log(`[Guarantee] Triggering N8N Workflow 2 for calendar booking: ${session.id}`);
        console.log(`[Guarantee] Calendar ID: ${session.calendarId || config.calendarId}, TimeZone: ${timezone}, Business: ${webhookPayload.business_type}`);
        
        const n8nResponse = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });
        
        if (n8nResponse.ok) {
          console.log(`✅ [Guarantee] N8N Workflow 2 triggered successfully for session ${session.id}`);
        } else {
          console.error(`[Guarantee] N8N webhook returned ${n8nResponse.status}: ${await n8nResponse.text()}`);
        }
      } catch (n8nError) {
        console.error('[Guarantee] Error triggering N8N workflow:', n8nError);
        // Don't fail the request if N8N fails - the card is still validated
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Guarantee] Error validating session:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ===== REVIEWS & REPUTATION MANAGEMENT ROUTES =====

  // Get review configuration
  app.get("/api/reviews/config", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      let config = await storage.getReviewConfig(userId);
      
      if (!config) {
        config = await storage.upsertReviewConfig(userId, { enabled: false });
      }
      
      res.json(config);
    } catch (error: any) {
      console.error("[Reviews] Error fetching config:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update review configuration
  app.put("/api/reviews/config", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const updates = req.body;
      
      const config = await storage.upsertReviewConfig(userId, updates);
      res.json(config);
    } catch (error: any) {
      console.error("[Reviews] Error updating config:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get all incentives
  app.get("/api/reviews/incentives", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const incentives = await storage.getReviewIncentives(userId);
      res.json(incentives);
    } catch (error: any) {
      console.error("[Reviews] Error fetching incentives:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Create incentive
  app.post("/api/reviews/incentives", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const incentive = await storage.createReviewIncentive({
        ...req.body,
        userId,
      });
      res.json(incentive);
    } catch (error: any) {
      console.error("[Reviews] Error creating incentive:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update incentive
  app.put("/api/reviews/incentives/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const incentive = await storage.updateReviewIncentive(id, userId, req.body);
      
      if (!incentive) {
        return res.status(404).json({ message: "Incitation non trouvée" });
      }
      
      res.json(incentive);
    } catch (error: any) {
      console.error("[Reviews] Error updating incentive:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Delete incentive
  app.delete("/api/reviews/incentives/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      await storage.deleteReviewIncentive(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Reviews] Error deleting incentive:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Set default incentive
  app.post("/api/reviews/incentives/:id/default", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      await storage.setDefaultIncentive(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Reviews] Error setting default incentive:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get review requests with filters
  app.get("/api/reviews/requests", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { status, limit, offset } = req.query;
      
      const requests = await storage.getReviewRequests(userId, {
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      
      res.json(requests);
    } catch (error: any) {
      console.error("[Reviews] Error fetching requests:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Create manual review request
  app.post("/api/reviews/requests", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { customerName, customerEmail, customerPhone, sendMethod, incentiveId } = req.body;
      
      if (!customerName) {
        return res.status(400).json({ message: "Nom du client requis" });
      }
      
      if (!customerEmail && !customerPhone) {
        return res.status(400).json({ message: "Email ou téléphone requis" });
      }
      
      const trackingToken = `rv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      
      const request = await storage.createReviewRequest({
        userId,
        customerName,
        customerEmail,
        customerPhone,
        sendMethod: sendMethod || 'both',
        incentiveId: incentiveId && incentiveId.trim() !== '' ? incentiveId : null,
        trackingToken,
        status: 'pending',
      });
      
      res.json(request);
    } catch (error: any) {
      console.error("[Reviews] Error creating request:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Send review request immediately
  app.post("/api/reviews/requests/:id/send", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const request = await storage.getReviewRequestById(id, userId);
      
      if (!request) {
        return res.status(404).json({ message: "Demande non trouvée" });
      }
      
      const config = await storage.getReviewConfig(userId);
      
      if (!config) {
        return res.status(400).json({ message: "Configuration des avis non trouvée" });
      }
      
      // Récupérer l'incentive (spécifique à la demande ou par défaut)
      let incentive = null;
      if (request.incentiveId) {
        incentive = await storage.getReviewIncentiveById(request.incentiveId, userId);
      }
      if (!incentive) {
        incentive = await storage.getDefaultIncentive(userId);
      }
      
      const frontendUrl = getFrontendUrl();
      const reviewLink = `${frontendUrl}/review/${request.trackingToken}`;
      
      // Texte d'incentive pour SMS
      const incentiveTextSms = incentive ? `\n🎁 ${incentive.displayMessage}` : '';
      
      // Bloc HTML d'incentive pour Email
      const incentiveHtmlBlock = incentive ? `
        <tr>
          <td style="padding:0 24px 24px;">
            <div style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;text-align:center;">
              <span style="font-size:24px;">🎁</span>
              <p style="margin:8px 0 0;font-size:15px;color:#92400e;font-weight:600;">
                ${incentive.displayMessage}
              </p>
            </div>
          </td>
        </tr>
      ` : '';
      
      let emailSent = false;
      let smsSent = false;
      
      // Envoi Email
      if (request.customerEmail && (request.sendMethod === 'email' || request.sendMethod === 'both')) {
        const subject = config.emailSubject || "Partagez votre expérience avec nous !";
        const companyName = config.companyName || "notre établissement";
        
        const message = `
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
            <tr>
              <td style="padding:24px;text-align:center;">
                <p style="margin:0 0 16px;font-size:16px;color:#374151;">Bonjour ${request.customerName},</p>
                <p style="margin:0 0 16px;font-size:16px;color:#374151;">Nous espérons que vous avez passé un agréable moment chez ${companyName}.</p>
                <p style="margin:0 0 24px;font-size:16px;color:#374151;">Votre avis nous est précieux ! Prenez quelques secondes pour partager votre expérience :</p>
              </td>
            </tr>
            ${incentiveHtmlBlock}
            <tr>
              <td style="padding:0 24px 24px;text-align:center;">
                <a href="${reviewLink}" style="display:inline-block;padding:14px 32px;background:#C8B88A;color:#000;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">Laisser mon avis</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px;text-align:center;">
                <p style="margin:0;font-size:14px;color:#6b7280;">Merci beaucoup pour votre confiance !</p>
              </td>
            </tr>
          </table>
        `;
        
        const incentiveTextEmail = incentive ? `\n🎁 ${incentive.displayMessage}` : '';
        
        try {
          await sendEmail({
            to: request.customerEmail,
            subject,
            text: `Bonjour ${request.customerName}, merci de votre visite chez ${companyName} !${incentiveTextEmail}\n\nPartagez votre expérience avec nous : ${reviewLink}`,
            html: message,
          });
          emailSent = true;
        } catch (emailError) {
          console.error("[Reviews] Error sending email:", emailError);
        }
      }
      
      // Envoi SMS (si configuré avec Twilio)
      if (request.customerPhone && (request.sendMethod === 'sms' || request.sendMethod === 'both')) {
        const companyName = config.companyName || "notre établissement";
        
        // Check if SMS is enabled in config
        if (config.smsEnabled) {
          try {
            const { sendReviewRequestSms } = await import('./services/twilio-sms.service');
            const smsResult = await sendReviewRequestSms(
              request.customerPhone,
              request.customerName || 'Client',
              companyName,
              reviewLink,
              incentive?.displayMessage
            );
            
            if (smsResult.success) {
              smsSent = true;
              console.log(`✅ [Reviews] SMS sent to ${request.customerPhone}`);
            } else {
              console.warn(`[Reviews] SMS failed: ${smsResult.error}`);
            }
          } catch (smsError) {
            console.error("[Reviews] Error sending SMS:", smsError);
          }
        } else {
          console.log("[Reviews] SMS disabled in config, skipping SMS send");
        }
      }
      
      await storage.updateReviewRequest(id, {
        status: 'sent',
        sentAt: new Date(),
      });
      
      res.json({ success: true, emailSent, smsSent });
    } catch (error: any) {
      console.error("[Reviews] Error sending request:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get review request stats
  app.get("/api/reviews/requests/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const stats = await storage.getReviewRequestStats(userId);
      res.json(stats);
    } catch (error: any) {
      console.error("[Reviews] Error fetching request stats:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get all reviews with filters
  app.get("/api/reviews", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { platform, ratingMin, ratingMax, sentiment, isRead, search, limit, offset } = req.query;
      
      const reviewsList = await storage.getReviews(userId, {
        platform: platform as string,
        ratingMin: ratingMin ? parseInt(ratingMin as string) : undefined,
        ratingMax: ratingMax ? parseInt(ratingMax as string) : undefined,
        sentiment: sentiment as string,
        isRead: isRead !== undefined ? isRead === 'true' : undefined,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      
      res.json(reviewsList);
    } catch (error: any) {
      console.error("[Reviews] Error fetching reviews:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get single review
  app.get("/api/reviews/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const review = await storage.getReviewById(id, userId);
      
      if (!review) {
        return res.status(404).json({ message: "Avis non trouvé" });
      }
      
      res.json(review);
    } catch (error: any) {
      console.error("[Reviews] Error fetching review:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Mark review as read
  app.post("/api/reviews/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const review = await storage.updateReview(id, userId, { isRead: true });
      
      if (!review) {
        return res.status(404).json({ message: "Avis non trouvé" });
      }
      
      res.json(review);
    } catch (error: any) {
      console.error("[Reviews] Error marking review as read:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Flag/unflag review
  app.post("/api/reviews/:id/flag", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { flagged } = req.body;
      
      const review = await storage.updateReview(id, userId, { isFlagged: flagged });
      
      if (!review) {
        return res.status(404).json({ message: "Avis non trouvé" });
      }
      
      res.json(review);
    } catch (error: any) {
      console.error("[Reviews] Error flagging review:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Save response to review (draft or publish)
  app.post("/api/reviews/:id/respond", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { responseText, publish } = req.body;
      
      if (!responseText) {
        return res.status(400).json({ message: "Texte de réponse requis" });
      }
      
      const review = await storage.updateReview(id, userId, {
        responseText,
        responseStatus: publish ? 'published' : 'draft',
        responseDate: publish ? new Date() : undefined,
      });
      
      if (!review) {
        return res.status(404).json({ message: "Avis non trouvé" });
      }
      
      res.json(review);
    } catch (error: any) {
      console.error("[Reviews] Error responding to review:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Regenerate AI response for a review
  app.post("/api/reviews/:id/regenerate-ai", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const review = await storage.getReviewById(id, userId);
      if (!review) {
        return res.status(404).json({ message: "Avis non trouvé" });
      }
      
      const config = await storage.getReviewConfig(userId);
      if (!config) {
        return res.status(400).json({ message: "Configuration des avis non trouvée" });
      }
      
      const { regenerateResponse } = await import('./services/ai-review-response.service');
      const generated = await regenerateResponse(review, config, review.aiSuggestedResponse || undefined);
      
      const updated = await storage.updateReview(id, userId, {
        aiSuggestedResponse: generated.response,
      });
      
      res.json({ 
        success: true, 
        aiSuggestedResponse: generated.response,
        review: updated 
      });
    } catch (error: any) {
      console.error("[Reviews] Error regenerating AI response:", error);
      res.status(500).json({ message: "Erreur lors de la génération IA" });
    }
  });

  // Generate AI response for a review (first time)
  app.post("/api/reviews/:id/generate-ai", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      const review = await storage.getReviewById(id, userId);
      if (!review) {
        return res.status(404).json({ message: "Avis non trouvé" });
      }
      
      const config = await storage.getReviewConfig(userId);
      if (!config) {
        return res.status(400).json({ message: "Configuration des avis non trouvée" });
      }
      
      const { generateReviewResponse } = await import('./services/ai-review-response.service');
      const generated = await generateReviewResponse({ review, config });
      
      const updated = await storage.updateReview(id, userId, {
        aiSuggestedResponse: generated.response,
        aiSummary: generated.summary,
      });
      
      res.json({ 
        success: true, 
        aiSuggestedResponse: generated.response,
        aiSummary: generated.summary,
        review: updated 
      });
    } catch (error: any) {
      console.error("[Reviews] Error generating AI response:", error);
      res.status(500).json({ message: "Erreur lors de la génération IA" });
    }
  });

  // Generate AI insights for reviews analytics
  app.post("/api/ai/review-insights", requireAuth, async (req, res) => {
    try {
      const { stats, period } = req.body;
      
      if (!stats) {
        return res.status(400).json({ message: "Stats required" });
      }
      
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      });

      const prompt = `Tu es un expert en gestion de la réputation en ligne et en analyse de données.
Analyse ces statistiques d'avis clients et génère 3-4 recommandations concrètes et actionnables.

Statistiques:
- Note globale: ${stats.globalScore}/5
- Total d'avis: ${stats.totalReviews}
- Nouveaux avis sur la période (${period || 'mois'}): ${stats.newReviewsPeriod}
- Taux de réponse: ${stats.responseRate}%
- Temps de réponse moyen: ${stats.avgResponseTimeHours ? stats.avgResponseTimeHours + 'h' : 'Non disponible'}
- Distribution des notes: ${JSON.stringify(stats.ratingDistribution)}
- Distribution des sentiments: ${JSON.stringify(stats.sentimentDistribution)}
- Plateformes: ${JSON.stringify(stats.platforms)}

Génère une analyse en français avec:
1. Un point fort identifié
2. Un axe d'amélioration prioritaire
3. 2-3 actions concrètes à mettre en place

Format: Utilise des bullet points et reste concis (max 200 mots).`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 400,
      });

      const insights = completion.choices[0]?.message?.content || "Analyse non disponible";

      res.json({ insights });
    } catch (error: any) {
      console.error("[AI Reviews] Error generating insights:", error);
      res.status(500).json({ message: "Erreur lors de la génération IA" });
    }
  });

  // Get review stats
  app.get("/api/reviews/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { period } = req.query;
      
      const stats = await storage.getReviewStats(
        userId, 
        period as 'week' | 'month' | 'year' | 'all'
      );
      
      res.json(stats);
    } catch (error: any) {
      console.error("[Reviews] Error fetching stats:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get review alerts configuration
  app.get("/api/reviews/alerts", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const alerts = await storage.getReviewAlerts(userId);
      res.json(alerts);
    } catch (error: any) {
      console.error("[Reviews] Error fetching alerts:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update review alerts configuration
  app.put("/api/reviews/alerts", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { alerts } = req.body;
      
      if (!Array.isArray(alerts)) {
        return res.status(400).json({ message: "Format invalide" });
      }
      
      await storage.upsertReviewAlerts(userId, alerts);
      const updatedAlerts = await storage.getReviewAlerts(userId);
      res.json(updatedAlerts);
    } catch (error: any) {
      console.error("[Reviews] Error updating alerts:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public endpoint: Track link click from review request
  app.get("/api/reviews/public/track/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { platform } = req.query;
      
      const request = await storage.getReviewRequestByToken(token);
      
      if (!request) {
        return res.status(404).json({ message: "Lien invalide" });
      }
      
      if (!request.linkClickedAt) {
        await storage.updateReviewRequest(request.id, {
          linkClickedAt: new Date(),
          platformClicked: platform as string,
          status: 'clicked',
        });
      }
      
      const config = await storage.getReviewConfig(request.userId);
      
      // Récupérer l'incentive si elle existe
      let incentive = null;
      if (request.incentiveId) {
        incentive = await storage.getReviewIncentiveById(request.incentiveId, request.userId);
      }
      
      res.json({
        platforms: {
          google: config?.googleReviewUrl,
          tripadvisor: config?.tripadvisorUrl,
          facebook: config?.facebookPageUrl,
          yelp: config?.yelpUrl,
          doctolib: config?.doctolibUrl,
          pagesJaunes: config?.pagesJaunesUrl,
        },
        priority: config?.platformsPriority || ['google', 'tripadvisor', 'facebook'],
        customerName: request.customerName,
        incentive: incentive ? {
          displayMessage: incentive.displayMessage,
          type: incentive.type,
          validityDays: incentive.validityDays,
        } : null,
      });
    } catch (error: any) {
      console.error("[Reviews] Error tracking link:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public endpoint: Confirm review was left
  app.post("/api/reviews/public/confirm/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { platform } = req.body;
      
      const request = await storage.getReviewRequestByToken(token);
      
      if (!request) {
        return res.status(404).json({ message: "Lien invalide" });
      }
      
      if (request.reviewConfirmedAt) {
        return res.json({ 
          success: true, 
          promoCode: request.promoCode,
          alreadyConfirmed: true,
        });
      }
      
      let promoCode: string | null = null;
      
      if (request.incentiveId) {
        const incentive = await storage.getReviewIncentiveById(request.incentiveId, request.userId);
        if (incentive) {
          promoCode = `MERCI-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        }
      }
      
      await storage.updateReviewRequest(request.id, {
        reviewConfirmedAt: new Date(),
        reviewConfirmedPlatform: platform,
        promoCode,
        status: 'confirmed',
      });
      
      res.json({ 
        success: true, 
        promoCode,
      });
    } catch (error: any) {
      console.error("[Reviews] Error confirming review:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ===== PUBLIC EMBED ENDPOINTS =====
  
  // Helper: Validate UUID format
  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };
  
  // Public endpoint to get reviews for embed widget (by user ID or domain)
  app.get("/api/reviews/public/embed/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { max = "5" } = req.query;
      
      // Validate userId format
      if (!userId || !isValidUUID(userId)) {
        return res.status(400).json({ message: "ID utilisateur invalide" });
      }
      
      // Rate limiting: cache for 5 minutes
      res.setHeader('Cache-Control', 'public, max-age=300');
      
      // Get user's review config
      const config = await storage.getReviewConfig(userId);
      
      if (!config) {
        return res.status(404).json({ message: "Configuration non trouvée" });
      }
      
      // Limit max reviews to prevent abuse
      const parsed = parseInt(max as string, 10);
      const maxReviews = Math.min(Number.isFinite(parsed) && parsed > 0 ? parsed : 5, 20);
      
      // Get positive reviews only (4+ stars)
      const reviews = await storage.getReviews(userId, {
        ratingMin: 4,
        limit: maxReviews,
      });
      
      // Get stats
      const stats = await storage.getReviewStats(userId, 'all');
      
      res.json({
        reviews: reviews.map(r => ({
          id: r.id,
          authorName: r.authorName,
          rating: r.rating,
          content: r.content,
          platform: r.platform,
          publishedAt: r.publishedAt,
        })),
        stats: {
          globalScore: stats.globalScore,
          totalReviews: stats.totalReviews,
        },
        config: {
          companyName: config.companyName,
        },
      });
    } catch (error: any) {
      console.error("[Reviews] Error fetching embed data:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public page for collecting reviews (redirects to platforms)
  app.get("/api/reviews/public/collect/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Validate userId format
      if (!userId || !isValidUUID(userId)) {
        return res.status(400).json({ message: "ID utilisateur invalide" });
      }
      
      // Rate limiting: cache for 1 hour (platform URLs don't change often)
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      const config = await storage.getReviewConfig(userId);
      
      if (!config) {
        return res.status(404).json({ message: "Configuration non trouvée" });
      }
      
      res.json({
        platforms: {
          google: config.googleReviewUrl,
          tripadvisor: config.tripadvisorUrl,
          facebook: config.facebookPageUrl,
          yelp: config.yelpUrl,
          doctolib: config.doctolibUrl,
          pagesJaunes: config.pagesJaunesUrl,
        },
        priority: config.platformsPriority || ['google', 'tripadvisor', 'facebook'],
        companyName: config.companyName,
      });
    } catch (error: any) {
      console.error("[Reviews] Error fetching collect data:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ===== N8N REVIEWS API ENDPOINTS =====
  // These endpoints use N8N Master API Key authentication for automated workflows

  // Helper: Validate N8N Master API Key
  const validateN8NMasterKey = (req: Request): boolean => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    const apiKey = authHeader.split(' ')[1];
    const N8N_MASTER_KEY = process.env.N8N_MASTER_API_KEY;
    return N8N_MASTER_KEY !== undefined && apiKey === N8N_MASTER_KEY;
  };

  // 1. POST /api/n8n/reviews/create-request - Create a review request from N8N
  app.post("/api/n8n/reviews/create-request", async (req, res) => {
    try {
      if (!validateN8NMasterKey(req)) {
        return res.status(401).json({ success: false, error: "Invalid API key" });
      }

      const { 
        client_email, 
        customer_name, 
        customer_email, 
        customer_phone, 
        reservation_id, 
        reservation_date, 
        reservation_time, 
        send_method = 'email' 
      } = req.body;

      // Validate required fields
      if (!client_email) {
        return res.status(400).json({ success: false, error: "client_email is required" });
      }
      if (!customer_name && !customer_email && !customer_phone) {
        return res.status(400).json({ success: false, error: "At least customer_name, customer_email or customer_phone is required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(client_email);
      if (!user) {
        return res.status(404).json({ success: false, error: "Client not found" });
      }

      // Check if review system is enabled
      const config = await storage.getReviewConfig(user.id);
      if (!config || !config.enabled) {
        return res.json({
          success: true,
          created: false,
          reason: "reviews_disabled"
        });
      }

      // Get default incentive if exists
      const incentives = await storage.getReviewIncentives(user.id);
      const defaultIncentive = incentives.find(i => i.isDefault && i.isActive);

      // Generate tracking token
      const trackingToken = `rv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      // Parse reservation date
      let parsedReservationDate = null;
      if (reservation_date) {
        parsedReservationDate = new Date(reservation_date);
      }

      // Create the review request
      const newRequest = await storage.createReviewRequest({
        userId: user.id,
        customerName: customer_name || null,
        customerEmail: customer_email || null,
        customerPhone: customer_phone || null,
        reservationId: reservation_id || null,
        reservationDate: parsedReservationDate,
        reservationTime: reservation_time || null,
        sendMethod: send_method,
        trackingToken,
        incentiveId: defaultIncentive?.id || null,
        status: 'pending',
      });

      console.log(`✅ [N8N Reviews] Request created for ${user.email}: ${newRequest.id}`);

      res.json({
        success: true,
        request_id: newRequest.id,
        tracking_token: trackingToken,
        status: "pending",
        incentive: defaultIncentive ? {
          id: defaultIncentive.id,
          display_message: defaultIncentive.displayMessage
        } : null
      });

    } catch (error: any) {
      console.error("[N8N Reviews] Error creating request:", error);
      res.status(500).json({ success: false, error: "Server error" });
    }
  });

  // 2. POST /api/n8n/reviews/send-request - Send email/SMS for a review request
  app.post("/api/n8n/reviews/send-request", async (req, res) => {
    try {
      if (!validateN8NMasterKey(req)) {
        return res.status(401).json({ success: false, error: "Invalid API key" });
      }

      const { request_id } = req.body;

      if (!request_id) {
        return res.status(400).json({ success: false, error: "request_id is required" });
      }

      // Get the request (admin method - no userId required for N8N)
      const request = await storage.getReviewRequestByIdAdmin(request_id);
      if (!request) {
        return res.status(404).json({ success: false, error: "Request not found" });
      }

      // Get user config
      const config = await storage.getReviewConfig(request.userId);
      if (!config) {
        return res.status(404).json({ success: false, error: "Review config not found" });
      }

      // Get user for email sending
      const user = await storage.getUser(request.userId);
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Get incentive if exists
      let incentive = null;
      if (request.incentiveId) {
        incentive = await storage.getReviewIncentiveById(request.incentiveId, request.userId);
      }

      const FRONTEND_URL = process.env.FRONTEND_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      const reviewLink = `${FRONTEND_URL}/review/${request.trackingToken}`;

      let emailSent = false;
      let smsSent = false;

      // Prepare incentive text
      const incentiveTextEmail = incentive?.displayMessage 
        ? `<div style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:16px;text-align:center;margin:16px 0;">
            <span style="font-size:24px;">🎁</span>
            <p style="margin:8px 0 0;font-size:15px;color:#92400e;font-weight:600;">${incentive.displayMessage}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#b45309;">Valable ${incentive.validityDays} jours</p>
          </div>` 
        : '';

      const incentiveTextSms = incentive?.displayMessage 
        ? `\n\n🎁 ${incentive.displayMessage}` 
        : '';

      // Send email if customer has email and method is email or both
      if (request.customerEmail && (request.sendMethod === 'email' || request.sendMethod === 'both')) {
        const companyName = config.companyName || "notre établissement";
        
        const emailContent = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family:Arial,sans-serif;margin:0;padding:0;background-color:#f5f5f5;">
            <table style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;">
              <tr><td style="background:linear-gradient(135deg,#1a1c1f 0%,#2d2f33 100%);padding:32px;text-align:center;">
                <h1 style="color:#C8B88A;margin:0;font-size:24px;">Votre avis compte !</h1>
              </td></tr>
              <tr><td style="padding:24px;">
                <p style="margin:0 0 16px;font-size:16px;color:#374151;">Bonjour ${request.customerName || 'cher client'},</p>
                <p style="margin:0 0 16px;font-size:16px;color:#374151;">Nous espérons que vous avez passé un agréable moment chez ${companyName}.</p>
                <p style="margin:0 0 24px;font-size:16px;color:#374151;">Votre avis nous aiderait énormément à nous améliorer et à faire connaître notre établissement.</p>
                ${incentiveTextEmail}
                <div style="text-align:center;margin:24px 0;">
                  <a href="${reviewLink}" style="display:inline-block;background-color:#C8B88A;color:#000000;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">
                    ⭐ Laisser mon avis
                  </a>
                </div>
                <p style="margin:24px 0 0;font-size:14px;color:#6b7280;text-align:center;">Merci infiniment pour votre confiance !</p>
              </td></tr>
            </table>
          </body>
          </html>
        `;

        try {
          await sendEmail({
            to: request.customerEmail,
            subject: config.emailSubject || `Votre avis sur ${companyName} nous intéresse !`,
            html: emailContent,
            text: `Bonjour ${request.customerName}, merci de votre visite chez ${companyName} !${incentiveTextSms}\n\nPartagez votre expérience avec nous : ${reviewLink}`,
          });
          emailSent = true;
          console.log(`✅ [N8N Reviews] Email sent to ${request.customerEmail}`);
        } catch (emailError) {
          console.error("[N8N Reviews] Error sending email:", emailError);
        }
      }

      // Prepare SMS data for N8N to send (N8N handles actual SMS sending via Twilio)
      let smsData = null;
      let smsPrepared = false;
      if (request.customerPhone && (request.sendMethod === 'sms' || request.sendMethod === 'both')) {
        const companyName = config.companyName || "notre établissement";
        
        // Build SMS message with global replacement for all placeholders
        const smsMessage = config.smsMessage 
          ? config.smsMessage
              .replaceAll('{nom}', request.customerName || 'Client')
              .replaceAll('{entreprise}', companyName)
              .replaceAll('{lien}', reviewLink)
          : `Bonjour ${request.customerName || ''}, merci pour votre visite chez ${companyName} ! Partagez votre avis : ${reviewLink}${incentiveTextSms}`;
        
        // Return SMS data for N8N to send
        if (config.smsEnabled) {
          smsData = {
            to: request.customerPhone,
            message: smsMessage,
            customer_name: request.customerName,
            company_name: companyName,
            review_link: reviewLink,
            incentive: incentive?.displayMessage || null
          };
          smsPrepared = true;
          smsSent = true; // Indicates N8N should send SMS
          console.log(`📱 [N8N Reviews] SMS data prepared for ${request.customerPhone} - N8N will handle sending`);
        } else {
          console.log("[N8N Reviews] SMS disabled in config, skipping SMS data preparation");
        }
      }

      // Update request status
      await storage.updateReviewRequest(request.id, {
        sentAt: new Date(),
        status: 'sent',
      });

      // Response includes both sms_sent (for N8N compatibility) and sms_data (new payload)
      res.json({
        success: true,
        email_sent: emailSent,
        sms_sent: smsSent, // Keep for N8N workflow compatibility
        sms_enabled: config.smsEnabled || false,
        sms_data: smsData, // New: full SMS payload for N8N to use with Twilio node
        tracking_url: reviewLink
      });

    } catch (error: any) {
      console.error("[N8N Reviews] Error sending request:", error);
      res.status(500).json({ success: false, error: "Server error" });
    }
  });

  // 3. GET /api/n8n/reviews/pending-requests - Get pending requests ready to send
  app.get("/api/n8n/reviews/pending-requests", async (req, res) => {
    try {
      if (!validateN8NMasterKey(req)) {
        return res.status(401).json({ success: false, error: "Invalid API key" });
      }

      const maxAgeHours = parseInt(req.query.max_age_hours as string) || 48;
      const maxAge = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      const readyOnly = req.query.ready_only === 'true';

      // Get all pending requests created within max_age
      const pendingRequests = await storage.getPendingReviewRequests(maxAge);

      // For each request, determine if it's ready to send based on user config
      const requestsWithTiming = await Promise.all(
        pendingRequests.map(async (request: typeof pendingRequests[0]) => {
          const config = await storage.getReviewConfig(request.userId);
          
          let shouldSendAt = new Date(request.createdAt);
          let readyToSend = false;

          if (config) {
            // Calculate when to send based on timing mode
            if (config.timingMode === 'fixed_delay') {
              shouldSendAt = new Date(request.createdAt.getTime() + config.fixedDelayHours * 60 * 60 * 1000);
            } else if (config.timingMode === 'fixed_time' && config.fixedTime) {
              const [hours, minutes] = config.fixedTime.split(':').map(Number);
              shouldSendAt = new Date(request.createdAt);
              shouldSendAt.setHours(hours, minutes, 0, 0);
              if (shouldSendAt <= request.createdAt) {
                shouldSendAt.setDate(shouldSendAt.getDate() + 1);
              }
            } else {
              // Smart mode defaults to 24 hours
              shouldSendAt = new Date(request.createdAt.getTime() + 24 * 60 * 60 * 1000);
            }

            // Check if within send window
            const now = new Date();
            if (now >= shouldSendAt) {
              if (config.sendWindowStart && config.sendWindowEnd) {
                const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                readyToSend = currentTime >= config.sendWindowStart && currentTime <= config.sendWindowEnd;
              } else {
                readyToSend = true;
              }

              // Check weekend avoidance
              if (config.avoidWeekends && (now.getDay() === 0 || now.getDay() === 6)) {
                readyToSend = false;
              }
            }
          }

          return {
            id: request.id,
            user_id: request.userId,
            customer_name: request.customerName,
            customer_email: request.customerEmail,
            customer_phone: request.customerPhone,
            tracking_token: request.trackingToken,
            send_method: request.sendMethod,
            created_at: request.createdAt.toISOString(),
            should_send_at: shouldSendAt.toISOString(),
            ready_to_send: readyToSend
          };
        })
      );

      // Filter to only ready requests if requested
      const filteredRequests = readyOnly 
        ? requestsWithTiming.filter(r => r.ready_to_send)
        : requestsWithTiming;

      res.json({
        success: true,
        requests: filteredRequests
      });

    } catch (error: any) {
      console.error("[N8N Reviews] Error getting pending requests:", error);
      res.status(500).json({ success: false, error: "Server error" });
    }
  });

  // 4. POST /api/n8n/reviews/mark-sent - Mark requests as sent
  app.post("/api/n8n/reviews/mark-sent", async (req, res) => {
    try {
      if (!validateN8NMasterKey(req)) {
        return res.status(401).json({ success: false, error: "Invalid API key" });
      }

      const { request_ids } = req.body;

      if (!Array.isArray(request_ids) || request_ids.length === 0) {
        return res.status(400).json({ success: false, error: "request_ids array is required" });
      }

      let updated = 0;
      for (const id of request_ids) {
        try {
          await storage.updateReviewRequest(id, {
            sentAt: new Date(),
            status: 'sent',
          });
          updated++;
        } catch (err) {
          console.error(`[N8N Reviews] Error marking request ${id} as sent:`, err);
        }
      }

      console.log(`✅ [N8N Reviews] Marked ${updated} requests as sent`);

      res.json({
        success: true,
        updated
      });

    } catch (error: any) {
      console.error("[N8N Reviews] Error marking requests as sent:", error);
      res.status(500).json({ success: false, error: "Server error" });
    }
  });

  // ===== REVIEW SOURCES (Platform Connections) =====

  // Get all connected review sources for user
  app.get("/api/reviews/sources", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const sources = await storage.getReviewSources(userId);
      res.json(sources);
    } catch (error: any) {
      console.error("[ReviewSources] Error getting sources:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Connect TripAdvisor (URL-based, no OAuth)
  app.post("/api/reviews/sources/tripadvisor/connect", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const { tripadvisorUrl, displayName } = req.body;

      if (!tripadvisorUrl) {
        return res.status(400).json({ message: "URL TripAdvisor requise" });
      }

      // Check if TripAdvisor API key is configured
      if (!process.env.TRIPADVISOR_API_KEY) {
        return res.status(503).json({ 
          message: "API TripAdvisor non configurée",
          setupRequired: true
        });
      }

      // Import TripAdvisor service
      const { createTripAdvisorService } = await import('./services/tripadvisor');
      const taService = createTripAdvisorService();
      
      if (!taService) {
        return res.status(503).json({ message: "Service TripAdvisor non disponible" });
      }

      // Extract location ID from URL
      const locationId = taService.extractLocationIdFromUrl(tripadvisorUrl);
      
      if (!locationId) {
        return res.status(400).json({ 
          message: "URL TripAdvisor invalide. Exemple: https://www.tripadvisor.fr/Restaurant_Review-g187147-d15626754-..."
        });
      }

      // Check if already connected
      const existing = await storage.getReviewSourceByPlatform(userId, 'tripadvisor');
      if (existing) {
        return res.status(409).json({ 
          message: "TripAdvisor déjà connecté. Déconnectez d'abord pour reconnecter.",
          existingSource: existing
        });
      }

      // Verify location exists on TripAdvisor
      const locationDetails = await taService.getLocationDetails(locationId);
      
      if (!locationDetails) {
        return res.status(404).json({ 
          message: "Établissement non trouvé sur TripAdvisor. Vérifiez l'URL."
        });
      }

      // Create source
      const source = await storage.createReviewSource({
        userId,
        platform: 'tripadvisor',
        displayName: displayName || locationDetails.name,
        platformLocationId: locationId,
        platformUrl: tripadvisorUrl,
        connectionStatus: 'connected',
        totalReviewsCount: parseInt(locationDetails.num_reviews) || 0,
        averageRating: locationDetails.rating ? Math.round(parseFloat(locationDetails.rating) * 10) : null,
        metadata: {
          address: locationDetails.address_obj?.address_string,
          category: locationDetails.category?.name,
          cuisine: locationDetails.cuisine?.map(c => c.name),
          ranking: locationDetails.ranking_data?.ranking_string,
        },
      });

      console.log(`✅ [ReviewSources] TripAdvisor connected for user ${userId}: ${locationDetails.name}`);

      res.json({
        success: true,
        source,
        locationDetails: {
          name: locationDetails.name,
          address: locationDetails.address_obj?.address_string,
          rating: locationDetails.rating,
          reviewCount: locationDetails.num_reviews,
        }
      });

    } catch (error: any) {
      console.error("[ReviewSources] TripAdvisor connect error:", error);
      res.status(500).json({ message: "Erreur lors de la connexion TripAdvisor" });
    }
  });

  // Disconnect a review source
  app.delete("/api/reviews/sources/:sourceId", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const { sourceId } = req.params;
      
      const source = await storage.getReviewSourceById(sourceId, userId);
      if (!source) {
        return res.status(404).json({ message: "Source non trouvée" });
      }

      await storage.deleteReviewSource(sourceId, userId);

      console.log(`✅ [ReviewSources] Source ${source.platform} disconnected for user ${userId}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[ReviewSources] Delete source error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Trigger manual sync for a source
  app.post("/api/reviews/sources/:sourceId/sync", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const { sourceId } = req.params;
      
      const source = await storage.getReviewSourceById(sourceId, userId);
      if (!source) {
        return res.status(404).json({ message: "Source non trouvée" });
      }

      if (source.connectionStatus !== 'connected') {
        return res.status(400).json({ message: "Source non connectée" });
      }

      // Import sync service
      const { syncReviewSource } = await import('./services/review-sync');
      
      // Start sync (async, don't wait)
      syncReviewSource(source).catch(err => {
        console.error(`[ReviewSources] Sync error for ${sourceId}:`, err);
      });

      res.json({ 
        success: true, 
        message: "Synchronisation démarrée",
        status: 'syncing'
      });
    } catch (error: any) {
      console.error("[ReviewSources] Sync trigger error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get sync logs for a source
  app.get("/api/reviews/sources/:sourceId/logs", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const { sourceId } = req.params;
      
      const source = await storage.getReviewSourceById(sourceId, userId);
      if (!source) {
        return res.status(404).json({ message: "Source non trouvée" });
      }

      const logs = await storage.getSyncLogs(sourceId, 20);
      res.json(logs);
    } catch (error: any) {
      console.error("[ReviewSources] Get sync logs error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get all recent sync logs for user
  app.get("/api/reviews/sync-logs", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const sources = await storage.getReviewSources(userId);
      const allLogs = [];
      
      for (const source of sources) {
        const logs = await storage.getSyncLogs(source.id, 10);
        allLogs.push(...logs);
      }

      // Sort by date descending
      allLogs.sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime());
      
      res.json(allLogs.slice(0, 20));
    } catch (error: any) {
      console.error("[ReviewSyncLogs] Get all error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Sync all sources at once
  app.post("/api/reviews/sources/sync-all", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      const sources = await storage.getReviewSources(userId);
      const activeSources = sources.filter(s => s.connectionStatus === 'connected');

      if (activeSources.length === 0) {
        return res.status(400).json({ message: "Aucune source active à synchroniser" });
      }

      const { syncReviewSource } = await import('./services/review-sync');

      // Start sync for all sources (async)
      for (const source of activeSources) {
        syncReviewSource(source).catch(err => {
          console.error(`[ReviewSources] Sync-all error for ${source.id}:`, err);
        });
      }

      res.json({ 
        success: true, 
        message: `Synchronisation lancée pour ${activeSources.length} source(s)`,
        sourcesCount: activeSources.length
      });
    } catch (error: any) {
      console.error("[ReviewSources] Sync-all error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Google OAuth - Initiate connection
  app.get("/api/reviews/oauth/google/connect", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      // Check if OAuth is configured
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(503).json({ 
          message: "OAuth Google non configuré",
          setupRequired: true,
          requiredSecrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
        });
      }

      const { generateGoogleOAuthUrl } = await import('./services/google-business');
      
      const frontendUrl = process.env.FRONTEND_URL || `https://${req.headers.host}`;
      const redirectUri = `${frontendUrl}/api/reviews/oauth/google/callback`;
      const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

      const authUrl = generateGoogleOAuthUrl(redirectUri, state);
      
      res.json({ authUrl });
    } catch (error: any) {
      console.error("[GoogleOAuth] Connect error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Google OAuth - Callback
  app.get("/api/reviews/oauth/google/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        console.error("[GoogleOAuth] Auth error:", error);
        return res.redirect('/reviews/settings?error=google_auth_failed');
      }

      if (!code || !state) {
        return res.redirect('/reviews/settings?error=missing_params');
      }

      // Decode state to get userId
      let stateData;
      try {
        stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
      } catch {
        return res.redirect('/reviews/settings?error=invalid_state');
      }

      const userId = stateData.userId;
      if (!userId) {
        return res.redirect('/reviews/settings?error=no_user');
      }

      const { exchangeGoogleAuthCode, GoogleBusinessService } = await import('./services/google-business');
      
      const frontendUrl = process.env.FRONTEND_URL || `https://${req.headers.host}`;
      const redirectUri = `${frontendUrl}/api/reviews/oauth/google/callback`;

      const tokens = await exchangeGoogleAuthCode(code as string, redirectUri);
      
      if (!tokens) {
        return res.redirect('/reviews/settings?error=token_exchange_failed');
      }

      // Get accounts and locations
      const service = new GoogleBusinessService(tokens.accessToken);
      const accounts = await service.listAccounts();

      if (accounts.length === 0) {
        return res.redirect('/reviews/settings?error=no_google_accounts');
      }

      // For now, use first account's first location
      // TODO: Add UI to select location
      const firstAccount = accounts[0];
      const locations = await service.listLocations(firstAccount.name);

      if (locations.length === 0) {
        return res.redirect('/reviews/settings?error=no_google_locations');
      }

      const firstLocation = locations[0];

      // Check if already connected
      const existing = await storage.getReviewSourceByPlatform(userId, 'google');
      if (existing) {
        // Update existing
        await storage.updateReviewSource(existing.id, userId, {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
          connectionStatus: 'connected',
          connectionError: null,
          displayName: firstLocation.title || firstLocation.locationName,
          platformLocationId: firstLocation.name,
          platformUrl: firstLocation.metadata?.mapsUri || null,
          metadata: {
            accountName: firstAccount.name,
            locationName: firstLocation.name,
            placeId: firstLocation.metadata?.placeId,
          },
        });
      } else {
        // Create new
        await storage.createReviewSource({
          userId,
          platform: 'google',
          displayName: firstLocation.title || firstLocation.locationName,
          platformLocationId: firstLocation.name,
          platformUrl: firstLocation.metadata?.mapsUri || null,
          connectionStatus: 'connected',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
          tokenScopes: 'business.manage',
          metadata: {
            accountName: firstAccount.name,
            locationName: firstLocation.name,
            placeId: firstLocation.metadata?.placeId,
          },
        });
      }

      console.log(`✅ [GoogleOAuth] Connected for user ${userId}: ${firstLocation.title}`);
      
      res.redirect('/reviews/settings?success=google_connected');
    } catch (error: any) {
      console.error("[GoogleOAuth] Callback error:", error);
      res.redirect('/reviews/settings?error=callback_failed');
    }
  });

  // Facebook OAuth - Initiate connection
  app.get("/api/reviews/oauth/facebook/connect", requireAuth, async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Non authentifié" });
      }

      // Check if OAuth is configured
      if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
        return res.status(503).json({ 
          message: "OAuth Facebook non configuré",
          setupRequired: true,
          requiredSecrets: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']
        });
      }

      const { generateFacebookOAuthUrl } = await import('./services/facebook-pages');
      
      const frontendUrl = process.env.FRONTEND_URL || `https://${req.headers.host}`;
      const redirectUri = `${frontendUrl}/api/reviews/oauth/facebook/callback`;
      const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

      const authUrl = generateFacebookOAuthUrl(redirectUri, state);
      
      res.json({ authUrl });
    } catch (error: any) {
      console.error("[FacebookOAuth] Connect error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Facebook OAuth - Callback
  app.get("/api/reviews/oauth/facebook/callback", async (req, res) => {
    try {
      const { code, state, error_reason } = req.query;

      if (error_reason) {
        console.error("[FacebookOAuth] Auth error:", error_reason);
        return res.redirect('/reviews/settings?error=facebook_auth_failed');
      }

      if (!code || !state) {
        return res.redirect('/reviews/settings?error=missing_params');
      }

      // Decode state
      let stateData;
      try {
        stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
      } catch {
        return res.redirect('/reviews/settings?error=invalid_state');
      }

      const userId = stateData.userId;
      if (!userId) {
        return res.redirect('/reviews/settings?error=no_user');
      }

      const { exchangeFacebookAuthCode, getLongLivedToken, FacebookPagesService } = await import('./services/facebook-pages');
      
      const frontendUrl = process.env.FRONTEND_URL || `https://${req.headers.host}`;
      const redirectUri = `${frontendUrl}/api/reviews/oauth/facebook/callback`;

      const shortLivedToken = await exchangeFacebookAuthCode(code as string, redirectUri);
      
      if (!shortLivedToken) {
        return res.redirect('/reviews/settings?error=token_exchange_failed');
      }

      // Exchange for long-lived token
      const longLivedToken = await getLongLivedToken(shortLivedToken.accessToken);
      const finalToken = longLivedToken || shortLivedToken;

      // Get user's pages
      const service = new FacebookPagesService(finalToken.accessToken);
      const pages = await service.getUserPages();

      if (pages.length === 0) {
        return res.redirect('/reviews/settings?error=no_facebook_pages');
      }

      // For now, use first page
      // TODO: Add UI to select page
      const firstPage = pages[0];

      // Check if already connected
      const existing = await storage.getReviewSourceByPlatform(userId, 'facebook');
      if (existing) {
        // Update existing
        await storage.updateReviewSource(existing.id, userId, {
          accessToken: firstPage.access_token, // Page access token
          tokenExpiry: new Date(Date.now() + finalToken.expiresIn * 1000),
          connectionStatus: 'connected',
          connectionError: null,
          displayName: firstPage.name,
          platformLocationId: firstPage.id,
          platformUrl: firstPage.link || `https://facebook.com/${firstPage.id}`,
          totalReviewsCount: firstPage.rating_count || 0,
          averageRating: firstPage.overall_star_rating ? Math.round(firstPage.overall_star_rating * 10) : null,
          metadata: {
            category: firstPage.category,
            userAccessToken: finalToken.accessToken,
          },
        });
      } else {
        // Create new
        await storage.createReviewSource({
          userId,
          platform: 'facebook',
          displayName: firstPage.name,
          platformLocationId: firstPage.id,
          platformUrl: firstPage.link || `https://facebook.com/${firstPage.id}`,
          connectionStatus: 'connected',
          accessToken: firstPage.access_token,
          tokenExpiry: new Date(Date.now() + finalToken.expiresIn * 1000),
          tokenScopes: 'pages_read_user_content,pages_read_engagement',
          totalReviewsCount: firstPage.rating_count || 0,
          averageRating: firstPage.overall_star_rating ? Math.round(firstPage.overall_star_rating * 10) : null,
          metadata: {
            category: firstPage.category,
            userAccessToken: finalToken.accessToken,
          },
        });
      }

      console.log(`✅ [FacebookOAuth] Connected for user ${userId}: ${firstPage.name}`);
      
      res.redirect('/reviews/settings?success=facebook_connected');
    } catch (error: any) {
      console.error("[FacebookOAuth] Callback error:", error);
      res.redirect('/reviews/settings?error=callback_failed');
    }
  });

  // ===== MARKETING MODULE ROUTES =====
  registerMarketingRoutes(app);
  
  // Register integration routes
  app.use("/api/integrations", integrationRoutes);

  const httpServer = createServer(app);

  return httpServer;
}
