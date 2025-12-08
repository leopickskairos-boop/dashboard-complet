import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { requireAuth, requireVerified, requireSubscription } from "./auth";
import { z } from "zod";
import OpenAI from "openai";
import {
  insertMarketingContactSchema,
  insertMarketingSegmentSchema,
  insertMarketingTemplateSchema,
  insertMarketingCampaignSchema,
  insertMarketingAutomationSchema,
  segmentFiltersSchema,
  importContactsSchema,
  createQuickCampaignSchema,
} from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

export function registerMarketingRoutes(app: Express) {
  // ===== MARKETING CONTACTS =====

  // Get all contacts with filters
  app.get("/api/marketing/contacts", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { search, source, hasEmail, hasPhone, optInEmail, optInSms, limit, offset } = req.query;
      
      const contacts = await storage.getMarketingContacts(userId, {
        search: search as string | undefined,
        source: source as string | undefined,
        hasEmail: hasEmail === 'true' ? true : hasEmail === 'false' ? false : undefined,
        hasPhone: hasPhone === 'true' ? true : hasPhone === 'false' ? false : undefined,
        optInEmail: optInEmail === 'true' ? true : optInEmail === 'false' ? false : undefined,
        optInSms: optInSms === 'true' ? true : optInSms === 'false' ? false : undefined,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      
      const total = await storage.getMarketingContactsCount(userId);
      
      res.json({ contacts, total, limit: limit || 50, offset: offset || 0 });
    } catch (error: any) {
      console.error("[Marketing] Get contacts error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des contacts" });
    }
  });

  // Get single contact
  app.get("/api/marketing/contacts/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de contact invalide" });
      }
      
      const contact = await storage.getMarketingContactById(id, userId);
      if (!contact) {
        return res.status(404).json({ error: "Contact non trouvé" });
      }
      
      const consentHistory = await storage.getConsentHistory(id);
      
      res.json({ contact, consentHistory });
    } catch (error: any) {
      console.error("[Marketing] Get contact error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération du contact" });
    }
  });

  // Create contact
  app.post("/api/marketing/contacts", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const data = insertMarketingContactSchema.parse({ ...req.body, userId });
      
      // Check for duplicates
      if (data.email) {
        const existing = await storage.getMarketingContactByEmail(userId, data.email);
        if (existing) {
          return res.status(409).json({ error: "Un contact avec cet email existe déjà" });
        }
      }
      if (data.phone) {
        const existing = await storage.getMarketingContactByPhone(userId, data.phone);
        if (existing) {
          return res.status(409).json({ error: "Un contact avec ce numéro existe déjà" });
        }
      }
      
      const contact = await storage.createMarketingContact(data);
      
      // Create consent history
      if (data.optInEmail) {
        await storage.createConsentHistory(
          contact.id,
          'opt_in',
          'email',
          'admin',
          req.ip,
          req.headers['user-agent']
        );
      }
      if (data.optInSms) {
        await storage.createConsentHistory(
          contact.id,
          'opt_in',
          'sms',
          'admin',
          req.ip,
          req.headers['user-agent']
        );
      }
      
      res.status(201).json(contact);
    } catch (error: any) {
      console.error("[Marketing] Create contact error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la création du contact" });
    }
  });

  // Update contact
  app.patch("/api/marketing/contacts/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de contact invalide" });
      }
      
      const existingContact = await storage.getMarketingContactById(id, userId);
      if (!existingContact) {
        return res.status(404).json({ error: "Contact non trouvé" });
      }
      
      const updates = req.body;
      
      // Track consent changes
      if (updates.optInEmail !== undefined && updates.optInEmail !== existingContact.optInEmail) {
        await storage.createConsentHistory(
          id,
          updates.optInEmail ? 'opt_in' : 'opt_out',
          'email',
          'admin',
          req.ip,
          req.headers['user-agent']
        );
      }
      if (updates.optInSms !== undefined && updates.optInSms !== existingContact.optInSms) {
        await storage.createConsentHistory(
          id,
          updates.optInSms ? 'opt_in' : 'opt_out',
          'sms',
          'admin',
          req.ip,
          req.headers['user-agent']
        );
      }
      
      const contact = await storage.updateMarketingContact(id, userId, updates);
      res.json(contact);
    } catch (error: any) {
      console.error("[Marketing] Update contact error:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du contact" });
    }
  });

  // Delete contact
  app.delete("/api/marketing/contacts/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de contact invalide" });
      }
      
      await storage.deleteMarketingContact(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Marketing] Delete contact error:", error);
      res.status(500).json({ error: "Erreur lors de la suppression du contact" });
    }
  });

  // Import contacts (CSV/JSON)
  app.post("/api/marketing/contacts/import", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const data = importContactsSchema.parse(req.body);
      
      const contactsToImport = data.contacts.map(c => ({
        ...c,
        userId,
        source: data.source,
        optInEmail: data.optInEmail,
        optInSms: data.optInSms,
        consentEmailAt: data.optInEmail ? new Date() : undefined,
        consentSmsAt: data.optInSms ? new Date() : undefined,
      }));
      
      const result = await storage.bulkCreateMarketingContacts(contactsToImport as any);
      
      res.json({
        success: true,
        imported: result.created,
        updated: result.updated,
        errors: result.errors,
        total: data.contacts.length,
      });
    } catch (error: any) {
      console.error("[Marketing] Import contacts error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Format d'import invalide", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de l'import des contacts" });
    }
  });

  // ===== MARKETING SEGMENTS =====

  // Get all segments
  app.get("/api/marketing/segments", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const segments = await storage.getMarketingSegments(userId);
      res.json(segments);
    } catch (error: any) {
      console.error("[Marketing] Get segments error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des segments" });
    }
  });

  // Get single segment with preview
  app.get("/api/marketing/segments/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de segment invalide" });
      }
      
      const segment = await storage.getMarketingSegmentById(id, userId);
      if (!segment) {
        return res.status(404).json({ error: "Segment non trouvé" });
      }
      
      // Get contacts matching segment
      let contacts: any[] = [];
      if (segment.filters) {
        contacts = await storage.getMarketingContactsBySegmentFilters(userId, segment.filters as any);
      }
      
      res.json({ segment, contactCount: contacts.length, previewContacts: contacts.slice(0, 10) });
    } catch (error: any) {
      console.error("[Marketing] Get segment error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération du segment" });
    }
  });

  // Create segment
  app.post("/api/marketing/segments", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const data = insertMarketingSegmentSchema.parse({ ...req.body, userId });
      
      const segment = await storage.createMarketingSegment(data);
      
      // Calculate initial count
      if (data.filters) {
        const contacts = await storage.getMarketingContactsBySegmentFilters(userId, data.filters as any);
        await storage.updateSegmentContactCount(segment.id, contacts.length);
      }
      
      res.status(201).json(segment);
    } catch (error: any) {
      console.error("[Marketing] Create segment error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la création du segment" });
    }
  });

  // Update segment
  app.patch("/api/marketing/segments/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de segment invalide" });
      }
      
      const segment = await storage.updateMarketingSegment(id, userId, req.body);
      if (!segment) {
        return res.status(404).json({ error: "Segment non trouvé" });
      }
      
      // Recalculate count if filters changed
      if (req.body.filters) {
        const contacts = await storage.getMarketingContactsBySegmentFilters(userId, req.body.filters);
        await storage.updateSegmentContactCount(id, contacts.length);
      }
      
      res.json(segment);
    } catch (error: any) {
      console.error("[Marketing] Update segment error:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du segment" });
    }
  });

  // Delete segment
  app.delete("/api/marketing/segments/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de segment invalide" });
      }
      
      await storage.deleteMarketingSegment(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Marketing] Delete segment error:", error);
      res.status(500).json({ error: "Erreur lors de la suppression du segment" });
    }
  });

  // Preview segment filters (without saving)
  app.post("/api/marketing/segments/preview", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const filters = segmentFiltersSchema.parse(req.body);
      
      const contacts = await storage.getMarketingContactsBySegmentFilters(userId, filters);
      
      res.json({
        count: contacts.length,
        preview: contacts.slice(0, 10),
      });
    } catch (error: any) {
      console.error("[Marketing] Preview segment error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Filtres invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la prévisualisation" });
    }
  });

  // ===== MARKETING TEMPLATES =====

  // Get all templates (user + system)
  app.get("/api/marketing/templates", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { category, channel, businessType, includeSystem } = req.query;
      
      const templates = await storage.getMarketingTemplates(userId, {
        category: category as string | undefined,
        channel: channel as string | undefined,
        businessType: businessType as string | undefined,
        includeSystem: includeSystem !== 'false',
      });
      
      res.json(templates);
    } catch (error: any) {
      console.error("[Marketing] Get templates error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des templates" });
    }
  });

  // Get system templates only
  app.get("/api/marketing/templates/system", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const { category, channel, businessType } = req.query;
      
      const templates = await storage.getSystemTemplates({
        category: category as string | undefined,
        channel: channel as string | undefined,
        businessType: businessType as string | undefined,
      });
      
      res.json(templates);
    } catch (error: any) {
      console.error("[Marketing] Get system templates error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des templates système" });
    }
  });

  // Get single template
  app.get("/api/marketing/templates/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de template invalide" });
      }
      
      const template = await storage.getMarketingTemplateById(id, userId);
      if (!template) {
        return res.status(404).json({ error: "Template non trouvé" });
      }
      
      res.json(template);
    } catch (error: any) {
      console.error("[Marketing] Get template error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération du template" });
    }
  });

  // Create template
  app.post("/api/marketing/templates", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const data = insertMarketingTemplateSchema.parse({ ...req.body, userId, isSystem: false });
      
      const template = await storage.createMarketingTemplate(data);
      res.status(201).json(template);
    } catch (error: any) {
      console.error("[Marketing] Create template error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la création du template" });
    }
  });

  // Update template
  app.patch("/api/marketing/templates/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de template invalide" });
      }
      
      const template = await storage.updateMarketingTemplate(id, userId, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template non trouvé" });
      }
      
      res.json(template);
    } catch (error: any) {
      console.error("[Marketing] Update template error:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour du template" });
    }
  });

  // Delete template
  app.delete("/api/marketing/templates/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de template invalide" });
      }
      
      await storage.deleteMarketingTemplate(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Marketing] Delete template error:", error);
      res.status(500).json({ error: "Erreur lors de la suppression du template" });
    }
  });

  // Generate template with AI
  app.post("/api/marketing/templates/generate-ai", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const { description, channel, businessType, tone, language } = req.body;
      
      if (!description || description.length < 10) {
        return res.status(400).json({ error: "Veuillez fournir une description détaillée (au moins 10 caractères)" });
      }

      const channelType = channel || 'email';
      const businessCategory = businessType || 'général';
      const toneStyle = tone || 'professionnel';
      const lang = language || 'fr';

      const systemPrompt = `Tu es un expert en email marketing et en design HTML. Tu génères des templates d'emails professionnels, responsives et esthétiques.

RÈGLES IMPORTANTES:
1. Le HTML doit être compatible avec tous les clients email (Outlook, Gmail, Apple Mail, etc.)
2. Utilise des tables pour le layout (pas de flexbox/grid qui ne sont pas supportés)
3. Tous les styles doivent être inline (pas de balise <style>)
4. Utilise une largeur maximale de 600px centrée
5. Le design doit être professionnel avec les couleurs de marque SpeedAI: 
   - Or/Doré: #C8B88A (pour les accents, boutons, titres)
   - Vert menthe: #4CEFAD (pour les indicateurs positifs)
   - Fond sombre: #1a1a2e ou #0f0f1a
   - Texte clair: #ffffff et #a0a0a0
6. Inclus des variables dynamiques avec la syntaxe {variable}: {prenom}, {nom}, {email}, {entreprise}, {date}, etc.
7. Le contenu doit être en ${lang === 'fr' ? 'français' : 'anglais'}
8. Le ton doit être ${toneStyle}
9. Inclus un header avec logo placeholder, un corps de message et un footer avec liens de désinscription

Réponds UNIQUEMENT en JSON avec ce format exact:
{
  "name": "Nom du template",
  "subject": "Objet de l'email avec {prenom}",
  "htmlContent": "Le code HTML complet du template",
  "textContent": "Version texte brut du message",
  "category": "welcome|promotional|newsletter|transactional|reminder|followup",
  "variables": ["prenom", "nom", "autres variables utilisées"]
}`;

      const userPrompt = `Génère un template ${channelType === 'sms' ? 'SMS' : 'email HTML'} pour: ${description}

Type d'entreprise: ${businessCategory}
Canal: ${channelType}
Ton: ${toneStyle}

${channelType === 'sms' ? 'Pour un SMS, limite le contenu à 160 caractères maximum et ne génère pas de HTML.' : 'Génère un email HTML complet avec un design professionnel et moderne.'}`;

      console.log("[Marketing AI] Generating template for:", description);

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Pas de réponse de l'IA");
      }

      const generatedTemplate = JSON.parse(content);

      console.log("[Marketing AI] Template generated successfully:", generatedTemplate.name);

      res.json({
        success: true,
        template: {
          name: generatedTemplate.name,
          subject: generatedTemplate.subject,
          htmlContent: generatedTemplate.htmlContent,
          textContent: generatedTemplate.textContent,
          category: generatedTemplate.category || 'promotional',
          channel: channelType,
          variables: generatedTemplate.variables || [],
        }
      });
    } catch (error: any) {
      console.error("[Marketing AI] Generate template error:", error);
      res.status(500).json({ 
        error: "Erreur lors de la génération du template",
        details: error.message 
      });
    }
  });

  // ===== MARKETING CAMPAIGNS =====

  // Get all campaigns
  app.get("/api/marketing/campaigns", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { status, type, channel, limit, offset } = req.query;
      
      const campaigns = await storage.getMarketingCampaigns(userId, {
        status: status as string | undefined,
        type: type as string | undefined,
        channel: channel as string | undefined,
        limit: limit ? parseInt(limit as string) : 20,
        offset: offset ? parseInt(offset as string) : 0,
      });
      
      res.json(campaigns);
    } catch (error: any) {
      console.error("[Marketing] Get campaigns error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des campagnes" });
    }
  });

  // Get single campaign with stats
  app.get("/api/marketing/campaigns/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de campagne invalide" });
      }
      
      const campaign = await storage.getMarketingCampaignById(id, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campagne non trouvée" });
      }
      
      const sendStats = await storage.getCampaignSendStats(id);
      
      res.json({ campaign, sendStats });
    } catch (error: any) {
      console.error("[Marketing] Get campaign error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de la campagne" });
    }
  });

  // Create campaign
  app.post("/api/marketing/campaigns", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const data = insertMarketingCampaignSchema.parse({ ...req.body, userId });
      
      const campaign = await storage.createMarketingCampaign(data);
      
      // Increment template usage if using a template
      if (data.templateId) {
        await storage.incrementTemplateUsage(data.templateId);
      }
      
      res.status(201).json(campaign);
    } catch (error: any) {
      console.error("[Marketing] Create campaign error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la création de la campagne" });
    }
  });

  // Quick campaign creation (simple mode)
  app.post("/api/marketing/campaigns/quick", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const data = createQuickCampaignSchema.parse(req.body);
      
      // Get template
      const template = await storage.getMarketingTemplateById(data.templateId, userId);
      if (!template) {
        return res.status(404).json({ error: "Template non trouvé" });
      }
      
      // Get or create segment based on type
      let segmentId: string | undefined;
      let targetAll = false;
      
      if (data.segmentType === 'all') {
        targetAll = true;
      } else if (data.segmentType === 'custom' && data.customSegmentId) {
        segmentId = data.customSegmentId;
      } else {
        // Create temporary segment based on type
        const segmentFilters: any = {};
        switch (data.segmentType) {
          case 'recent':
            segmentFilters.createdAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'inactive':
            segmentFilters.inactiveDays = 60;
            break;
          case 'vip':
            segmentFilters.visitsMin = 5;
            break;
        }
        
        const segment = await storage.createMarketingSegment({
          userId,
          name: `Auto - ${data.segmentType} - ${new Date().toISOString()}`,
          filters: segmentFilters,
          isSystem: false,
          autoUpdate: false,
        });
        segmentId = segment.id;
      }
      
      // Apply customizations to template content
      let emailContent = template.emailContent || '';
      let smsContent = template.smsContent || '';
      
      if (data.customizations?.discountPercent) {
        emailContent = emailContent.replace(/{reduction}/g, `${data.customizations.discountPercent}%`);
        smsContent = smsContent.replace(/{reduction}/g, `${data.customizations.discountPercent}%`);
      }
      if (data.customizations?.discountAmount) {
        emailContent = emailContent.replace(/{montant}/g, `${data.customizations.discountAmount}€`);
        smsContent = smsContent.replace(/{montant}/g, `${data.customizations.discountAmount}€`);
      }
      if (data.customizations?.validUntil) {
        emailContent = emailContent.replace(/{date_fin}/g, data.customizations.validUntil);
        smsContent = smsContent.replace(/{date_fin}/g, data.customizations.validUntil);
      }
      
      // Create campaign
      const campaign = await storage.createMarketingCampaign({
        userId,
        name: `Campagne rapide - ${template.name}`,
        type: template.category,
        status: data.scheduledAt ? 'scheduled' : 'draft',
        channel: data.channel,
        emailSubject: template.emailSubject,
        emailContent,
        emailPreviewText: template.emailPreviewText,
        smsContent,
        templateId: data.templateId,
        segmentId,
        targetAll,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      });
      
      await storage.incrementTemplateUsage(data.templateId);
      
      res.status(201).json(campaign);
    } catch (error: any) {
      console.error("[Marketing] Quick campaign error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la création de la campagne rapide" });
    }
  });

  // Update campaign
  app.patch("/api/marketing/campaigns/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de campagne invalide" });
      }
      
      const campaign = await storage.updateMarketingCampaign(id, userId, req.body);
      if (!campaign) {
        return res.status(404).json({ error: "Campagne non trouvée" });
      }
      
      res.json(campaign);
    } catch (error: any) {
      console.error("[Marketing] Update campaign error:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour de la campagne" });
    }
  });

  // Delete campaign
  app.delete("/api/marketing/campaigns/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de campagne invalide" });
      }
      
      await storage.deleteMarketingCampaign(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Marketing] Delete campaign error:", error);
      res.status(500).json({ error: "Erreur lors de la suppression de la campagne" });
    }
  });

  // ===== MARKETING AUTOMATIONS =====

  // Get all automations
  app.get("/api/marketing/automations", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const automations = await storage.getMarketingAutomations(userId);
      res.json(automations);
    } catch (error: any) {
      console.error("[Marketing] Get automations error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des automations" });
    }
  });

  // Get single automation
  app.get("/api/marketing/automations/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID d'automation invalide" });
      }
      
      const automation = await storage.getMarketingAutomationById(id, userId);
      if (!automation) {
        return res.status(404).json({ error: "Automation non trouvée" });
      }
      
      res.json(automation);
    } catch (error: any) {
      console.error("[Marketing] Get automation error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération de l'automation" });
    }
  });

  // Create automation
  app.post("/api/marketing/automations", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const data = insertMarketingAutomationSchema.parse({ ...req.body, userId });
      
      const automation = await storage.createMarketingAutomation(data);
      res.status(201).json(automation);
    } catch (error: any) {
      console.error("[Marketing] Create automation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Données invalides", details: error.errors });
      }
      res.status(500).json({ error: "Erreur lors de la création de l'automation" });
    }
  });

  // Update automation
  app.patch("/api/marketing/automations/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID d'automation invalide" });
      }
      
      const automation = await storage.updateMarketingAutomation(id, userId, req.body);
      if (!automation) {
        return res.status(404).json({ error: "Automation non trouvée" });
      }
      
      res.json(automation);
    } catch (error: any) {
      console.error("[Marketing] Update automation error:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour de l'automation" });
    }
  });

  // Toggle automation active state
  app.post("/api/marketing/automations/:id/toggle", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID d'automation invalide" });
      }
      
      const existing = await storage.getMarketingAutomationById(id, userId);
      if (!existing) {
        return res.status(404).json({ error: "Automation non trouvée" });
      }
      
      const automation = await storage.updateMarketingAutomation(id, userId, { isActive: !existing.isActive });
      res.json(automation);
    } catch (error: any) {
      console.error("[Marketing] Toggle automation error:", error);
      res.status(500).json({ error: "Erreur lors de l'activation/désactivation de l'automation" });
    }
  });

  // Delete automation
  app.delete("/api/marketing/automations/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID d'automation invalide" });
      }
      
      await storage.deleteMarketingAutomation(id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[Marketing] Delete automation error:", error);
      res.status(500).json({ error: "Erreur lors de la suppression de l'automation" });
    }
  });

  // ===== MARKETING ANALYTICS =====

  // Get overview stats
  app.get("/api/marketing/analytics/overview", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { period } = req.query;
      
      const stats = await storage.getMarketingOverviewStats(
        userId, 
        (period as 'week' | 'month' | 'year') || 'month'
      );
      
      res.json(stats);
    } catch (error: any) {
      console.error("[Marketing] Get overview stats error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des statistiques" });
    }
  });

  // Get campaign performance chart
  app.get("/api/marketing/analytics/performance", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { period } = req.query;
      
      const chartData = await storage.getCampaignPerformanceChart(
        userId,
        (period as 'week' | 'month' | 'year') || 'month'
      );
      
      res.json(chartData);
    } catch (error: any) {
      console.error("[Marketing] Get performance chart error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des données" });
    }
  });

  // Get campaign detail analytics
  app.get("/api/marketing/analytics/campaigns/:id", requireAuth, requireVerified, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: "ID de campagne invalide" });
      }
      
      const campaign = await storage.getMarketingCampaignById(id, userId);
      if (!campaign) {
        return res.status(404).json({ error: "Campagne non trouvée" });
      }
      
      const sends = await storage.getMarketingSendsByCampaign(id);
      const sendStats = await storage.getCampaignSendStats(id);
      
      // Calculate rates
      const openRate = sendStats.sent > 0 ? (sendStats.opened / sendStats.sent) * 100 : 0;
      const clickRate = sendStats.opened > 0 ? (sendStats.clicked / sendStats.opened) * 100 : 0;
      const bounceRate = sendStats.sent > 0 ? (sendStats.bounced / sendStats.sent) * 100 : 0;
      const unsubRate = sendStats.sent > 0 ? (sendStats.unsubscribed / sendStats.sent) * 100 : 0;
      
      res.json({
        campaign,
        stats: {
          ...sendStats,
          openRate: Math.round(openRate * 100) / 100,
          clickRate: Math.round(clickRate * 100) / 100,
          bounceRate: Math.round(bounceRate * 100) / 100,
          unsubRate: Math.round(unsubRate * 100) / 100,
        },
        recentSends: sends.slice(0, 50),
      });
    } catch (error: any) {
      console.error("[Marketing] Get campaign analytics error:", error);
      res.status(500).json({ error: "Erreur lors de la récupération des analytics" });
    }
  });

  // ===== PUBLIC TRACKING ENDPOINTS =====

  // Email open tracking pixel (1x1 transparent GIF)
  app.get("/api/marketing/track/open/:trackingId", async (req: Request, res: Response) => {
    try {
      const { trackingId } = req.params;
      
      if (!isValidUUID(trackingId)) {
        // Return transparent pixel anyway to not break email display
        return sendTrackingPixel(res);
      }
      
      const send = await storage.getMarketingSendByTrackingId(trackingId);
      if (send && !send.openedAt) {
        await storage.updateMarketingSend(send.id, {
          status: 'opened',
          openedAt: new Date(),
        });
        
        // Update contact stats
        await storage.incrementContactEmailStats(send.contactId, 'opened');
        
        // Update campaign stats
        const campaign = await storage.getMarketingCampaignById(send.campaignId, '');
        if (campaign) {
          await storage.updateCampaignStats(send.campaignId, {
            totalOpened: (campaign.totalOpened || 0) + 1,
          });
        }
      }
      
      sendTrackingPixel(res);
    } catch (error: any) {
      console.error("[Marketing] Track open error:", error);
      sendTrackingPixel(res);
    }
  });

  // Click tracking redirect
  app.get("/api/marketing/track/click/:trackingId", async (req: Request, res: Response) => {
    try {
      const { trackingId } = req.params;
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).send("URL manquante");
      }
      
      if (!isValidUUID(trackingId)) {
        return res.redirect(url);
      }
      
      const send = await storage.getMarketingSendByTrackingId(trackingId);
      if (send) {
        const isFirstClick = !send.clickedAt;
        
        await storage.updateMarketingSend(send.id, {
          status: 'clicked',
          clickedAt: isFirstClick ? new Date() : send.clickedAt,
          clickCount: (send.clickCount || 0) + 1,
          lastClickedUrl: url,
        });
        
        // Create click event for detailed tracking
        await storage.createClickEvent(
          send.id,
          url,
          req.ip,
          req.headers['user-agent'],
          detectDevice(req.headers['user-agent']),
          detectBrowser(req.headers['user-agent']),
          detectOS(req.headers['user-agent'])
        );
        
        if (isFirstClick) {
          // Update contact stats
          await storage.incrementContactEmailStats(send.contactId, 'clicked');
          
          // Update campaign stats
          const campaign = await storage.getMarketingCampaignById(send.campaignId, '');
          if (campaign) {
            await storage.updateCampaignStats(send.campaignId, {
              totalClicked: (campaign.totalClicked || 0) + 1,
            });
          }
        }
      }
      
      res.redirect(url);
    } catch (error: any) {
      console.error("[Marketing] Track click error:", error);
      const { url } = req.query;
      if (url && typeof url === 'string') {
        res.redirect(url);
      } else {
        res.status(500).send("Erreur");
      }
    }
  });

  // Unsubscribe endpoint
  app.get("/api/marketing/unsubscribe/:trackingId", async (req: Request, res: Response) => {
    try {
      const { trackingId } = req.params;
      const { channel } = req.query;
      
      if (!isValidUUID(trackingId)) {
        return res.status(400).json({ error: "Lien invalide" });
      }
      
      const send = await storage.getMarketingSendByTrackingId(trackingId);
      if (!send) {
        return res.status(404).json({ error: "Lien de désinscription invalide ou expiré" });
      }
      
      // Get contact info for the page
      const contact = await storage.getMarketingContactById(send.contactId, '');
      
      res.json({
        email: contact?.email ? maskEmail(contact.email) : null,
        phone: contact?.phone ? maskPhone(contact.phone) : null,
        optInEmail: contact?.optInEmail,
        optInSms: contact?.optInSms,
        channel: channel || 'both',
      });
    } catch (error: any) {
      console.error("[Marketing] Unsubscribe GET error:", error);
      res.status(500).json({ error: "Erreur" });
    }
  });

  // Process unsubscribe
  app.post("/api/marketing/unsubscribe/:trackingId", async (req: Request, res: Response) => {
    try {
      const { trackingId } = req.params;
      const { channel } = req.body; // 'email', 'sms', or 'both'
      
      if (!isValidUUID(trackingId)) {
        return res.status(400).json({ error: "Lien invalide" });
      }
      
      const send = await storage.getMarketingSendByTrackingId(trackingId);
      if (!send) {
        return res.status(404).json({ error: "Lien invalide" });
      }
      
      // Get contact to find userId
      const contact = await storage.getMarketingContactById(send.contactId, '');
      if (!contact) {
        return res.status(404).json({ error: "Contact non trouvé" });
      }
      
      // Update consent
      const updates: any = {
        consentWithdrawnAt: new Date(),
      };
      
      if (channel === 'email' || channel === 'both') {
        updates.optInEmail = false;
      }
      if (channel === 'sms' || channel === 'both') {
        updates.optInSms = false;
      }
      
      await storage.updateMarketingContact(send.contactId, contact.userId, updates);
      
      // Log consent change
      await storage.createConsentHistory(
        send.contactId,
        'opt_out',
        channel || 'both',
        'unsubscribe_link',
        req.ip,
        req.headers['user-agent']
      );
      
      // Update send status
      await storage.updateMarketingSend(send.id, {
        status: 'unsubscribed',
        unsubscribedAt: new Date(),
      });
      
      // Update campaign stats
      const campaign = await storage.getMarketingCampaignById(send.campaignId, '');
      if (campaign) {
        await storage.updateCampaignStats(send.campaignId, {
          totalUnsubscribed: (campaign.totalUnsubscribed || 0) + 1,
        });
      }
      
      res.json({ success: true, message: "Vous avez été désinscrit avec succès" });
    } catch (error: any) {
      console.error("[Marketing] Unsubscribe POST error:", error);
      res.status(500).json({ error: "Erreur lors de la désinscription" });
    }
  });
}

// Helper functions for tracking

function sendTrackingPixel(res: Response) {
  // 1x1 transparent GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length.toString(),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.end(pixel);
}

function detectDevice(userAgent?: string): string {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'mobile';
  if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet';
  return 'desktop';
}

function detectBrowser(userAgent?: string): string {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('edge')) return 'Edge';
  if (ua.includes('opera')) return 'Opera';
  return 'unknown';
}

function detectOS(userAgent?: string): string {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  return 'unknown';
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '***' + phone.slice(-2);
  return phone.slice(0, 4) + '***' + phone.slice(-2);
}
