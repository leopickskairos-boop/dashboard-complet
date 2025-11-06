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
