import { Resend } from 'resend';
import { TwilioSmsService } from './twilio-sms.service';
import type { ReviewConfig, ReviewIncentive, ReviewRequest } from '@shared/schema';

const twilioService = new TwilioSmsService();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = 'SpeedAI <notifications@rdv-notif.tech>';

interface ThankYouResult {
  emailSent: boolean;
  smsSent: boolean;
  error?: string;
}

function getIncentiveDescription(incentive: ReviewIncentive): string {
  switch (incentive.type) {
    case 'percentage':
      return `${incentive.percentageValue}% de réduction`;
    case 'fixed_amount':
      return `${(incentive.fixedAmountValue || 0) / 100}€ de réduction`;
    case 'free_item':
      return incentive.freeItemName || 'Un cadeau offert';
    case 'loyalty_points':
      return `${incentive.loyaltyPointsValue} points fidélité`;
    default:
      return incentive.displayMessage || 'Une récompense vous attend';
  }
}

function buildDefaultSmsMessage(
  companyName: string,
  promoCode: string | null,
  incentive: ReviewIncentive | null
): string {
  let message = `Merci pour votre avis ! ${companyName} vous remercie chaleureusement.`;
  
  if (promoCode && incentive) {
    message += ` Votre code promo: ${promoCode} (${getIncentiveDescription(incentive)}). Valable ${incentive.validityDays} jours.`;
  }
  
  return message;
}

function buildDefaultEmailHtml(
  companyName: string,
  customerName: string,
  promoCode: string | null,
  incentive: ReviewIncentive | null
): string {
  const promoSection = promoCode && incentive ? `
    <div style="background: linear-gradient(135deg, #C8B88A 0%, #A69B6B 100%); color: #1a1a1a; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Votre code promo exclusif</p>
      <p style="margin: 0 0 12px 0; font-size: 28px; font-weight: 700; letter-spacing: 2px;">${promoCode}</p>
      <p style="margin: 0; font-size: 14px;">${getIncentiveDescription(incentive)}</p>
      <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.8;">Valable ${incentive.validityDays} jours</p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Merci pour votre avis !</h1>
          <p style="margin: 12px 0 0 0; opacity: 0.8; font-size: 14px;">${companyName}</p>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 16px 0;">Bonjour${customerName ? ' ' + customerName : ''},</p>
          <p style="margin: 0 0 16px 0;">
            Nous tenions à vous remercier sincèrement d'avoir pris le temps de partager votre expérience. 
            Votre avis compte énormément pour nous et nous aide à nous améliorer continuellement.
          </p>
          ${promoSection}
          <p style="margin: 24px 0 0 0;">
            À très bientôt !<br>
            <strong>L'équipe ${companyName}</strong>
          </p>
        </div>
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">Propulsé par SpeedAI</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendThankYouMessage(
  request: ReviewRequest,
  config: ReviewConfig,
  incentive: ReviewIncentive | null
): Promise<ThankYouResult> {
  const result: ThankYouResult = {
    emailSent: false,
    smsSent: false,
  };

  if (!config.thankYouEnabled) {
    return result;
  }

  const companyName = config.companyName || 'Notre établissement';
  const promoCode = request.promoCode;
  const sendMethod = config.thankYouSendMethod || 'both';

  // Send SMS
  if ((sendMethod === 'sms' || sendMethod === 'both') && request.customerPhone) {
    try {
      const smsMessage = config.thankYouSmsMessage 
        ? config.thankYouSmsMessage
            .replace('{prenom}', request.customerName?.split(' ')[0] || '')
            .replace('{nom}', request.customerName || '')
            .replace('{code_promo}', promoCode || '')
            .replace('{entreprise}', companyName)
        : buildDefaultSmsMessage(companyName, promoCode, incentive);

      const smsResult = await twilioService.sendSms({
        to: request.customerPhone,
        message: smsMessage,
      });

      result.smsSent = smsResult.success;
      if (!smsResult.success) {
        console.error('[ThankYou] SMS failed:', smsResult.error);
      }
    } catch (error: any) {
      console.error('[ThankYou] SMS error:', error);
    }
  }

  // Send Email
  if ((sendMethod === 'email' || sendMethod === 'both') && request.customerEmail && resend) {
    try {
      const emailSubject = config.thankYouEmailSubject 
        ? config.thankYouEmailSubject.replace('{entreprise}', companyName)
        : `Merci pour votre avis - ${companyName}`;

      const emailHtml = config.thankYouEmailMessage
        ? config.thankYouEmailMessage
            .replace('{prenom}', request.customerName?.split(' ')[0] || '')
            .replace('{nom}', request.customerName || '')
            .replace('{code_promo}', promoCode || '')
            .replace('{entreprise}', companyName)
        : buildDefaultEmailHtml(companyName, request.customerName || '', promoCode, incentive);

      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: request.customerEmail,
        subject: emailSubject,
        html: emailHtml,
      });

      result.emailSent = !error;
      if (error) {
        console.error('[ThankYou] Email failed:', error);
      }
    } catch (error: any) {
      console.error('[ThankYou] Email error:', error);
    }
  }

  console.log(`[ThankYou] Sent to ${request.customerName}: SMS=${result.smsSent}, Email=${result.emailSent}`);
  return result;
}
