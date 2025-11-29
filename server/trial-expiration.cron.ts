import * as cron from 'node-cron';
import { storage } from './storage';
import { sendEmail } from './gmail-email';
import { STRIPE_PLANS } from './stripe-plans';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Trial Expiration Cron Job Service
 * Runs daily at 3:00 AM to check for trial expirations and generate payment links
 */
export class TrialExpirationCronService {
  private cronTask: cron.ScheduledTask | null = null;

  constructor() {}

  /**
   * Start the cron job (runs daily at 3:00 AM)
   */
  start(): void {
    if (this.cronTask) {
      console.log('[TrialExpirationCron] Cron job already running');
      return;
    }

    // Schedule: Every day at 3:00 AM
    this.cronTask = cron.schedule('0 3 * * *', async () => {
      console.log('[TrialExpirationCron] Starting trial expiration check...');
      await this.processTrialExpirations();
    });

    console.log('[TrialExpirationCron] Cron job started - will run daily at 3:00 AM');
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
      console.log('[TrialExpirationCron] Cron job stopped');
    }
  }

  /**
   * Manually trigger expiration check (for testing)
   */
  async runNow(): Promise<void> {
    console.log('[TrialExpirationCron] Manual trigger - checking trial expirations now...');
    await this.processTrialExpirations();
  }

  /**
   * Main workflow: Process all users with expiring trials
   */
  private async processTrialExpirations(): Promise<void> {
    try {
      // Get users whose trial ends today or has already ended
      const expiringUsers = await storage.getUsersWithExpiringTrials();
      
      console.log(`[TrialExpirationCron] Found ${expiringUsers.length} users with expiring trials`);

      if (expiringUsers.length === 0) {
        return;
      }

      // Process each user
      for (const user of expiringUsers) {
        await this.processUserTrialExpiration(user);
      }

      console.log('[TrialExpirationCron] Completed all trial expiration processing');
    } catch (error) {
      console.error('[TrialExpirationCron] Error in processTrialExpirations:', error);
    }
  }

  /**
   * Process a single user's trial expiration
   */
  private async processUserTrialExpiration(user: any): Promise<void> {
    console.log(`[TrialExpirationCron] Processing trial expiration for user ${user.id} (${user.email})`);

    try {
      // Only process if user has a plan assigned
      if (!user.plan) {
        console.log(`[TrialExpirationCron] User ${user.id} has no plan assigned - skipping`);
        
        // Update account status to expired
        await storage.updateUser(user.id, { accountStatus: 'expired' });
        
        // Create notification
        await storage.createNotification({
          userId: user.id,
          type: 'subscription_expired',
          title: 'Période d\'essai expirée',
          message: 'Votre période d\'essai est terminée. Contactez le support pour continuer.',
          metadata: JSON.stringify({ reason: 'no_plan_assigned' }),
          isRead: false,
        });
        
        return;
      }

      // Get Stripe price ID for the plan
      const planConfig = STRIPE_PLANS[user.plan as keyof typeof STRIPE_PLANS];
      if (!planConfig) {
        console.error(`[TrialExpirationCron] Invalid plan "${user.plan}" for user ${user.id}`);
        return;
      }
      const stripePriceId = planConfig.priceId;

      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: user.stripeCustomerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        success_url: `${this.getFrontendUrl()}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.getFrontendUrl()}/trial-expired`,
        metadata: {
          userId: user.id,
          plan: user.plan,
        },
      });

      console.log(`[TrialExpirationCron] Created Stripe Checkout Session for user ${user.id}: ${session.id}`);

      // Send email with payment link
      if (!session.url) {
        console.error(`[TrialExpirationCron] No checkout URL generated for user ${user.id}`);
        return;
      }
      await this.sendPaymentLinkEmail(user, session.url, user.plan);

      // Update user account status to 'expired'
      await storage.updateUser(user.id, { accountStatus: 'expired' });

      // Create notification
      await storage.createNotification({
        userId: user.id,
        type: 'subscription_expiring_soon',
        title: 'Période d\'essai expirée',
        message: `Votre période d\'essai est terminée. Consultez vos emails pour activer votre abonnement ${this.getPlanDisplayName(user.plan)}.`,
        metadata: JSON.stringify({
          plan: user.plan,
          checkoutSessionId: session.id,
        }),
        isRead: false,
      });

      console.log(`[TrialExpirationCron] Successfully processed trial expiration for user ${user.id}`);

    } catch (error) {
      console.error(`[TrialExpirationCron] Error processing user ${user.id}:`, error);
    }
  }

  /**
   * Send payment link email to user
   */
  private async sendPaymentLinkEmail(user: any, paymentUrl: string, plan: string): Promise<void> {
    const planName = this.getPlanDisplayName(plan);
    const planPrice = this.getPlanPrice(plan);

    const subject = `Activez votre abonnement ${planName} - SpeedAI`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">⏰ Votre période d'essai est terminée</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Bonjour,</p>
          
          <p>Votre période d'essai gratuite de 30 jours est arrivée à son terme.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #667eea;">Plan assigné : ${planName}</h3>
            <p style="font-size: 24px; font-weight: bold; color: #333; margin: 10px 0;">${planPrice}€/mois</p>
          </div>
          
          <p>Pour continuer à utiliser SpeedAI et accéder à votre dashboard, veuillez activer votre abonnement en cliquant sur le bouton ci-dessous :</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${paymentUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
              Activer mon abonnement
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Ce lien est sécurisé et vous redirige vers notre processus de paiement Stripe.
            Si vous rencontrez des difficultés, contactez-nous à speedaivoiceai@gmail.com
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            SpeedAI - Réceptionniste IA Vocale<br>
            © 2024 Tous droits réservés
          </p>
        </div>
      </body>
      </html>
    `;

    const text = `
Votre période d'essai est terminée

Bonjour,

Votre période d'essai gratuite de 30 jours est arrivée à son terme.

Plan assigné : ${planName}
Prix : ${planPrice}€/mois

Pour continuer à utiliser SpeedAI et accéder à votre dashboard, veuillez activer votre abonnement :

${paymentUrl}

Ce lien est sécurisé et vous redirige vers notre processus de paiement Stripe.

Si vous rencontrez des difficultés, contactez-nous à speedaivoiceai@gmail.com

SpeedAI - Réceptionniste IA Vocale
© 2024 Tous droits réservés
    `.trim();

    await sendEmail({
      to: user.email,
      subject,
      text,
      html,
    });

    console.log(`[TrialExpirationCron] Payment link email sent to ${user.email}`);
  }

  /**
   * Get frontend URL from environment
   * Priority: FRONTEND_URL > REPLIT_DOMAINS (production) > REPLIT_DEV_DOMAIN (dev) > localhost
   */
  private getFrontendUrl(): string {
    if (process.env.FRONTEND_URL) {
      return process.env.FRONTEND_URL;
    }
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',');
      const productionDomain = domains.find(d => d.includes('.replit.app')) || domains[0];
      return `https://${productionDomain}`;
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    return 'http://localhost:5000';
  }

  /**
   * Get display name for plan
   */
  private getPlanDisplayName(plan: string): string {
    const names: Record<string, string> = {
      basic: 'Basic',
      standard: 'Standard',
      premium: 'Premium',
    };
    return names[plan] || plan;
  }

  /**
   * Get price for plan
   */
  private getPlanPrice(plan: string): number {
    const prices: Record<string, number> = {
      basic: 400,
      standard: 800,
      premium: 1000,
    };
    return prices[plan] || 0;
  }
}

// Export singleton instance
export const trialExpirationCron = new TrialExpirationCronService();
