// AI-related Reviews Routes
import { Router } from "express";
import { requireAuth, storage } from "./middleware";

const router = Router();

// Generate AI insights for reviews analytics
router.post("/review-insights", requireAuth, async (req, res) => {
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
Analyse ces statistiques d'avis clients et génère une analyse structurée en 3 parties.

Statistiques:
- Note globale: ${stats.globalScore}/5
- Total d'avis: ${stats.totalReviews}
- Nouveaux avis sur la période (${period || 'mois'}): ${stats.newReviewsPeriod}
- Taux de réponse: ${stats.responseRate}%
- Temps de réponse moyen: ${stats.avgResponseTimeHours ? stats.avgResponseTimeHours + 'h' : 'Non disponible'}
- Distribution des notes: ${JSON.stringify(stats.ratingDistribution)}
- Distribution des sentiments: ${JSON.stringify(stats.sentimentDistribution)}
- Plateformes: ${JSON.stringify(stats.platforms)}

Génère une analyse en français structurée ainsi:
1. RISQUES ACTUELS (1-2 points d'attention)
2. OPPORTUNITÉS (1-2 points forts à valoriser)
3. ACTIONS RECOMMANDÉES CETTE SEMAINE (2-3 actions concrètes, une par plateforme si possible)

Format: Utilise des bullet points, reste concis (max 300 mots), sois concret et actionnable.`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 800,
      });

      const rawInsights = completion.choices[0]?.message?.content || "Analyse non disponible";
      
      // Parser la réponse pour extraire les 3 sections
      const parseInsights = (text: string) => {
        const risksMatch = text.match(/RISQUES[^\n]*\n([\s\S]*?)(?=OPPORTUNITÉS|ACTIONS|$)/i);
        const opportunitiesMatch = text.match(/OPPORTUNITÉS[^\n]*\n([\s\S]*?)(?=ACTIONS|RISQUES|$)/i);
        const actionsMatch = text.match(/ACTIONS[^\n]*\n([\s\S]*?)$/i);
        
        return {
          risks: risksMatch ? risksMatch[1].trim() : null,
          opportunities: opportunitiesMatch ? opportunitiesMatch[1].trim() : null,
          actions: actionsMatch ? actionsMatch[1].trim() : null,
          raw: text,
        };
      };

      const structuredInsights = parseInsights(rawInsights);

      res.json({ insights: structuredInsights });
    } catch (aiError: any) {
      console.error("[AI Reviews] OpenAI error:", aiError);
      res.json({ 
        insights: {
          risks: null,
          opportunities: null,
          actions: null,
          raw: null,
          error: "Service IA temporairement indisponible"
        }
      });
    }
  } catch (error: any) {
    console.error("[AI Reviews] Error generating insights:", error);
    res.status(500).json({ message: "Erreur lors de la génération IA" });
  }
});

// Generate AI message for review request campaigns
router.post("/generate-review-message", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sendMethod, incentiveId } = req.body;

    // Get user's company info from review config
    const config = await storage.getReviewConfig(userId);
    const companyName = config?.companyName || "notre établissement";

    // Get incentive details if provided
    let incentiveText = "";
    if (incentiveId) {
      const incentive = await storage.getReviewIncentiveById(incentiveId, userId);
      if (incentive) {
        switch (incentive.type) {
          case "percentage":
            incentiveText = `${incentive.percentageValue}% de réduction`;
            break;
          case "fixed_amount":
            incentiveText = `${incentive.fixedAmountValue}€ offerts`;
            break;
          case "free_item":
            incentiveText = incentive.freeItemName || "un cadeau offert";
            break;
          case "lottery":
            incentiveText = incentive.lotteryPrize || "participation à un tirage au sort";
            break;
          case "loyalty_points":
            incentiveText = `${incentive.loyaltyPointsValue} points fidélité`;
            break;
          default:
            incentiveText = incentive.customDescription || "une offre spéciale";
        }
      }
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    });

    const result: { smsMessage?: string; emailSubject?: string; emailBody?: string } = {};

    // Generate SMS if needed
    if (sendMethod === "sms" || sendMethod === "both") {
      const smsPrompt = `Tu es un expert en marketing. Génère un SMS de demande d'avis client pour "${companyName}".
${incentiveText ? `Le client recevra en retour: ${incentiveText}.` : ""}
Le SMS doit:
- Faire exactement 160 caractères maximum
- Être chaleureux et personnalisé (utilise {prenom} comme variable)
- Inciter à laisser un avis
- Mentionner la récompense si elle existe

Réponds UNIQUEMENT avec le texte du SMS, sans guillemets ni explication.`;

      const smsCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: smsPrompt }],
        temperature: 0.7,
        max_tokens: 100,
      });
      result.smsMessage = smsCompletion.choices[0]?.message?.content?.trim() || "";
    }

    // Generate Email if needed
    if (sendMethod === "email" || sendMethod === "both") {
      const emailPrompt = `Tu es un expert en marketing. Génère un email de demande d'avis client pour "${companyName}".
${incentiveText ? `Le client recevra en retour: ${incentiveText}.` : ""}

L'email doit:
- Avoir un objet accrocheur (max 50 caractères)
- Être chaleureux et professionnel
- Utiliser {prenom} comme variable pour le prénom
- Inciter à laisser un avis en expliquant pourquoi c'est important
- Mentionner la récompense si elle existe
- Faire environ 100 mots

Réponds en JSON avec ce format exact:
{"subject": "Objet de l'email", "body": "Corps de l'email"}`;

      const emailCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: emailPrompt }],
        temperature: 0.7,
        max_tokens: 300,
      });

      const emailContent = emailCompletion.choices[0]?.message?.content?.trim() || "{}";
      try {
        const parsed = JSON.parse(emailContent);
        result.emailSubject = parsed.subject || "";
        result.emailBody = parsed.body || "";
      } catch {
        // If JSON parsing fails, use the content as body
        result.emailSubject = "Votre avis compte pour nous !";
        result.emailBody = emailContent;
      }
    }

    res.json(result);
  } catch (error: any) {
    console.error("[AI] Error generating review message:", error);
    res.status(500).json({ message: "Erreur lors de la génération du message" });
  }
});

export default router;
