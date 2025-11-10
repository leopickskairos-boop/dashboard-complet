/**
 * Stripe Plans Configuration
 * 
 * Définit les 3 plans d'abonnement disponibles avec leurs Price IDs respectifs.
 * 
 * Price IDs officiels (confirmés 10/11/2025) :
 * - Basic (400€)    → price_1SRfP3442ACh1eI8PFt5z2b4
 * - Standard (800€) → price_1SQDvA442ACh1eI8X8ym3WC5
 * - Premium (1000€) → price_1SRfPE442ACh1eI8pzFhIJLH
 */

/**
 * Mapping centralisé des Price IDs Stripe
 */
export const PLANS = {
  basic: "price_1SRfP3442ACh1eI8PFt5z2b4",
  standard: "price_1SQDvA442ACh1eI8X8ym3WC5",
  premium: "price_1SRfPE442ACh1eI8pzFhIJLH",
} as const;

export const STRIPE_PLANS = {
  basic: {
    id: 'basic',
    name: 'Plan Basic',
    price: 400,
    currency: 'EUR',
    priceId: PLANS.basic,
    features: [
      'Appels illimités 24/7',
      'Dashboard avec statistiques',
      'Résumés IA des appels',
      'Support standard',
      'Intégrations basiques',
    ]
  },
  standard: {
    id: 'standard',
    name: 'Plan Standard',
    price: 800,
    currency: 'EUR',
    priceId: PLANS.standard,
    features: [
      'Appels illimités 24/7',
      'Dashboard complet avec analytics',
      'Résumés IA de tous les appels',
      'Support technique prioritaire',
      'Intégrations téléphoniques',
      'Données sécurisées RGPD'
    ]
  },
  premium: {
    id: 'premium',
    name: 'Plan Premium',
    price: 1000,
    currency: 'EUR',
    priceId: PLANS.premium,
    features: [
      'Appels illimités 24/7',
      'Dashboard complet avec analytics avancées',
      'Résumés IA détaillés',
      'Support technique 24/7',
      'Intégrations avancées',
      'Données sécurisées RGPD',
      'API personnalisée',
      'Rapports mensuels détaillés'
    ]
  }
} as const;

export type PlanId = keyof typeof STRIPE_PLANS;

/**
 * Récupère le Price ID Stripe pour un plan donné
 */
export function getPriceIdForPlan(planId: PlanId | string | null): string {
  if (!planId || !(planId in STRIPE_PLANS)) {
    throw new Error(`Invalid plan ID: ${planId}`);
  }
  return STRIPE_PLANS[planId as PlanId].priceId;
}

/**
 * Récupère les informations complètes d'un plan
 */
export function getPlanInfo(planId: PlanId | string | null) {
  if (!planId || !(planId in STRIPE_PLANS)) {
    return null;
  }
  return STRIPE_PLANS[planId as PlanId];
}

/**
 * Vérifie si un plan ID est valide
 */
export function isValidPlan(planId: string): planId is PlanId {
  return planId in STRIPE_PLANS;
}
