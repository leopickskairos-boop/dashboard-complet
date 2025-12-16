/**
 * AI Report Service
 * Generates professional consultant-style monthly reports using OpenAI
 * Stores narrative in filesystem (not DB) for scalability
 */

import OpenAI from "openai";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { MbrV1 } from "@shared/mbr-types";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const NARRATIVES_DIR = path.resolve("./reports/narratives");

export interface AiReportNarrative {
  executiveSummary: string;
  operationalPerformance: {
    calls: string;
    conversion: string;
    reservations: string;
  };
  financialAnalysis: {
    valueGenerated: string;
    profitability: string;
    noShowAnalysis: string;
  };
  crmReputation: {
    clientBase: string;
    retention: string;
    onlineReputation: string;
  };
  crossInsights: string[];
  alerts: string[];
  actionPlan: Array<{
    title: string;
    problem: string;
    impact: string;
    effort: "faible" | "moyen" | "élevé";
  }>;
  projections: string;
  conclusion: string;
}

export interface AiReportResult {
  narrative: AiReportNarrative;
  checksum: string;
  generatedAt: string;
  tokenUsage: number;
  cached: boolean;
}

function generateCacheKey(tenantId: string, periodStart: string, periodEnd: string, mbrHash: string): string {
  return crypto.createHash("sha256")
    .update(`${tenantId}:${periodStart}:${periodEnd}:${mbrHash}`)
    .digest("hex")
    .slice(0, 16);
}

function computeMbrHash(mbr: MbrV1): string {
  const key = JSON.stringify({
    kpis: mbr.kpis,
    score: mbr.performance_score.global,
    calls: { total: mbr.calls.total, afterHours: mbr.calls.after_hours, insightsCount: mbr.calls.insights.length },
    reservations: { total: mbr.reservations.total, noShow: mbr.reservations.no_show },
    finance: { roi: mbr.finance.roi_x, netBenefit: mbr.finance.net_benefit_eur },
    reputation: { rating: mbr.reputation.reviews.avg_rating, newCount: mbr.reputation.reviews.new_count },
  });
  return crypto.createHash("md5").update(key).digest("hex").slice(0, 12);
}

async function ensureNarrativesDir(): Promise<void> {
  await fs.mkdir(NARRATIVES_DIR, { recursive: true });
}

async function getCachedNarrative(cacheKey: string): Promise<AiReportResult | null> {
  try {
    const filePath = path.join(NARRATIVES_DIR, `${cacheKey}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    const cached = JSON.parse(content);
    console.log(`[AiReport] Cache hit for ${cacheKey}`);
    return { ...cached, cached: true };
  } catch {
    return null;
  }
}

async function cacheNarrative(cacheKey: string, result: Omit<AiReportResult, "cached">): Promise<void> {
  await ensureNarrativesDir();
  const filePath = path.join(NARRATIVES_DIR, `${cacheKey}.json`);
  await fs.writeFile(filePath, JSON.stringify(result, null, 2));
  console.log(`[AiReport] Cached narrative at ${filePath}`);
}

function buildDataContext(mbr: MbrV1): string {
  const { tenant, kpis, performance_score, calls, reservations, finance, reputation, forecast } = mbr;
  
  return `
DONNÉES DU MOIS - ${tenant.name} - ${tenant.period.month_label}
Période: ${tenant.period.start} au ${tenant.period.end}

=== KPIs PRINCIPAUX ===
- Appels totaux: ${kpis.calls_total}
- Réservations: ${kpis.reservations_total}
- Valeur estimée: ${kpis.estimated_value_eur ? `${kpis.estimated_value_eur}€` : "Non disponible"}
- Note moyenne avis: ${kpis.reviews_avg_rating ?? "Non disponible"}
- Taux no-show: ${kpis.no_show_rate ? `${kpis.no_show_rate}%` : "Non disponible"}
- ROI: ${kpis.roi_x ? `${kpis.roi_x}x` : "Non disponible"}

=== SCORE DE PERFORMANCE ===
- Score global: ${performance_score.global ?? "Non évalué"}/100
- Label: ${performance_score.label ?? "Non évalué"}
${performance_score.notes.length > 0 ? `- Notes: ${performance_score.notes.join("; ")}` : ""}

=== APPELS ===
- Total: ${calls.total}
- Hors horaires: ${calls.after_hours}
${calls.insights.length > 0 ? `- Insights: ${calls.insights.join("; ")}` : ""}

=== RÉSERVATIONS ===
- Total: ${reservations.total}
- Confirmées: ${reservations.confirmed}
- No-shows: ${reservations.no_show.count ?? "Inconnu"}
- No-shows évités: ${reservations.no_show.avoided_count ?? "Inconnu"}
${reservations.no_show.risk_factors.length > 0 ? `- Facteurs de risque: ${reservations.no_show.risk_factors.join("; ")}` : ""}

=== FINANCE ===
- Valeur totale générée: ${finance.total_value_eur ? `${finance.total_value_eur}€` : "Non calculée"}
- Bénéfice net: ${finance.net_benefit_eur ? `${finance.net_benefit_eur}€` : "Non calculé"}
- ROI: ${finance.roi_x ? `${finance.roi_x}x` : "Non calculé"}
- Coût SpeedAI: ${finance.inputs.speedai_monthly_cost_eur ? `${finance.inputs.speedai_monthly_cost_eur}€/mois` : "Non renseigné"}
${finance.notes.length > 0 ? `- Notes: ${finance.notes.join("; ")}` : ""}

=== RÉPUTATION ===
- Nouveaux avis: ${reputation.reviews.new_count ?? "Inconnu"}
- Note moyenne: ${reputation.reviews.avg_rating ?? "Inconnue"}
${reputation.reviews.strengths.length > 0 ? `- Points forts: ${reputation.reviews.strengths.join("; ")}` : ""}
${reputation.reviews.improvements.length > 0 ? `- Améliorations: ${reputation.reviews.improvements.join("; ")}` : ""}

=== PRÉVISIONS MOIS SUIVANT ===
${forecast.enabled ? `
- CA estimé: ${forecast.next_month.ca_est_eur ? `${forecast.next_month.ca_est_eur}€` : "Non estimé"}
- Semaine forte: ${forecast.next_month.strong_week ?? "Non identifiée"}
- Semaine faible: ${forecast.next_month.weak_week ?? "Non identifiée"}
${forecast.next_month.risks.length > 0 ? `- Risques: ${forecast.next_month.risks.join("; ")}` : ""}
${forecast.next_month.opportunities.length > 0 ? `- Opportunités: ${forecast.next_month.opportunities.join("; ")}` : ""}
` : "- Prévisions désactivées"}
`.trim();
}

const SYSTEM_PROMPT = `Tu agis comme un consultant senior en stratégie, performance opérationnelle et pilotage financier,
habitué à produire des rapports mensuels complets pour des dirigeants de restaurants.

Ce rapport est un LIVRABLE PAYANT - un document de pilotage business professionnel.

RÈGLES D'ÉCRITURE:
- Ton professionnel, posé, crédible
- Style cabinet de conseil (McKinsey / Bain)
- ZÉRO emojis, ZÉRO jargon marketing, ZÉRO phrases creuses
- Chaque affirmation reliée à une donnée
- TU N'INVENTES JAMAIS DE CHIFFRES
- Si donnée absente: mentionne-le explicitement

FORMAT DE SORTIE: JSON structuré avec les sections suivantes.`;

export async function generateAiReport(mbr: MbrV1): Promise<AiReportResult> {
  const cacheKey = generateCacheKey(
    mbr.tenant.tenant_id,
    mbr.tenant.period.start,
    mbr.tenant.period.end,
    computeMbrHash(mbr)
  );

  const cached = await getCachedNarrative(cacheKey);
  if (cached) {
    return cached;
  }

  console.log(`[AiReport] Generating narrative for ${mbr.tenant.name} - ${mbr.tenant.period.month_label}...`);

  const dataContext = buildDataContext(mbr);

  const userPrompt = `${dataContext}

Génère un rapport mensuel professionnel au format JSON avec la structure suivante:
{
  "executiveSummary": "Synthèse exécutive de 12-18 lignes avec appréciation globale, chiffres clés, rentabilité et priorités",
  "operationalPerformance": {
    "calls": "Analyse des appels entrants (volume, répartition, pics/creux, durée)",
    "conversion": "Analyse taux de conversion appels → réservations",
    "reservations": "Analyse des réservations (taille groupes, délais, comportements)"
  },
  "financialAnalysis": {
    "valueGenerated": "Détail revenus directs, économies, valeur indirecte",
    "profitability": "Coût, bénéfice net, ROI, lecture rentabilité",
    "noShowAnalysis": "Taux, évolution, profils à risque, impact financier"
  },
  "crmReputation": {
    "clientBase": "Segmentation si disponible (VIP, fidèles, dormants)",
    "retention": "Analyse fidélisation et rétention",
    "onlineReputation": "Note Google, avis, analyse sémantique, impact acquisition"
  },
  "crossInsights": ["3 à 6 insights transverses croisant plusieurs dimensions"],
  "alerts": ["Points de vigilance avec signaux faibles exploitables"],
  "actionPlan": [
    {
      "title": "Action 1",
      "problem": "Problème adressé",
      "impact": "Impact attendu",
      "effort": "faible|moyen|élevé"
    }
  ],
  "projections": "Prévisions mois suivant avec saisonnalité, risques et opportunités",
  "conclusion": "3 points à retenir et mot du conseiller signé 'Votre conseiller SpeedAI'"
}

Important: Adapte le contenu aux données réellement disponibles. Ne pas inventer.`;

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 4000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const narrative: AiReportNarrative = JSON.parse(content);
      const tokenUsage = completion.usage?.total_tokens ?? 0;
      
      const result = {
        narrative,
        checksum: crypto.createHash("sha256").update(content).digest("hex").slice(0, 16),
        generatedAt: new Date().toISOString(),
        tokenUsage,
      };

      await cacheNarrative(cacheKey, result);
      
      console.log(`[AiReport] Generated narrative (${tokenUsage} tokens)`);

      return { ...result, cached: false };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[AiReport] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("[AiReport] All retries exhausted:", lastError);
  throw lastError;
}

export async function getNarrativePath(tenantId: string, periodStart: string, periodEnd: string): Promise<string | null> {
  try {
    const files = await fs.readdir(NARRATIVES_DIR);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = await fs.readFile(path.join(NARRATIVES_DIR, file), "utf-8");
        const data = JSON.parse(content);
        if (data.narrative) {
          return path.join(NARRATIVES_DIR, file);
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function cleanupOldNarratives(maxAgeDays: number = 90): Promise<number> {
  try {
    await ensureNarrativesDir();
    const files = await fs.readdir(NARRATIVES_DIR);
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(NARRATIVES_DIR, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath);
        deleted++;
      }
    }

    console.log(`[AiReport] Cleaned up ${deleted} old narratives`);
    return deleted;
  } catch {
    return 0;
  }
}
