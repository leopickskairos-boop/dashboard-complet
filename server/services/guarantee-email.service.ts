import { Resend } from 'resend';
import type { ClientGuaranteeConfig, GuaranteeSession } from '@shared/schema';

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface GuaranteeEmailOptions {
  config: ClientGuaranteeConfig;
  session: GuaranteeSession;
  checkoutUrl?: string;
}

const resend = new Resend(process.env.RESEND_API_KEY);

function getFrontendUrl(): string {
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function getFromAddress(config: ClientGuaranteeConfig): string {
  const senderName = config.gmailSenderName || config.companyName || 'SpeedAI Garantie';
  const senderEmail = config.senderEmail || 'garantie@speedai.fr';
  return `${senderName} <${senderEmail}>`;
}

function getDefaultFromAddress(): string {
  return 'SpeedAI Garantie <onboarding@resend.dev>';
}

export async function sendCardRequestEmail(options: GuaranteeEmailOptions): Promise<EmailResult> {
  const { config, session, checkoutUrl } = options;
  
  if (!session.customerEmail) {
    return { success: false, error: 'Pas d\'email client' };
  }
  
  if (!checkoutUrl) {
    return { success: false, error: 'URL de validation manquante' };
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'Resend non configuré' };
  }
  
  const brandColor = config.brandColor || '#C8B88A';
  const companyName = config.companyName || 'Notre établissement';
  const reservationDate = formatDate(new Date(session.reservationDate));
  const totalPenalty = (config.penaltyAmount || 30) * session.nbPersons;
  
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmez votre réservation</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px; margin: 0 auto;">
          
          <!-- Header -->
          <tr>
            <td style="background: ${brandColor}; border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center;">
              ${config.logoUrl ? `<img src="${config.logoUrl}" alt="${companyName}" style="max-height: 50px; max-width: 180px; margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto;">` : `<div style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">${companyName}</div>`}
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background: #ffffff; padding: 40px;">
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #18181b; line-height: 1.3;">Confirmez votre réservation</h1>
              <p style="margin: 0 0 28px; font-size: 15px; color: #71717a; line-height: 1.5;">Une garantie par carte bancaire est requise pour finaliser votre demande.</p>
              
              <p style="margin: 0 0 24px; font-size: 15px; color: #3f3f46; line-height: 1.6;">Bonjour <strong style="color: #18181b;">${session.customerName}</strong>,</p>
              
              <p style="margin: 0 0 28px; font-size: 15px; color: #3f3f46; line-height: 1.6;">Merci pour votre demande de réservation. Afin de la confirmer, nous vous invitons à enregistrer une carte bancaire.</p>
              
              <!-- Reservation Details Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px; border-bottom: 1px solid #e4e4e7;">
                    <div style="font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Date</div>
                    <div style="font-size: 15px; font-weight: 600; color: #18181b;">${reservationDate}</div>
                  </td>
                </tr>
                ${session.reservationTime ? `
                <tr>
                  <td style="padding: 20px 24px; border-bottom: 1px solid #e4e4e7;">
                    <div style="font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Heure</div>
                    <div style="font-size: 15px; font-weight: 600; color: #18181b;">${session.reservationTime}</div>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 20px 24px;">
                    <div style="font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Nombre de personnes</div>
                    <div style="font-size: 15px; font-weight: 600; color: #18181b;">${session.nbPersons} personne${session.nbPersons > 1 ? 's' : ''}</div>
                  </td>
                </tr>
              </table>
              
              <!-- Info Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #fffbeb; border-left: 3px solid ${brandColor}; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <div style="font-size: 14px; font-weight: 600; color: #92400e; margin-bottom: 6px;">Garantie sans engagement</div>
                    <div style="font-size: 14px; color: #a16207; line-height: 1.5;">Votre carte ne sera pas debitee. Elle sert uniquement de garantie en cas de non-presentation sans annulation prealable (${totalPenalty} EUR).</div>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding-bottom: 24px;">
                    <a href="${checkoutUrl}" style="display: inline-block; background: ${brandColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 15px; font-weight: 600; letter-spacing: -0.2px;">Enregistrer ma carte</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 4px; font-size: 12px; color: #a1a1aa; text-align: center;">Paiement securise par Stripe</p>
              
              ${config.cancellationDelay ? `
              <p style="margin: 24px 0 0; font-size: 13px; color: #71717a; line-height: 1.5; text-align: center;">Annulation gratuite jusqu'a ${config.cancellationDelay}h avant votre reservation.</p>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #fafafa; border-radius: 0 0 12px 12px; padding: 24px 40px; text-align: center; border-top: 1px solid #e4e4e7;">
              <div style="font-size: 14px; font-weight: 600; color: #3f3f46; margin-bottom: 4px;">${companyName}</div>
              ${config.companyAddress ? `<div style="font-size: 13px; color: #71717a; margin-bottom: 2px;">${config.companyAddress}</div>` : ''}
              ${config.companyPhone ? `<div style="font-size: 13px; color: #71717a;">${config.companyPhone}</div>` : ''}
              ${config.termsUrl ? `<div style="margin-top: 12px;"><a href="${config.termsUrl}" style="font-size: 12px; color: #a1a1aa; text-decoration: underline;">Conditions generales</a></div>` : ''}
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const fromAddress = config.senderEmail ? getFromAddress(config) : getDefaultFromAddress();
    
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: session.customerEmail,
      subject: `${companyName} - Confirmez votre reservation du ${reservationDate}`,
      html,
      text: `Bonjour ${session.customerName},

Pour confirmer votre reservation du ${reservationDate} pour ${session.nbPersons} personne(s), veuillez enregistrer votre carte bancaire en cliquant sur ce lien :

${checkoutUrl}

Votre carte ne sera pas debitee. Elle servira uniquement de garantie en cas de non-presentation.

${companyName}`,
    });
    
    if (error) {
      console.error('[GuaranteeEmail] Resend error:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`[GuaranteeEmail] Card request email sent via Resend to ${session.customerEmail}, ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('[GuaranteeEmail] Error sending card request email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendConfirmationEmail(options: GuaranteeEmailOptions): Promise<EmailResult> {
  const { config, session } = options;
  
  if (!session.customerEmail) {
    return { success: false, error: 'Pas d\'email client' };
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'Resend non configuré' };
  }
  
  const brandColor = config.brandColor || '#C8B88A';
  const companyName = config.companyName || 'Notre établissement';
  const reservationDate = formatDate(new Date(session.reservationDate));
  
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reservation confirmee</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px; margin: 0 auto;">
          
          <!-- Header - Success Green -->
          <tr>
            <td style="background: #059669; border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center;">
              <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; line-height: 48px;">
                <span style="color: #ffffff; font-size: 24px; font-weight: bold;">&#10003;</span>
              </div>
              <div style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Reservation confirmee</div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background: #ffffff; padding: 40px;">
              <p style="margin: 0 0 24px; font-size: 15px; color: #3f3f46; line-height: 1.6;">Bonjour <strong style="color: #18181b;">${session.customerName}</strong>,</p>
              
              <!-- Success Badge -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #d1fae5; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 20px; text-align: center;">
                    <span style="font-size: 14px; font-weight: 600; color: #065f46;">Votre reservation est maintenant confirmee</span>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 28px; font-size: 15px; color: #3f3f46; line-height: 1.6;">Nous avons bien enregistre votre carte bancaire. Votre reservation est desormais garantie.</p>
              
              <!-- Reservation Details Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 24px;" colspan="2">
                    <div style="font-size: 11px; font-weight: 600; color: ${brandColor}; text-transform: uppercase; letter-spacing: 0.5px;">Recapitulatif</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 24px; border-top: 1px solid #e4e4e7;">
                    <div style="font-size: 13px; color: #71717a;">Date</div>
                  </td>
                  <td style="padding: 12px 24px; border-top: 1px solid #e4e4e7; text-align: right;">
                    <div style="font-size: 14px; font-weight: 600; color: #18181b;">${reservationDate}</div>
                  </td>
                </tr>
                ${session.reservationTime ? `
                <tr>
                  <td style="padding: 12px 24px; border-top: 1px solid #e4e4e7;">
                    <div style="font-size: 13px; color: #71717a;">Heure</div>
                  </td>
                  <td style="padding: 12px 24px; border-top: 1px solid #e4e4e7; text-align: right;">
                    <div style="font-size: 14px; font-weight: 600; color: #18181b;">${session.reservationTime}</div>
                  </td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 12px 24px; border-top: 1px solid #e4e4e7;">
                    <div style="font-size: 13px; color: #71717a;">Personnes</div>
                  </td>
                  <td style="padding: 12px 24px; border-top: 1px solid #e4e4e7; text-align: right;">
                    <div style="font-size: 14px; font-weight: 600; color: #18181b;">${session.nbPersons}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 24px; border-top: 1px solid #e4e4e7;">
                    <div style="font-size: 13px; color: #71717a;">Reference</div>
                  </td>
                  <td style="padding: 12px 24px; border-top: 1px solid #e4e4e7; text-align: right;">
                    <div style="font-size: 14px; font-weight: 500; color: #18181b; font-family: monospace;">${session.reservationId}</div>
                  </td>
                </tr>
              </table>
              
              <!-- Info Box -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #f0f9ff; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <div style="font-size: 13px; font-weight: 600; color: #0369a1; margin-bottom: 12px;">A retenir</div>
                    <div style="font-size: 13px; color: #0c4a6e; line-height: 1.7;">
                      <div style="margin-bottom: 6px;">- Votre carte ne sera pas debitee si vous honorez votre reservation</div>
                      ${config.cancellationDelay ? `<div style="margin-bottom: 6px;">- Annulation gratuite jusqu'a ${config.cancellationDelay}h avant</div>` : ''}
                      <div>- En cas de retard, prevenez-nous pour conserver votre table</div>
                    </div>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; font-size: 15px; color: #3f3f46; text-align: center; line-height: 1.6;">Nous avons hate de vous accueillir.</p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #fafafa; border-radius: 0 0 12px 12px; padding: 24px 40px; text-align: center; border-top: 1px solid #e4e4e7;">
              <div style="font-size: 14px; font-weight: 600; color: #3f3f46; margin-bottom: 4px;">${companyName}</div>
              ${config.companyAddress ? `<div style="font-size: 13px; color: #71717a; margin-bottom: 2px;">${config.companyAddress}</div>` : ''}
              ${config.companyPhone ? `<div style="font-size: 13px; color: #71717a;">${config.companyPhone}</div>` : ''}
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  try {
    const fromAddress = config.senderEmail ? getFromAddress(config) : getDefaultFromAddress();
    
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: session.customerEmail,
      subject: `Reservation confirmee - ${companyName} - ${reservationDate}`,
      html,
      text: `Bonjour ${session.customerName},

Votre reservation est confirmee !

Date : ${reservationDate}
${session.reservationTime ? `Heure : ${session.reservationTime}` : ''}
Personnes : ${session.nbPersons}
Reference : ${session.reservationId}

Nous avons hate de vous accueillir !

${companyName}`,
    });
    
    if (error) {
      console.error('[GuaranteeEmail] Resend error:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`[GuaranteeEmail] Confirmation email sent via Resend to ${session.customerEmail}, ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('[GuaranteeEmail] Error sending confirmation email:', error);
    return { success: false, error: error.message };
  }
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
