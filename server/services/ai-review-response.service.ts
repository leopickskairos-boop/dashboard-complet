import OpenAI from "openai";
import type { Review, ReviewConfig } from "@shared/schema";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface GenerateResponseOptions {
  review: Review;
  config: ReviewConfig;
}

interface GeneratedResponse {
  response: string;
  summary: string;
}

const toneDescriptions: Record<string, string> = {
  professional: "professionnel et courtois, avec un ton business approprié",
  friendly: "amical et chaleureux, créant une connexion personnelle",
  formal: "formel et respectueux, avec un langage soutenu",
  casual: "décontracté et accessible, tout en restant respectueux",
};

const languageNames: Record<string, string> = {
  fr: "français",
  en: "anglais",
  es: "espagnol",
  de: "allemand",
  it: "italien",
};

export async function generateReviewResponse(
  options: GenerateResponseOptions
): Promise<GeneratedResponse> {
  const { review, config } = options;

  const tone = toneDescriptions[config.aiResponseTone] || toneDescriptions.professional;
  const language = languageNames[config.aiResponseLanguage] || "français";
  const companyName = config.aiIncludeCompanyName && config.companyName 
    ? config.companyName 
    : "notre établissement";
  const maxLength = config.aiMaxLength || 300;

  const sentiment = review.sentiment || "neutral";
  const rating = review.rating || 3;
  const reviewerName = review.reviewerName || "Client";

  const systemPrompt = `Tu es un assistant expert en gestion de la réputation en ligne pour "${companyName}".
Tu génères des réponses personnalisées aux avis clients.

Règles importantes:
- Réponds en ${language}
- Adopte un ton ${tone}
- La réponse doit faire maximum ${maxLength} caractères
- Personnalise avec le nom du client si disponible
- Pour les avis positifs (4-5 étoiles): remercie chaleureusement et encourage à revenir
- Pour les avis neutres (3 étoiles): remercie et propose d'améliorer l'expérience
- Pour les avis négatifs (1-2 étoiles): présente des excuses sincères, montre de l'empathie et propose une solution
- Ne jamais être défensif ou argumentatif
- Ne jamais inventer de détails non mentionnés dans l'avis`;

  const userPrompt = `Génère une réponse pour cet avis:

Plateforme: ${review.platform}
Note: ${rating}/5
Sentiment détecté: ${sentiment}
Nom du client: ${reviewerName}
Contenu de l'avis: "${review.reviewText || "Pas de commentaire"}"

Réponds au format JSON avec deux champs:
- "response": la réponse à publier (max ${maxLength} caractères)
- "summary": un résumé de 1-2 phrases de l'avis pour le dashboard`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    
    return {
      response: parsed.response || "",
      summary: parsed.summary || "",
    };
  } catch (error) {
    console.error("[AIReviewResponse] Error generating response:", error);
    throw error;
  }
}

export async function regenerateResponse(
  review: Review,
  config: ReviewConfig,
  previousResponse?: string
): Promise<GeneratedResponse> {
  const tone = toneDescriptions[config.aiResponseTone] || toneDescriptions.professional;
  const language = languageNames[config.aiResponseLanguage] || "français";
  const companyName = config.aiIncludeCompanyName && config.companyName 
    ? config.companyName 
    : "notre établissement";
  const maxLength = config.aiMaxLength || 300;

  const rating = review.rating || 3;
  const reviewerName = review.reviewerName || "Client";

  const systemPrompt = `Tu es un assistant expert en gestion de la réputation en ligne pour "${companyName}".
Tu génères des réponses alternatives aux avis clients.

Règles importantes:
- Réponds en ${language}
- Adopte un ton ${tone}
- La réponse doit faire maximum ${maxLength} caractères
- Génère une réponse DIFFÉRENTE de la précédente
- Personnalise avec le nom du client si disponible`;

  const userPrompt = `Génère une NOUVELLE réponse différente pour cet avis:

Note: ${rating}/5
Nom du client: ${reviewerName}
Contenu de l'avis: "${review.reviewText || "Pas de commentaire"}"
${previousResponse ? `\nRéponse précédente (à éviter de reproduire): "${previousResponse}"` : ""}

Réponds uniquement avec la nouvelle réponse, sans formatage JSON.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 400,
    });

    const response = completion.choices[0]?.message?.content?.trim() || "";
    
    return {
      response,
      summary: review.aiSummary || "",
    };
  } catch (error) {
    console.error("[AIReviewResponse] Error regenerating response:", error);
    throw error;
  }
}

export async function generateBatchResponses(
  reviews: Review[],
  config: ReviewConfig
): Promise<Map<string, GeneratedResponse>> {
  const results = new Map<string, GeneratedResponse>();
  
  for (const review of reviews) {
    try {
      if (!review.aiSuggestedResponse) {
        const generated = await generateReviewResponse({ review, config });
        results.set(review.id, generated);
      }
    } catch (error) {
      console.error(`[AIReviewResponse] Failed to generate for review ${review.id}:`, error);
    }
  }
  
  return results;
}
