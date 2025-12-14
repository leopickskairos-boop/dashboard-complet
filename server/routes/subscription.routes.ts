// Subscription Routes Module
import { Router, Request, Response } from "express";
import Stripe from "stripe";
import {
  storage,
  stripe,
  STRIPE_PRICE_ID,
  STRIPE_WEBHOOK_SECRET,
  requireAuth,
  requireVerified,
  notifySubscriptionAlert,
} from "./middleware";
import { sendConfirmationEmail, isEmailConfigured } from "../services/guarantee-email.service";
import { sendGuaranteeConfirmationSms, isSmsConfigured } from "../services/twilio-sms.service";

const router = Router();

// Create subscription
router.post(
  "/create",
  requireAuth,
  requireVerified,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      // If user already has a subscription, retrieve it
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(
          user.stripeSubscriptionId,
        );

        if (
          subscription.latest_invoice &&
          typeof subscription.latest_invoice !== "string"
        ) {
          const paymentIntent = (subscription.latest_invoice as any)
            .payment_intent;
          if (paymentIntent && typeof paymentIntent !== "string") {
            return res.json({
              subscriptionId: subscription.id,
              clientSecret: paymentIntent.client_secret,
            });
          }
        }
      }

      // Create Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await storage.updateStripeInfo(user.id, {
          stripeCustomerId: customerId,
        });
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: STRIPE_PRICE_ID }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });

      // Update user with subscription ID
      await storage.updateStripeInfo(user.id, {
        stripeSubscriptionId: subscription.id,
      });

      const invoice = subscription.latest_invoice;
      if (invoice && typeof invoice !== "string") {
        const paymentIntent = (invoice as any).payment_intent;
        if (paymentIntent && typeof paymentIntent !== "string") {
          return res.json({
            subscriptionId: subscription.id,
            clientSecret: paymentIntent.client_secret,
          });
        }
      }

      res
        .status(500)
        .json({ message: "Erreur lors de la création de l'abonnement" });
    } catch (error: any) {
      console.error("Create subscription error:", error);
      res.status(500).json({
        message:
          error.message || "Erreur lors de la création de l'abonnement",
      });
    }
  },
);

// Stripe webhook handler
export async function handleStripeWebhook(req: Request, res: Response) {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).json({ message: "No signature" });
  }

  let event: Stripe.Event;

  try {
    // Use raw body for webhook verification
    const rawBody = (req as any).rawBody || req.body;
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  try {
    switch (event.type) {
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          const updateData: any = {
            subscriptionStatus: subscription.status,
          };

          if ((subscription as any).current_period_end) {
            updateData.subscriptionCurrentPeriodEnd = new Date(
              (subscription as any).current_period_end * 1000,
            );
          }

          await storage.updateStripeInfo(user.id, updateData);
          await storage.updateUser(user.id, { accountStatus: "active" });

          await notifySubscriptionAlert(
            storage,
            user.id,
            "subscription_created",
            "Votre abonnement SpeedAI a été créé avec succès.",
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          const updateData: any = {
            subscriptionStatus: subscription.status,
          };

          if ((subscription as any).current_period_end) {
            updateData.subscriptionCurrentPeriodEnd = new Date(
              (subscription as any).current_period_end * 1000,
            );
          }

          await storage.updateStripeInfo(user.id, updateData);

          if (subscription.status === "active") {
            await notifySubscriptionAlert(
              storage,
              user.id,
              "subscription_renewed",
              "Votre abonnement SpeedAI a été renouvelé avec succès.",
            );
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          await storage.updateStripeInfo(user.id, {
            subscriptionStatus: "canceled",
          });

          await notifySubscriptionAlert(
            storage,
            user.id,
            "subscription_expired",
            "Votre abonnement SpeedAI a expiré. Renouvelez-le pour continuer à utiliser nos services.",
          );
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceSubscription = (invoice as any).subscription;
        if (invoiceSubscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoiceSubscription as string,
          );
          const customerId = subscription.customer as string;

          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            const updateData: any = {
              subscriptionStatus: "active",
            };

            if ((subscription as any).current_period_end) {
              updateData.subscriptionCurrentPeriodEnd = new Date(
                (subscription as any).current_period_end * 1000,
              );
            }

            await storage.updateStripeInfo(user.id, updateData);
            await storage.updateUser(user.id, { accountStatus: "active" });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceSubscription = (invoice as any).subscription;
        if (invoiceSubscription && invoice.customer) {
          const customerId = invoice.customer as string;
          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.updateStripeInfo(user.id, {
              subscriptionStatus: "past_due",
            });
          }
        }
        break;
      }

      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        
        // Only handle CB Guarantee sessions (mode: setup)
        if (checkoutSession.mode === 'setup') {
          console.log('🔔 [Stripe Webhook] CB Guarantee checkout completed:', checkoutSession.id);
          
          try {
            const guaranteeSession = await storage.getGuaranteeSessionByCheckoutSessionId(checkoutSession.id);
            
            if (!guaranteeSession) {
              console.log('⚠️ [Stripe Webhook] Guarantee session not found for checkout:', checkoutSession.id);
              break;
            }
            
            if (guaranteeSession.status !== 'pending') {
              console.log('ℹ️ [Stripe Webhook] Session already processed, status:', guaranteeSession.status);
              break;
            }
            
            // Retrieve setup intent to get payment method ID
            let paymentMethodId = null;
            if (checkoutSession.setup_intent) {
              try {
                const config = await storage.getGuaranteeConfig(guaranteeSession.userId);
                if (config?.stripeAccountId) {
                  const setupIntent = await stripe.setupIntents.retrieve(
                    checkoutSession.setup_intent as string,
                    { stripeAccount: config.stripeAccountId }
                  );
                  paymentMethodId = setupIntent.payment_method as string;
                }
              } catch (setupErr) {
                console.error('⚠️ [Stripe Webhook] Error retrieving setup intent:', setupErr);
              }
            }
            
            // Update session to validated status
            const updatedSession = await storage.updateGuaranteeSession(guaranteeSession.id, {
              status: 'validated',
              validatedAt: new Date(),
              setupIntentId: checkoutSession.setup_intent as string,
              customerStripeId: checkoutSession.customer as string,
              paymentMethodId: paymentMethodId,
            });
            
            if (!updatedSession) {
              console.error('❌ [Stripe Webhook] Failed to update session:', guaranteeSession.id);
              break;
            }
            
            console.log('✅ [Stripe Webhook] Session validated:', guaranteeSession.id);
            
            // Get config for sending confirmation notifications
            const config = await storage.getGuaranteeConfig(guaranteeSession.userId);
            
            // Send confirmation email if enabled
            if (config && config.autoSendEmailOnValidation !== false && guaranteeSession.customerEmail && isEmailConfigured()) {
              try {
                const emailResult = await sendConfirmationEmail({
                  config,
                  session: updatedSession,
                });
                console.log(`📧 [Stripe Webhook] Confirmation email ${emailResult.success ? 'sent' : 'failed'} for ${guaranteeSession.customerEmail}`);
              } catch (emailError) {
                console.error('[Stripe Webhook] Error sending confirmation email:', emailError);
              }
            }
            
            // Send confirmation SMS if enabled
            if (config && config.autoSendSmsOnValidation && guaranteeSession.customerPhone && isSmsConfigured()) {
              try {
                const smsResult = await sendGuaranteeConfirmationSms(
                  guaranteeSession.customerPhone,
                  guaranteeSession.customerName,
                  config.companyName || 'Établissement',
                  new Date(guaranteeSession.reservationDate),
                  guaranteeSession.reservationTime,
                  guaranteeSession.nbPersons
                );
                console.log(`📱 [Stripe Webhook] Confirmation SMS ${smsResult.success ? 'sent' : 'failed'} for ${guaranteeSession.customerPhone}`);
              } catch (smsError) {
                console.error('[Stripe Webhook] Error sending confirmation SMS:', smsError);
              }
            }
            
            // Call N8N webhook to trigger Calendar booking
            const N8N_WEBHOOK_CB_VALIDEE = process.env.N8N_WEBHOOK_CB_VALIDEE;
            
            if (N8N_WEBHOOK_CB_VALIDEE) {
              try {
                const n8nPayload = {
                  payment_validated: true,
                  calendar_booking_allowed: true,
                  workflow_control: {
                    action_required: "BOOK_CALENDAR_NOW",
                    can_book_calendar: true,
                    reason: "Customer validated card on Stripe - proceed with calendar booking",
                    instructions: [
                      "1. Card validation CONFIRMED by Stripe",
                      "2. You can NOW book the Google Calendar event",
                      "3. After booking, call POST /api/guarantee/confirm-booking with session_id"
                    ]
                  },
                  status: 'validated',
                  event: 'cb_validated',
                  action: 'book_calendar',
                  api_key: process.env.N8N_MASTER_API_KEY,
                  dashboard_url: process.env.REPLIT_DEV_DOMAIN 
                    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
                    : process.env.FRONTEND_URL || 'https://vocaledash.com',
                  session_id: guaranteeSession.id,
                  agent_id: guaranteeSession.agentId,
                  business_type: guaranteeSession.businessType,
                  customer_name: guaranteeSession.customerName,
                  customer_email: guaranteeSession.customerEmail,
                  customer_phone: guaranteeSession.customerPhone,
                  reservation_date: guaranteeSession.reservationDate,
                  reservation_time: guaranteeSession.reservationTime,
                  nb_persons: guaranteeSession.nbPersons,
                  duration: guaranteeSession.duration,
                  calendar_id: guaranteeSession.calendarId,
                  company_name: guaranteeSession.companyName || config?.companyName,
                  company_email: guaranteeSession.companyEmail,
                  timezone: guaranteeSession.timezone || 'Europe/Paris',
                  vehicule: guaranteeSession.vehicule,
                  type_service: guaranteeSession.typeService,
                  email_enabled: config ? isEmailConfigured() && config.autoSendEmailOnValidation !== false : false,
                  sms_enabled: config ? isSmsConfigured() && config.autoSendSmsOnValidation === true : false,
                  validated_at: updatedSession.validatedAt?.toISOString(),
                };
                
                const n8nResponse = await fetch(N8N_WEBHOOK_CB_VALIDEE, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(n8nPayload),
                });
                
                console.log('✅ [N8N] Webhook called for CB validation + calendar booking:', guaranteeSession.id, 'Response:', n8nResponse.status);
                console.log('📤 [N8N] Payload sent:', JSON.stringify(n8nPayload, null, 2));
              } catch (n8nError) {
                console.error('❌ [N8N] Error calling webhook:', n8nError);
              }
            } else {
              console.log('ℹ️ [N8N] N8N_WEBHOOK_CB_VALIDEE not configured, skipping webhook call');
            }
          } catch (cbError) {
            console.error('❌ [Stripe Webhook] Error processing CB Guarantee:', cbError);
          }
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ message: "Webhook handler failed" });
  }
}

export default router;
