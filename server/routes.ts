// Reference: javascript_stripe blueprint for Stripe integration
import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  generateVerificationToken,
  getVerificationTokenExpiry,
  toPublicUser,
  requireAuth,
  requireVerified,
  requireSubscription
} from "./auth";
import { sendVerificationEmail } from "./email";
import { insertUserSchema, loginSchema } from "@shared/schema";
import { z } from "zod";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('Missing required Stripe secret: STRIPE_WEBHOOK_SECRET');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
});

// Stripe price ID - you need to create a product in Stripe dashboard
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "price_1234567890"; // Replace with real price ID
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
        return res.status(400).json({ message: "Un compte existe déjà avec cet email" });
      }

      // Hash password
      const hashedPassword = await hashPassword(data.password);

      // Create user
      const user = await storage.createUser({
        email: data.email,
        password: hashedPassword,
      });

      // Generate verification token
      const verificationToken = generateVerificationToken();
      const tokenExpiry = getVerificationTokenExpiry();
      await storage.setVerificationToken(user.id, verificationToken, tokenExpiry);

      // Send verification email (don't fail if email sending fails)
      try {
        await sendVerificationEmail(user.email, verificationToken);
      } catch (emailError) {
        console.error("Failed to send verification email (non-critical):", emailError);
        // Continue anyway - user can verify via manual link if needed
      }

      res.status(201).json({ 
        message: "Inscription réussie. Veuillez vérifier votre email.",
        userId: user.id 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
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
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      // Verify password
      const isValid = await comparePassword(data.password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Email ou mot de passe incorrect" });
      }

      // Generate token
      const token = generateToken(user.id);

      // Set httpOnly cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({ 
        message: "Connexion réussie",
        user: toPublicUser(user)
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
    res.json(toPublicUser(user));
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('auth_token');
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
      await storage.setVerificationToken(user.id, verificationToken, tokenExpiry);

      // Send email
      await sendVerificationEmail(user.email, verificationToken);

      res.json({ message: "Email de vérification renvoyé" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Erreur lors de l'envoi" });
    }
  });

  // ===== SUBSCRIPTION ROUTES =====

  // Create subscription
  app.post("/api/subscription/create", requireAuth, requireVerified, async (req, res) => {
    try {
      const user = (req as any).user;

      // If user already has a subscription, retrieve it
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        
        if (subscription.latest_invoice && typeof subscription.latest_invoice !== 'string') {
          const paymentIntent = subscription.latest_invoice.payment_intent;
          if (paymentIntent && typeof paymentIntent !== 'string') {
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
        await storage.updateStripeInfo(user.id, { stripeCustomerId: customerId });
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: STRIPE_PRICE_ID }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      // Update user with subscription ID
      await storage.updateStripeInfo(user.id, {
        stripeSubscriptionId: subscription.id,
      });

      const invoice = subscription.latest_invoice;
      if (invoice && typeof invoice !== 'string') {
        const paymentIntent = invoice.payment_intent;
        if (paymentIntent && typeof paymentIntent !== 'string') {
          return res.json({
            subscriptionId: subscription.id,
            clientSecret: paymentIntent.client_secret,
          });
        }
      }

      res.status(500).json({ message: "Erreur lors de la création de l'abonnement" });
    } catch (error: any) {
      console.error("Create subscription error:", error);
      res.status(500).json({ message: error.message || "Erreur lors de la création de l'abonnement" });
    }
  });

  // Stripe webhook
  app.post("/api/webhooks/stripe", async (req, res) => {
    const sig = req.headers['stripe-signature'];

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
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          // Find user by customer ID
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.updateStripeInfo(user.id, {
              subscriptionStatus: subscription.status,
              subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
            });
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.updateStripeInfo(user.id, {
              subscriptionStatus: 'canceled',
            });
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
            const customerId = subscription.customer as string;
            
            const user = await storage.getUserByStripeCustomerId(customerId);
            if (user) {
              await storage.updateStripeInfo(user.id, {
                subscriptionStatus: 'active',
                subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
              });
            }
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.subscription && invoice.customer) {
            const customerId = invoice.customer as string;
            const user = await storage.getUserByStripeCustomerId(customerId);
            if (user) {
              await storage.updateStripeInfo(user.id, {
                subscriptionStatus: 'past_due',
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

  app.get("/api/stats", requireAuth, requireVerified, requireSubscription, async (req, res) => {
    // Future: Return real call statistics
    res.json({
      totalCalls: 0,
      averageDuration: 0,
      responseRate: 0,
      uniqueCallers: 0,
    });
  });

  app.get("/api/calls", requireAuth, requireVerified, requireSubscription, async (req, res) => {
    // Future: Return call history
    res.json([]);
  });

  const httpServer = createServer(app);

  return httpServer;
}
