// Reviews & Reputation Management Routes
import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  storage,
  requireAuth,
  getFrontendUrl,
} from "./middleware";
import { sendEmail } from "../gmail-email";
import { insertReviewAutomationSchema } from "@shared/schema";
import { sendThankYouMessage } from "../services/review-thank-you.service";
import { getDataOwnerContext } from "../utils/tenant-context";

const router = Router();

// ===== REVIEWS & REPUTATION MANAGEMENT ROUTES =====

// Get review configuration
router.get("/config", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Try tenant-aware lookup first
    let config;
    try {
      const ownerContext = await getDataOwnerContext(req);
      const owner = ownerContext.useBy === 'tenantId' 
        ? { tenantId: ownerContext.id, userId }
        : { userId: ownerContext.id };
      config = await storage.getReviewConfigByOwner(owner);
      
      if (!config) {
        config = await storage.upsertReviewConfigByOwner(owner, { enabled: false });
      }
    } catch {
      // Fallback to userId-only lookup
      config = await storage.getReviewConfig(userId);
      if (!config) {
        config = await storage.upsertReviewConfig(userId, { enabled: false });
      }
    }
    
    res.json(config);
  } catch (error: any) {
    console.error("[Reviews] Error fetching config:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Update review configuration
router.put("/config", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const updates = req.body;
    
    // Try tenant-aware update first
    let config;
    try {
      const ownerContext = await getDataOwnerContext(req);
      const owner = ownerContext.useBy === 'tenantId' 
        ? { tenantId: ownerContext.id, userId }
        : { userId: ownerContext.id };
      config = await storage.upsertReviewConfigByOwner(owner, updates);
    } catch {
      // Fallback to userId-only update
      config = await storage.upsertReviewConfig(userId, updates);
    }
    
    res.json(config);
  } catch (error: any) {
    console.error("[Reviews] Error updating config:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Get all incentives
router.get("/incentives", requireAuth, async (req, res) => {
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
router.post("/incentives", requireAuth, async (req, res) => {
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
router.put("/incentives/:id", requireAuth, async (req, res) => {
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
router.delete("/incentives/:id", requireAuth, async (req, res) => {
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
router.post("/incentives/:id/default", requireAuth, async (req, res) => {
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
router.get("/requests", requireAuth, async (req, res) => {
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
router.post("/requests", requireAuth, async (req, res) => {
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
    const shortCode = `r${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
    
    const request = await storage.createReviewRequest({
      userId,
      customerName,
      customerEmail,
      customerPhone,
      sendMethod: sendMethod || 'both',
      incentiveId: incentiveId && incentiveId.trim() !== '' ? incentiveId : null,
      trackingToken,
      shortCode,
      status: 'pending',
    });
    
    res.json(request);
  } catch (error: any) {
    console.error("[Reviews] Error creating request:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Send review request immediately
router.post("/requests/:id/send", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    const request = await storage.getReviewRequestById(id, userId);
    
    if (!request) {
      return res.status(404).json({ message: "Demande non trouvée" });
    }
    
    // Try tenant-aware lookup first
    let config;
    try {
      const ownerContext = await getDataOwnerContext(req);
      const owner = ownerContext.useBy === 'tenantId' 
        ? { tenantId: ownerContext.id, userId }
        : { userId: ownerContext.id };
      config = await storage.getReviewConfigByOwner(owner);
    } catch {
      config = await storage.getReviewConfig(userId);
    }
    
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
          const { sendReviewRequestSms } = await import('../services/twilio-sms.service');
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
router.get("/requests/stats", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const stats = await storage.getReviewRequestStats(userId);
    res.json(stats);
  } catch (error: any) {
    console.error("[Reviews] Error fetching request stats:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Get eligible contacts from marketing database for bulk review campaigns
router.get("/requests/eligible-contacts", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { segmentId, source, optInEmail, optInSms } = req.query;
    
    // Parse boolean filters
    const optInEmailBool = optInEmail === 'true' ? true : undefined;
    const optInSmsBool = optInSms === 'true' ? true : undefined;
    const sourceStr = source && source !== '' ? source as string : undefined;
    
    let contacts;
    
    // If segmentId is provided, get contacts from segment filters
    if (segmentId && typeof segmentId === 'string' && segmentId !== '') {
      const segment = await storage.getMarketingSegmentById(segmentId, userId);
      if (!segment) {
        return res.status(404).json({ message: "Segment non trouvé" });
      }
      contacts = await storage.getMarketingContactsBySegmentFilters(userId, segment.filters as any || {});
    } else {
      // Get all contacts then apply filters
      contacts = await storage.getMarketingContacts(userId, {
        source: sourceStr,
        optInEmail: optInEmailBool,
        optInSms: optInSmsBool,
      });
    }
    
    // Apply additional filters if segment was used
    if (segmentId && sourceStr) {
      contacts = contacts.filter(c => c.source === sourceStr);
    }
    if (segmentId && optInEmailBool) {
      contacts = contacts.filter(c => c.optInEmail === true);
    }
    if (segmentId && optInSmsBool) {
      contacts = contacts.filter(c => c.optInSms === true);
    }
    
    // Filter and format contacts for review campaigns (must have email or phone)
    const eligibleContacts = contacts
      .filter(c => c.email || c.phone)
      .map(c => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || c.phone || 'Contact sans nom',
        email: c.email,
        phone: c.phone,
        source: c.source,
        optInEmail: c.optInEmail,
        optInSms: c.optInSms,
        tags: c.tags || [],
      }));
    
    res.json({
      contacts: eligibleContacts,
      total: eligibleContacts.length,
    });
  } catch (error: any) {
    console.error("[Reviews] Error fetching eligible contacts:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Use a promo code (for N8N/external integrations)
router.post("/promo/use", async (req, res) => {
  try {
    const { promo_code, order_amount } = req.body;
    
    if (!promo_code || typeof promo_code !== 'string') {
      return res.status(400).json({ message: "Code promo requis" });
    }
    if (typeof order_amount !== 'number' || order_amount < 0) {
      return res.status(400).json({ message: "Montant de commande invalide" });
    }
    
    const result = await storage.usePromoCode(promo_code, order_amount);
    
    if (!result) {
      return res.status(404).json({ message: "Code promo invalide ou déjà utilisé" });
    }
    
    res.json({
      success: true,
      message: "Code promo utilisé avec succès",
      data: {
        promoCode: result.promoCode,
        orderAmount: order_amount,
        usedAt: result.promoCodeUsedAt,
      }
    });
  } catch (error: any) {
    console.error("[Reviews] Error using promo code:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Bulk send review requests (mass campaign)
router.post("/requests/bulk", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { contacts, sendMethod, incentiveId } = req.body;
    
    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ message: "Liste de contacts requise" });
    }
    
    if (!sendMethod || !['email', 'sms', 'both'].includes(sendMethod)) {
      return res.status(400).json({ message: "Méthode d'envoi invalide" });
    }
    
    // Limit to prevent abuse
    if (contacts.length > 500) {
      return res.status(400).json({ message: "Maximum 500 contacts par campagne" });
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    for (const contact of contacts) {
      try {
        const { name, email, phone } = contact;
        
        if (!name || (!email && !phone)) {
          errors.push(`Contact invalide: ${name || 'Sans nom'}`);
          errorCount++;
          continue;
        }
        
        // Check sendMethod requirements
        if (sendMethod === 'email' && !email) {
          errors.push(`Email manquant pour ${name}`);
          errorCount++;
          continue;
        }
        if (sendMethod === 'sms' && !phone) {
          errors.push(`Téléphone manquant pour ${name}`);
          errorCount++;
          continue;
        }
        if (sendMethod === 'both' && (!email && !phone)) {
          errors.push(`Email et téléphone manquants pour ${name}`);
          errorCount++;
          continue;
        }
        
        await storage.createReviewRequest({
          userId,
          customerName: name,
          customerEmail: email || null,
          customerPhone: phone || null,
          sendMethod,
          incentiveId: incentiveId || null,
          status: 'pending',
        });
        
        successCount++;
      } catch (err: any) {
        errors.push(`Erreur pour ${contact.name}: ${err.message}`);
        errorCount++;
      }
    }
    
    res.json({
      success: true,
      message: `${successCount} demandes créées, ${errorCount} erreurs`,
      created: successCount,
      errors: errorCount,
      errorDetails: errors.slice(0, 10), // Limit error details
    });
  } catch (error: any) {
    console.error("[Reviews] Error creating bulk requests:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Get all reviews with filters
router.get("/", requireAuth, async (req, res) => {
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

// Get review stats - MUST be before /:id to avoid "stats" being treated as an ID
router.get("/stats", requireAuth, async (req, res) => {
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

// Get single review
router.get("/:id", requireAuth, async (req, res) => {
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
router.post("/:id/read", requireAuth, async (req, res) => {
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
router.post("/:id/flag", requireAuth, async (req, res) => {
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
router.post("/:id/respond", requireAuth, async (req, res) => {
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
router.post("/:id/regenerate-ai", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    const review = await storage.getReviewById(id, userId);
    if (!review) {
      return res.status(404).json({ message: "Avis non trouvé" });
    }
    
    // Try tenant-aware lookup first
    let config;
    try {
      const ownerContext = await getDataOwnerContext(req);
      const owner = ownerContext.useBy === 'tenantId' 
        ? { tenantId: ownerContext.id, userId }
        : { userId: ownerContext.id };
      config = await storage.getReviewConfigByOwner(owner);
    } catch {
      config = await storage.getReviewConfig(userId);
    }
    if (!config) {
      return res.status(400).json({ message: "Configuration des avis non trouvée" });
    }
    
    const { regenerateResponse } = await import('../services/ai-review-response.service');
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
router.post("/:id/generate-ai", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    const review = await storage.getReviewById(id, userId);
    if (!review) {
      return res.status(404).json({ message: "Avis non trouvé" });
    }
    
    // Try tenant-aware lookup first
    let config;
    try {
      const ownerContext = await getDataOwnerContext(req);
      const owner = ownerContext.useBy === 'tenantId' 
        ? { tenantId: ownerContext.id, userId }
        : { userId: ownerContext.id };
      config = await storage.getReviewConfigByOwner(owner);
    } catch {
      config = await storage.getReviewConfig(userId);
    }
    if (!config) {
      return res.status(400).json({ message: "Configuration des avis non trouvée" });
    }
    
    const { generateReviewResponse } = await import('../services/ai-review-response.service');
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

// Get review alerts configuration
router.get("/alerts", requireAuth, async (req, res) => {
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
router.put("/alerts", requireAuth, async (req, res) => {
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

// ===== REVIEW SOURCES (Platform Connections) =====

// Get all connected review sources for user
router.get("/sources", requireAuth, async (req, res) => {
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
router.post("/sources/tripadvisor/connect", requireAuth, async (req, res) => {
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
    const { createTripAdvisorService } = await import('../services/tripadvisor');
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
        cuisine: locationDetails.cuisine?.map((c: any) => c.name),
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
router.delete("/sources/:sourceId", requireAuth, async (req, res) => {
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
router.post("/sources/:sourceId/sync", requireAuth, async (req, res) => {
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
    const { syncReviewSource } = await import('../services/review-sync');
    
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
router.get("/sources/:sourceId/logs", requireAuth, async (req, res) => {
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
router.get("/sync-logs", requireAuth, async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    const sources = await storage.getReviewSources(userId);
    const allLogs: any[] = [];
    
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
router.post("/sources/sync-all", requireAuth, async (req, res) => {
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

    const { syncReviewSource } = await import('../services/review-sync');

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

// ===== REVIEW AUTOMATIONS ROUTES =====

// Get all automations for user
router.get("/automations", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const automations = await storage.getReviewAutomations(userId);
    res.json(automations);
  } catch (error: any) {
    console.error("[ReviewAutomations] Error fetching automations:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Create automation
router.post("/automations", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const data = insertReviewAutomationSchema.parse({
      ...req.body,
      userId,
    });
    
    const automation = await storage.createReviewAutomation(data);
    res.json(automation);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Données invalides", errors: error.errors });
    }
    console.error("[ReviewAutomations] Error creating automation:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Update automation
router.put("/automations/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    const automation = await storage.updateReviewAutomation(id, userId, req.body);
    
    if (!automation) {
      return res.status(404).json({ message: "Automation non trouvée" });
    }
    
    res.json(automation);
  } catch (error: any) {
    console.error("[ReviewAutomations] Error updating automation:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Delete automation
router.delete("/automations/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    await storage.deleteReviewAutomation(id, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[ReviewAutomations] Error deleting automation:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Toggle automation active status
router.post("/automations/:id/toggle", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    const automation = await storage.toggleReviewAutomation(id, userId);
    
    if (!automation) {
      return res.status(404).json({ message: "Automation non trouvée" });
    }
    
    res.json(automation);
  } catch (error: any) {
    console.error("[ReviewAutomations] Error toggling automation:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ===== OAUTH ROUTES =====

// OAuth Status - Check which platforms are configured
router.get("/oauth/status", requireAuth, async (req, res) => {
  try {
    const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    const facebookConfigured = !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);

    res.json({
      google: {
        configured: googleConfigured,
        requiredSecrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
        setupUrl: 'https://console.cloud.google.com/apis/credentials'
      },
      facebook: {
        configured: facebookConfigured,
        requiredSecrets: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
        setupUrl: 'https://developers.facebook.com/apps/'
      }
    });
  } catch (error: any) {
    console.error("[OAuthStatus] Error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Get OAuth credentials status (not the secrets, just whether configured)
router.get("/oauth/credentials", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const googleConfig = await storage.getUserOAuthConfig(userId, "google");
    const facebookConfig = await storage.getUserOAuthConfig(userId, "facebook");
    res.json({
      google: { configured: !!googleConfig, clientId: googleConfig?.clientId || null },
      facebook: { configured: !!facebookConfig, clientId: facebookConfig?.clientId || null },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Save OAuth credentials
router.post("/oauth/credentials", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { provider, clientId, clientSecret, label } = req.body;
    if (!provider || !["google", "facebook"].includes(provider)) {
      return res.status(400).json({ message: "Provider invalide" });
    }
    if (!clientId || !clientSecret) {
      return res.status(400).json({ message: "Client ID et Client Secret requis" });
    }
    const { encryptCredential } = await import("../utils/credential-encryption");
    const encryptedSecret = encryptCredential(clientSecret);
    await storage.upsertUserOAuthConfig(userId, provider, clientId, encryptedSecret, label);
    res.json({ success: true, message: "Credentials sauvegardés" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Delete OAuth credentials
router.delete("/oauth/credentials/:provider", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { provider } = req.params;
    if (!["google", "facebook"].includes(provider)) {
      return res.status(400).json({ message: "Provider invalide" });
    }
    await storage.deleteUserOAuthConfig(userId, provider);
    res.json({ success: true, message: "Credentials supprimés" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Google OAuth - Initiate connection
router.get("/oauth/google/connect", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // First check user-specific credentials
    const userConfig = await storage.getUserOAuthConfig(userId, "google");
    let googleClientId: string | undefined;
    let googleClientSecret: string | undefined;

    if (userConfig) {
      const { decryptCredential } = await import("../utils/credential-encryption");
      googleClientId = userConfig.clientId;
      googleClientSecret = decryptCredential(userConfig.encryptedClientSecret);
    } else {
      // Fallback to environment variables
      googleClientId = process.env.GOOGLE_CLIENT_ID;
      googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    }

    // Check if OAuth is configured
    if (!googleClientId || !googleClientSecret) {
      return res.status(503).json({ 
        message: "OAuth Google non configuré. Veuillez configurer vos clés OAuth dans les paramètres.",
        setupRequired: true,
        requiredSecrets: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
      });
    }

    const { generateGoogleOAuthUrl } = await import('../services/google-business');
    
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
router.get("/oauth/google/callback", async (req, res) => {
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

    const { exchangeGoogleAuthCode, GoogleBusinessService } = await import('../services/google-business');
    
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
router.get("/oauth/facebook/connect", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // First check user-specific credentials
    const userConfig = await storage.getUserOAuthConfig(userId, "facebook");
    let facebookAppId: string | undefined;
    let facebookAppSecret: string | undefined;

    if (userConfig) {
      const { decryptCredential } = await import("../utils/credential-encryption");
      facebookAppId = userConfig.clientId;
      facebookAppSecret = decryptCredential(userConfig.encryptedClientSecret);
    } else {
      // Fallback to environment variables
      facebookAppId = process.env.FACEBOOK_APP_ID;
      facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
    }

    // Check if OAuth is configured
    if (!facebookAppId || !facebookAppSecret) {
      return res.status(503).json({ 
        message: "OAuth Facebook non configuré. Veuillez configurer vos clés OAuth dans les paramètres.",
        setupRequired: true,
        requiredSecrets: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']
      });
    }

    const { generateFacebookOAuthUrl } = await import('../services/facebook-pages');
    
    const frontendUrl = process.env.FRONTEND_URL || `https://${req.headers.host}`;
    const redirectUri = `${frontendUrl}/api/reviews/oauth/facebook/callback`;
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const authUrl = generateFacebookOAuthUrl(redirectUri, state, facebookAppId);
    
    res.json({ authUrl });
  } catch (error: any) {
    console.error("[FacebookOAuth] Connect error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// Facebook OAuth - Callback
router.get("/oauth/facebook/callback", async (req, res) => {
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

    // Get user-specific or fallback credentials
    const userConfig = await storage.getUserOAuthConfig(userId, "facebook");
    let facebookAppId: string | undefined;
    let facebookAppSecret: string | undefined;

    if (userConfig) {
      const { decryptCredential } = await import("../utils/credential-encryption");
      facebookAppId = userConfig.clientId;
      facebookAppSecret = decryptCredential(userConfig.encryptedClientSecret);
    } else {
      facebookAppId = process.env.FACEBOOK_APP_ID;
      facebookAppSecret = process.env.FACEBOOK_APP_SECRET;
    }

    // Guard: ensure credentials are available
    if (!facebookAppId || !facebookAppSecret) {
      console.error("[FacebookOAuth] No credentials available for token exchange");
      return res.redirect('/reviews/settings?error=oauth_not_configured');
    }

    const { exchangeFacebookAuthCode, getLongLivedToken, FacebookPagesService } = await import('../services/facebook-pages');
    
    const frontendUrl = process.env.FRONTEND_URL || `https://${req.headers.host}`;
    const redirectUri = `${frontendUrl}/api/reviews/oauth/facebook/callback`;

    const shortLivedToken = await exchangeFacebookAuthCode(code as string, redirectUri, facebookAppId, facebookAppSecret);
    
    if (!shortLivedToken) {
      return res.redirect('/reviews/settings?error=token_exchange_failed');
    }

    // Exchange for long-lived token
    const longLivedToken = await getLongLivedToken(shortLivedToken.accessToken, facebookAppId, facebookAppSecret);
    const finalToken = longLivedToken || shortLivedToken;

    // Get user's pages
    const service = new FacebookPagesService(finalToken.accessToken);
    const pages = await service.getUserPages();

    if (pages.length === 0) {
      return res.redirect('/reviews/settings?error=no_facebook_pages');
    }

    // For now, use first page
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

// ===== PUBLIC ENDPOINTS =====

// Helper: Validate UUID format
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Public endpoint to get reviews for embed widget (by user ID or domain)
router.get("/public/embed/:userId", async (req, res) => {
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
router.get("/public/collect/:userId", async (req, res) => {
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

// Track link click from review request
router.get("/public/track/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { platform } = req.query;
    
    const request = await storage.getReviewRequestByToken(token);
    
    if (!request) {
      return res.status(404).json({ message: "Lien invalide" });
    }
    
    // Track link click and platform selection
    if (!request.linkClickedAt) {
      // First visit - mark as clicked
      await storage.updateReviewRequest(request.id, {
        linkClickedAt: new Date(),
        platformClicked: platform as string || undefined,
        status: 'clicked',
      });
    } else if (platform && platform !== request.platformClicked) {
      // Subsequent visit with platform selection - update platformClicked
      await storage.updateReviewRequest(request.id, {
        platformClicked: platform as string,
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
        theFork: config?.theForkUrl,
      },
      priority: config?.platformsPriority || ['google', 'tripadvisor', 'facebook'],
      customerName: request.customerName,
      companyName: config?.companyName,
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

// Confirm review was left
router.post("/public/confirm/:token", async (req, res) => {
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
    let incentive = null;
    
    if (request.incentiveId) {
      incentive = await storage.getReviewIncentiveById(request.incentiveId, request.userId);
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
    
    // Envoyer le message de remerciement avec le code promo
    const config = await storage.getReviewConfig(request.userId);
    if (config) {
      const updatedRequest = { ...request, promoCode };
      sendThankYouMessage(updatedRequest, config, incentive).catch((err) => {
        console.error("[Reviews] Thank you message failed:", err);
      });
    }
    
    res.json({ 
      success: true, 
      promoCode,
    });
  } catch (error: any) {
    console.error("[Reviews] Error confirming review:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
