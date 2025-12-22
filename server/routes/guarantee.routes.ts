// Guarantee (CB Anti No-Show) Routes Module
import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  storage,
  stripe,
  requireAuth,
  getFrontendUrl,
} from "./middleware";
import { requireApiKey } from "../api-key-auth";
import { sendCardRequestEmail, sendConfirmationEmail, isEmailConfigured } from "../services/guarantee-email.service";
import { sendGuaranteeCardRequestSms, sendGuaranteeConfirmationSms, isSmsConfigured } from "../services/twilio-sms.service";

const router = Router();

// Helper function to parse French date formats like "20 décembre 2025" or "2025-12-20"
function parseFrenchDate(dateString: string): Date {
  if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    return new Date(dateString);
  }
  
  const frenchMonths: { [key: string]: number } = {
    'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3,
    'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7, 'aout': 7,
    'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11, 'decembre': 11
  };
  
  const frenchDateRegex = /(\d{1,2})\s+(\w+)\s+(\d{4})/i;
  const match = dateString.match(frenchDateRegex);
  
  if (match) {
    const day = parseInt(match[1], 10);
    const monthName = match[2].toLowerCase();
    const year = parseInt(match[3], 10);
    const month = frenchMonths[monthName];
    
    if (month !== undefined) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }
  
  const parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  console.warn(`[Guarantee] Could not parse date: "${dateString}", using today's date`);
  return new Date();
}

// Validation schemas
const guaranteeConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  penaltyAmount: z.number().min(1).max(200).optional(),
  cancellationDelay: z.number().min(1).max(72).optional(),
  applyTo: z.enum(['all', 'min_persons', 'weekend']).optional(),
  minPersons: z.number().min(1).max(20).optional(),
  logoUrl: z.string().url().nullable().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  senderEmail: z.string().email().nullable().optional(),
  gmailSenderEmail: z.string().email().nullable().optional(),
  gmailSenderName: z.string().max(100).nullable().optional(),
  termsUrl: z.string().url().nullable().optional(),
  companyName: z.string().max(200).nullable().optional(),
  companyAddress: z.string().max(500).nullable().optional(),
  companyPhone: z.string().max(20).nullable().optional(),
  smsEnabled: z.boolean().optional(),
});

const guaranteeSessionCreateSchema = z.object({
  reservation_id: z.string().min(1).max(200),
  customer_name: z.string().min(1).max(200),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().max(20).optional(),
  nb_persons: z.number().min(1).max(100).optional().default(1),
  reservation_date: z.string().min(1),
  reservation_time: z.string().optional(),
  agent_id: z.string().optional(),
  business_type: z.string().optional(),
  calendar_id: z.string().optional(),
  company_name: z.string().optional(),
  company_email: z.string().email().optional(),
  timezone: z.string().default("Europe/Paris"),
  duration: z.number().int().optional(),
  vehicule: z.string().optional(),
  type_service: z.string().optional(),
});

const guaranteeStatusUpdateSchema = z.object({
  status: z.enum(['attended', 'noshow']),
});

// ===== PUBLIC ENDPOINTS (N8N) =====

// Handle missing agent_id
router.get("/status/", (req, res) => {
  res.status(400).json({ 
    guarantee_enabled: false,
    error: "agent_id requis dans l'URL",
    example: "/api/guarantee/status/agent_xxxxx"
  });
});

// Check if guarantee is enabled for an agent
router.get("/status/:agent_id", async (req, res) => {
  try {
    const { agent_id } = req.params;
    
    if (!agent_id) {
      return res.status(400).json({ 
        guarantee_enabled: false,
        error: "agent_id requis" 
      });
    }
    
    const userWithAgent = await storage.getUserByAgentId(agent_id);
    
    if (!userWithAgent) {
      return res.json({ 
        guarantee_enabled: false,
        reason: "agent_not_found"
      });
    }
    
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

// ===== CONFIG ENDPOINTS =====

// Get guarantee config for current user
router.get("/config", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const config = await storage.getGuaranteeConfig(userId);
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
router.put("/config", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    const validationResult = guaranteeConfigUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Données invalides",
        errors: validationResult.error.errors
      });
    }
    
    const updates = validationResult.data;
    
    if (updates.enabled === true) {
      const existingConfig = await storage.getGuaranteeConfig(userId);
      if (!existingConfig?.stripeAccountId) {
        delete updates.enabled;
        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ 
            message: "Connectez d'abord votre compte Stripe pour activer la garantie" 
          });
        }
        const config = await storage.upsertGuaranteeConfig(userId, updates);
        return res.json({ 
          success: true, 
          config,
          warning: "Configuration sauvegardée. Connectez Stripe pour activer la garantie."
        });
      }
      
      try {
        const account = await stripe.accounts.retrieve(existingConfig.stripeAccountId);
        if (!account.charges_enabled || !account.details_submitted) {
          delete updates.enabled;
          if (Object.keys(updates).length === 0) {
            return res.status(400).json({ 
              message: "Veuillez compléter la configuration de votre compte Stripe" 
            });
          }
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

// ===== TEST ENDPOINTS =====

// Send test email
router.post("/test-email", requireAuth, async (req, res) => {
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
      reservationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

// Send test SMS
router.post("/test-sms", requireAuth, async (req, res) => {
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

    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ message: "Numéro de téléphone requis" });
    }

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
      2
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

// ===== STRIPE CONNECT =====

// Create Stripe Connect Express account
router.post("/connect-stripe", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    
    const existingConfig = await storage.getGuaranteeConfig(userId);
    if (existingConfig?.stripeAccountId) {
      try {
        const account = await stripe.accounts.retrieve(existingConfig.stripeAccountId);
        if (account.charges_enabled && account.details_submitted) {
          return res.json({ 
            already_connected: true,
            accountId: existingConfig.stripeAccountId
          });
        }
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
        await storage.upsertGuaranteeConfig(userId, { stripeAccountId: null });
      }
    }
    
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
    
    await storage.upsertGuaranteeConfig(userId, {
      stripeAccountId: account.id,
    });
    
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

// Stripe Connect callback (legacy)
router.get("/stripe-callback", async (req, res) => {
  const { error, error_description } = req.query;
  
  if (error) {
    console.error('[Guarantee] Callback error:', error, error_description);
    return res.redirect(`/settings/guarantee?stripe_error=${encodeURIComponent(error_description as string || 'Erreur')}`);
  }
  
  res.redirect('/settings/guarantee?stripe_connected=true');
});

// Legacy OAuth callback handler
router.get("/stripe-oauth-callback", async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    if (error) {
      console.error('[Guarantee] OAuth error:', error, error_description);
      return res.redirect(`/settings/guarantee?stripe_error=${encodeURIComponent(error_description as string || 'Autorisation refusée')}`);
    }
    
    if (!code || !state) {
      return res.redirect('/settings/guarantee?stripe_error=Paramètres manquants');
    }
    
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
    } catch (e) {
      return res.redirect('/settings/guarantee?stripe_error=État invalide');
    }
    
    const { userId, timestamp } = stateData;
    
    if (Date.now() - timestamp > 15 * 60 * 1000) {
      return res.redirect('/settings/guarantee?stripe_error=Session expirée, veuillez réessayer');
    }
    
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
    
    await storage.upsertGuaranteeConfig(userId, {
      stripeAccountId,
    });
    
    console.log('[Guarantee] Stripe account connected:', stripeAccountId, 'for user:', userId);
    
    res.redirect('/settings/guarantee?stripe_connected=true');
  } catch (error: any) {
    console.error('[Guarantee] Callback error:', error);
    res.redirect(`/settings/guarantee?stripe_error=${encodeURIComponent('Erreur de connexion')}`);
  }
});

// Get Stripe Connect account status
router.get("/stripe-status", requireAuth, async (req, res) => {
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
router.post("/disconnect-stripe", requireAuth, async (req, res) => {
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

// ===== SESSIONS (N8N + Dashboard) =====

// Check if guarantee is enabled for a client (N8N via API key)
router.get("/check-status", requireApiKey, async (req, res) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    
    const config = await storage.getGuaranteeConfig(userId);
    const user = await storage.getUser(userId);
    
    if (!config) {
      return res.json({
        success: true,
        guaranteeEnabled: false,
        reason: "no_config",
        message: "Configuration garantie CB non trouvée"
      });
    }
    
    if (!config.enabled) {
      return res.json({
        success: true,
        guaranteeEnabled: false,
        reason: "disabled",
        message: "Garantie CB désactivée"
      });
    }
    
    if (!config.stripeAccountId) {
      return res.json({
        success: true,
        guaranteeEnabled: false,
        reason: "stripe_not_connected",
        message: "Compte Stripe non connecté"
      });
    }
    
    res.json({
      success: true,
      guaranteeEnabled: true,
      config: {
        penaltyAmount: config.penaltyAmount,
        cancellationDelay: config.cancellationDelay,
        applyTo: config.applyTo,
        minPersons: config.minPersons,
        companyName: config.companyName || user?.companyName,
        smsEnabled: config.smsEnabled,
        autoSendEmailOnCreate: config.autoSendEmailOnCreate,
        autoSendSmsOnCreate: config.autoSendSmsOnCreate,
      }
    });
  } catch (error: any) {
    console.error('[Guarantee] Error checking status:', error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Create guarantee session (N8N via API key)
router.post("/create-session", requireApiKey, async (req, res) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    
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
    
    const config = await storage.getGuaranteeConfig(userId);
    const user = await storage.getUser(userId);
    
    if (!config || !config.enabled) {
      return res.json({ 
        success: true,
        guaranteeRequired: false,
        reason: "disabled",
        message: "Garantie CB non activée pour ce compte"
      });
    }
    
    const reservationDate = parseFrenchDate(data.reservation_date);
    const dayOfWeek = reservationDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
    
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
    
    const guaranteeShortCode = `g${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
    
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
      shortCode: guaranteeShortCode,
      status: 'pending',
      agentId: data.agent_id,
      businessType: data.business_type,
      calendarId: data.calendar_id,
      companyName: data.company_name || config.companyName,
      companyEmail: data.company_email,
      timezone: data.timezone || 'Europe/Paris',
      duration: data.duration,
      vehicule: data.vehicule,
      typeService: data.type_service,
    });
    
    const notificationResults = {
      emailSent: false,
      smsSent: false,
      emailError: null as string | null,
      smsError: null as string | null,
    };
    
    const shortValidationUrl = `${frontendUrl}/guarantee/validate/${session.id}`;
    
    if (config.autoSendEmailOnCreate !== false && data.customer_email && isEmailConfigured()) {
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
    
    res.json({
      success: true,
      guaranteeRequired: true,
      sessionId: session.id,
      url: `${frontendUrl}/guarantee/validate/${session.id}`,
      checkoutUrl: checkoutSession.url,
      status: 'pending',
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
      payment_validated: false,
      calendar_booking_allowed: false,
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

// Get reservations with guarantee (dashboard)
router.get("/reservations", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const period = (req.query.period as 'today' | 'week' | 'month') || 'week';
    
    const allSessions = await storage.getGuaranteeSessions(userId, { period });
    
    const pending = allSessions.filter(s => s.status === 'pending');
    const validated = allSessions.filter(s => s.status === 'validated');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayReservations = validated.filter(s => {
      const resDate = new Date(s.reservationDate);
      return resDate >= today && resDate < tomorrow;
    });
    
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
router.post("/reservations/:id/status", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const sessionId = req.params.id;
    
    const validationResult = guaranteeStatusUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Statut invalide",
        errors: validationResult.error.errors
      });
    }
    
    const { status } = validationResult.data;
    
    const session = await storage.getGuaranteeSessionById(sessionId);
    
    if (!session || session.userId !== userId) {
      return res.status(404).json({ message: "Session non trouvée" });
    }
    
    if (session.status !== 'validated') {
      return res.status(400).json({ message: "Session non validée" });
    }
    
    if (status === 'attended') {
      await storage.updateGuaranteeSession(sessionId, {
        status: 'completed',
      });
      
      return res.json({ success: true, charged: false });
    }
    
    if (status === 'noshow') {
      const config = await storage.getGuaranteeConfig(userId);
      
      if (!config?.stripeAccountId) {
        return res.status(400).json({ message: "Compte Stripe non connecté" });
      }
      
      try {
        const setupIntent = await stripe.setupIntents.retrieve(
          session.setupIntentId!,
          { stripeAccount: config.stripeAccountId }
        );
        
        const paymentMethodId = setupIntent.payment_method as string;
        
        const amountCents = session.penaltyAmount * session.nbPersons * 100;
        
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
        
        await storage.updateGuaranteeSession(sessionId, {
          status: 'noshow_charged',
          chargedAmount: amountCents,
          chargedAt: new Date(),
          paymentMethodId,
        });
        
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
        
        await storage.updateGuaranteeSession(sessionId, {
          status: 'noshow_failed',
        });
        
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
router.post("/resend/:id", requireAuth, async (req, res) => {
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
    
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'setup',
      payment_method_types: ['card'],
      customer_email: session.customerEmail || undefined,
      success_url: `${process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'https://vocaledash.com'}/guarantee/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'https://vocaledash.com'}/guarantee/annulation`,
      metadata: {
        speedai_user_id: userId,
        reservation_id: session.reservationId,
        customer_name: session.customerName,
        nb_persons: String(session.nbPersons),
      },
    }, {
      stripeAccount: config.stripeAccountId,
    });
    
    await storage.updateGuaranteeSession(sessionId, {
      checkoutSessionId: checkoutSession.id,
      reminderCount: session.reminderCount + 1,
      lastReminderAt: new Date(),
    });
    
    res.json({
      success: true,
      checkout_url: checkoutSession.url,
      public_url: `${process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'https://vocaledash.com'}/g/${sessionId}`,
    });
  } catch (error: any) {
    console.error('[Guarantee] Error resending link:', error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Cancel guarantee session
router.post("/cancel/:id", requireAuth, async (req, res) => {
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

// ===== STATS & HISTORY =====

// Get guarantee stats
router.get("/stats", requireAuth, async (req, res) => {
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
router.get("/history", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const period = (req.query.period as 'week' | 'month' | 'year' | 'all') || 'month';
    
    const charges = await storage.getNoshowCharges(userId, period);
    
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

// ===== N8N SESSION DETAILS =====

// Get session details for N8N workflow
router.get("/session-details/:sessionId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
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
    
    if (!sessionId || sessionId.length > 100) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid session ID" 
      });
    }
    
    const session = await storage.getGuaranteeSessionById(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: "Session not found" 
      });
    }
    
    const config = await storage.getGuaranteeConfig(session.userId);
    
    if (!config) {
      return res.status(404).json({ 
        success: false, 
        error: "Client config not found" 
      });
    }
    
    const user = await storage.getUser(session.userId);
    
    let reservationTimeEnd = null;
    if (session.reservationTime) {
      const [hours, minutes] = session.reservationTime.split(':').map(Number);
      const endHours = hours + 2;
      reservationTimeEnd = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    
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
        calendarId: null,
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

router.post("/confirm-booking", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
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
    
    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: "session_id is required" 
      });
    }
    
    const session = await storage.getGuaranteeSessionById(session_id);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: "Session not found" 
      });
    }
    
    console.log(`📅 [N8N] Calendar booking confirmation for session ${session_id}:`, {
      calendar_event_id,
      calendar_event_link,
      booking_status,
      error_message
    });
    
    if (booking_status === 'success' || booking_status === 'booked') {
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
router.get("/public/session/:sessionId", async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
    if (!sessionId || sessionId.length > 100) {
      return res.status(400).json({ message: "ID de session invalide" });
    }
    
    const session = await storage.getGuaranteeSessionById(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Session non trouvée" });
    }
    
    if (session.status === 'pending') {
      const createdAt = new Date(session.createdAt);
      const expiryDate = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (new Date() > expiryDate) {
        return res.status(410).json({ message: "Session expirée" });
      }
    }
    
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
router.post("/public/checkout/:sessionId", async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
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
        
        if (checkoutSession.url && checkoutSession.status === 'open') {
          checkoutUrl = checkoutSession.url;
        }
      } catch (stripeError: any) {
        console.log(`[Guarantee] Stripe session expired or invalid, creating new one: ${stripeError.message}`);
      }
    }
    
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

// Validate session after Stripe checkout
router.post("/webhook/checkout-complete", async (req, res) => {
  try {
    const { checkout_session_id } = req.body;
    
    if (!checkout_session_id || typeof checkout_session_id !== 'string') {
      return res.status(400).json({ message: "checkout_session_id requis" });
    }
    
    const session = await storage.getGuaranteeSessionByCheckoutSessionId(checkout_session_id);
    
    if (!session) {
      return res.status(404).json({ message: "Session non trouvée" });
    }
    
    if (session.status === 'validated') {
      return res.json({ success: true, already_validated: true });
    }
    
    const config = await storage.getGuaranteeConfig(session.userId);
    
    if (!config?.stripeAccountId) {
      return res.status(400).json({ message: "Configuration Stripe manquante" });
    }
    
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
    
    if (stripeCheckoutSession.status !== 'complete') {
      return res.status(400).json({ 
        message: "Session de paiement non complétée",
        stripe_status: stripeCheckoutSession.status
      });
    }
    
    const setupIntent = stripeCheckoutSession.setup_intent as any;
    const paymentMethodId = setupIntent?.payment_method?.id || setupIntent?.payment_method;
    const customerStripeId = stripeCheckoutSession.customer as string;
    
    await storage.updateGuaranteeSession(session.id, {
      status: 'validated',
      validatedAt: new Date(),
      setupIntentId: setupIntent?.id,
      customerStripeId: customerStripeId || null,
      paymentMethodId: paymentMethodId || null,
    });
    
    try {
      if (session.customerEmail) {
        await sendConfirmationEmail({ config, session });
        console.log(`📧 [Guarantee] Confirmation email sent to ${session.customerEmail}`);
      }
      
      if (session.customerPhone) {
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
    }
    
    try {
      const n8nWebhookUrl = 'https://djeydejy.app.n8n.cloud/webhook/garantie-nouvelle-resa';
      
      const user = await storage.getUser(session.userId);
      
      let speedaiClient = null;
      if (session.agentId) {
        speedaiClient = await storage.getSpeedaiClientByAgentId(session.agentId);
      }
      
      const timezone = session.timezone || config.timezone || speedaiClient?.timezone || 'Europe/Paris';
      const reservationDate = new Date(session.reservationDate);
      
      let hours = 12, minutes = 0;
      if (session.reservationTime) {
        const timeMatch = session.reservationTime.match(/(\d{1,2})[h:](\d{2})/i);
        if (timeMatch) {
          hours = parseInt(timeMatch[1], 10);
          minutes = parseInt(timeMatch[2], 10);
        }
      }
      
      const startDate = new Date(reservationDate);
      startDate.setHours(hours, minutes, 0, 0);
      
      const durationMinutes = session.duration || 60;
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
      
      const startDatetime = startDate.toISOString();
      const endDatetime = endDate.toISOString();
      
      const dayStart = new Date(reservationDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(reservationDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      const webhookPayload = {
        event: 'card_validated',
        session_id: session.id,
        reservation_id: session.reservationId,
        validated_at: new Date().toISOString(),
        payment_method_id: paymentMethodId,
        calendar_id: session.calendarId || config.calendarId || null,
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        timeZone: timezone,
        calendar_platform: 'google_calendar',
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        nom_client: session.customerName,
        customer_name: session.customerName,
        client_email: session.customerEmail,
        customer_email: session.customerEmail,
        client_phone: session.customerPhone,
        customer_phone: session.customerPhone,
        nb_personnes: session.nbPersons,
        nb_persons: session.nbPersons,
        date_demandee: session.reservationDate,
        reservation_date: session.reservationDate,
        heure_demandee: session.reservationTime,
        reservation_time: session.reservationTime,
        minimum_duration: durationMinutes,
        duration: durationMinutes,
        agency_id: session.agentId,
        agent_id: session.agentId,
        business_type: session.businessType || speedaiClient?.businessType || 'restaurant',
        company_name: session.companyName || config.companyName || speedaiClient?.businessName,
        agency_name: speedaiClient?.businessName || config.companyName,
        company_email: session.companyEmail || config.senderEmail || speedaiClient?.contactEmail,
        company_phone: config.companyPhone || speedaiClient?.contactPhone,
        company_address: config.companyAddress,
        email_from_resend: config.senderEmail || 'garantie@rdv-notif.tech',
        email_enabled: config.autoSendEmailOnValidation ?? true,
        sms_enabled: config.smsEnabled ?? false,
        auto_send_email_on_create: config.autoSendEmailOnCreate ?? true,
        auto_send_sms_on_create: config.autoSendSmsOnCreate ?? false,
        auto_send_email_on_validation: config.autoSendEmailOnValidation ?? true,
        auto_send_sms_on_validation: config.autoSendSmsOnValidation ?? false,
        timezone: timezone,
        max_capacity: config.minPersons || 1,
        penalty_amount: config.penaltyAmount || 30,
        cancellation_delay: config.cancellationDelay || 24,
        logo_url: config.logoUrl,
        brand_color: config.brandColor || '#C8B88A',
        terms_url: config.termsUrl,
        resume: `Réservation ${session.customerName} - ${session.nbPersons} pers.`,
        description: `📅 Réservation ${session.businessType || 'Restaurant'}\n👤 Client : ${session.customerName}\n👥 Personnes : ${session.nbPersons}\n📞 Téléphone : ${session.customerPhone || 'N/A'}\n📧 Email : ${session.customerEmail || 'N/A'}\n🔒 CB Garantie validée`,
        vehicule: session.vehicule,
        type_service: session.typeService,
        api_key: user?.apiKey || null,
        dashboard_url: process.env.FRONTEND_URL || 'https://vocaledash.com',
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
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Guarantee] Error validating session:', error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
