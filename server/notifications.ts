import type { IStorage } from "./storage";
import type { Call } from "@shared/schema";

/**
 * Helper functions to create notifications based on user preferences
 * These functions check user preferences before creating notifications
 */

/**
 * Notify user when a call fails
 */
export async function notifyFailedCall(
  storage: IStorage,
  userId: string,
  call: Call
): Promise<void> {
  const preferences = await storage.getNotificationPreferences(userId);
  
  // Only create notification if user has enabled failed_calls notifications
  if (!preferences?.failedCallsEnabled) {
    return;
  }

  await storage.createNotification({
    userId,
    type: "failed_calls",
    title: "Appel échoué",
    message: `L'appel de ${call.phoneNumber || 'numéro inconnu'} a échoué.`,
    isRead: false,
  });
}

/**
 * Notify user when a call becomes active
 */
export async function notifyActiveCall(
  storage: IStorage,
  userId: string,
  call: Call
): Promise<void> {
  const preferences = await storage.getNotificationPreferences(userId);
  
  // Only create notification if user has enabled active_call notifications
  if (!preferences?.activeCallEnabled) {
    return;
  }

  await storage.createNotification({
    userId,
    type: "active_call",
    title: "Nouvel appel actif",
    message: `Appel en cours avec ${call.phoneNumber || 'numéro inconnu'}.`,
    isRead: false,
  });
}

/**
 * Notify user about subscription alerts (expiring soon, renewed, expired)
 */
export async function notifySubscriptionAlert(
  storage: IStorage,
  userId: string,
  type: "subscription_expiring_soon" | "subscription_renewed" | "subscription_expired" | "subscription_created",
  message: string
): Promise<void> {
  const preferences = await storage.getNotificationPreferences(userId);
  
  // Only create notification if user has enabled subscription_alerts
  if (!preferences?.subscriptionAlertsEnabled) {
    return;
  }

  const titles = {
    subscription_expiring_soon: "Abonnement expire bientôt",
    subscription_renewed: "Abonnement renouvelé",
    subscription_expired: "Abonnement expiré",
    subscription_created: "Abonnement créé",
  };

  await storage.createNotification({
    userId,
    type,
    title: titles[type],
    message,
    isRead: false,
  });
}

/**
 * Notify user when password is changed
 * This is a security notification that is ALWAYS sent regardless of preferences
 */
export async function notifyPasswordChanged(
  storage: IStorage,
  userId: string
): Promise<void> {
  // Always create password change notifications for security
  // This is sent regardless of user preferences
  await storage.createNotification({
    userId,
    type: "password_changed",
    title: "Mot de passe modifié",
    message: "Votre mot de passe a été modifié avec succès. Si ce n'était pas vous, contactez-nous immédiatement.",
    isRead: false,
  });
}

/**
 * Notify user when payment method is updated
 */
export async function notifyPaymentUpdated(
  storage: IStorage,
  userId: string
): Promise<void> {
  const preferences = await storage.getNotificationPreferences(userId);
  
  // Only create notification if user has enabled subscription_alerts
  if (!preferences?.subscriptionAlertsEnabled) {
    return;
  }

  await storage.createNotification({
    userId,
    type: "payment_updated",
    title: "Méthode de paiement mise à jour",
    message: "Votre méthode de paiement a été mise à jour avec succès.",
    isRead: false,
  });
}

/**
 * Create a daily summary notification
 * This should be called by a scheduled job (cron) once per day
 */
export async function notifyDailySummary(
  storage: IStorage,
  userId: string,
  summary: {
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    averageDuration: number;
  }
): Promise<void> {
  const preferences = await storage.getNotificationPreferences(userId);
  
  // Only create notification if user has enabled daily_summary
  if (!preferences?.dailySummaryEnabled) {
    return;
  }

  const message = `Aujourd'hui : ${summary.totalCalls} appels (${summary.completedCalls} avec rendez-vous, ${summary.failedCalls} échoués). Durée moyenne : ${Math.round(summary.averageDuration)}s.`;

  await storage.createNotification({
    userId,
    type: "daily_summary",
    title: "Résumé quotidien",
    message,
    isRead: false,
  });
}

// ===== REVIEWS & REPUTATION NOTIFICATIONS =====

/**
 * Notify user when a new review is received
 */
export async function notifyReviewReceived(
  storage: IStorage,
  userId: string,
  review: { platform: string; rating: number; reviewerName?: string }
): Promise<void> {
  const stars = "⭐".repeat(review.rating);
  await storage.createNotification({
    userId,
    type: "review_received",
    title: "Nouvel avis reçu",
    message: `${review.reviewerName || "Un client"} a laissé un avis ${stars} sur ${review.platform}.`,
    isRead: false,
  });
}

/**
 * Notify user when a negative review is received (priority alert)
 */
export async function notifyNegativeReview(
  storage: IStorage,
  userId: string,
  review: { platform: string; rating: number; reviewerName?: string; content?: string }
): Promise<void> {
  await storage.createNotification({
    userId,
    type: "review_negative",
    title: "Avis négatif - Action requise",
    message: `Avis ${review.rating}/5 de ${review.reviewerName || "un client"} sur ${review.platform}. Répondez rapidement pour gérer votre réputation.`,
    isRead: false,
  });
}

// ===== MARKETING NOTIFICATIONS =====

/**
 * Notify user when a marketing campaign has been sent
 */
export async function notifyCampaignSent(
  storage: IStorage,
  userId: string,
  campaign: { name: string; recipientCount: number; channel: string }
): Promise<void> {
  await storage.createNotification({
    userId,
    type: "campaign_sent",
    title: "Campagne envoyée",
    message: `La campagne "${campaign.name}" a été envoyée à ${campaign.recipientCount} contacts via ${campaign.channel}.`,
    isRead: false,
  });
}

/**
 * Notify user when a marketing automation is triggered
 */
export async function notifyAutomationTriggered(
  storage: IStorage,
  userId: string,
  automation: { name: string; triggerType: string; contactEmail?: string }
): Promise<void> {
  await storage.createNotification({
    userId,
    type: "automation_triggered",
    title: "Automatisation déclenchée",
    message: `L'automatisation "${automation.name}" s'est déclenchée${automation.contactEmail ? ` pour ${automation.contactEmail}` : ""}.`,
    isRead: false,
  });
}

// ===== CB GUARANTEE NOTIFICATIONS =====

/**
 * Notify user when a no-show has been charged
 */
export async function notifyNoShowCharged(
  storage: IStorage,
  userId: string,
  charge: { customerName: string; amount: number; reservationDate: string }
): Promise<void> {
  await storage.createNotification({
    userId,
    type: "guarantee_noshow_charged",
    title: "No-show facturé",
    message: `Pénalité de ${charge.amount}€ appliquée pour le no-show de ${charge.customerName} (réservation du ${charge.reservationDate}).`,
    isRead: false,
  });
}

/**
 * Notify user when a customer validates their card
 */
export async function notifyCardValidated(
  storage: IStorage,
  userId: string,
  validation: { customerName: string; reservationDate: string }
): Promise<void> {
  await storage.createNotification({
    userId,
    type: "guarantee_card_validated",
    title: "Carte de garantie validée",
    message: `${validation.customerName} a validé sa carte pour la réservation du ${validation.reservationDate}.`,
    isRead: false,
  });
}

// ===== INTEGRATION NOTIFICATIONS =====

/**
 * Notify user when an integration sync completes successfully
 */
export async function notifyIntegrationSyncComplete(
  storage: IStorage,
  userId: string,
  sync: { providerName: string; recordsImported: number }
): Promise<void> {
  await storage.createNotification({
    userId,
    type: "integration_sync_complete",
    title: "Synchronisation terminée",
    message: `${sync.recordsImported} enregistrements importés depuis ${sync.providerName}.`,
    isRead: false,
  });
}

/**
 * Notify user when an integration encounters an error
 */
export async function notifyIntegrationError(
  storage: IStorage,
  userId: string,
  error: { providerName: string; errorMessage: string }
): Promise<void> {
  await storage.createNotification({
    userId,
    type: "integration_error",
    title: "Erreur d'intégration",
    message: `La synchronisation avec ${error.providerName} a échoué : ${error.errorMessage}`,
    isRead: false,
  });
}
