import { Resend } from 'resend';
import { storage } from './storage';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  previewText?: string;
  trackingId: string;
  fromName?: string;
  fromEmail?: string;
}

interface TemplateVariables {
  [key: string]: string | number | undefined;
}

function getBaseUrl(): string {
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

export function replaceVariables(content: string, variables: TemplateVariables): string {
  let result = content;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(regex, String(value || ''));
  }
  
  return result;
}

export function injectTrackingPixel(html: string, trackingId: string): string {
  const baseUrl = getBaseUrl();
  const pixelUrl = `${baseUrl}/api/marketing/track/open/${trackingId}`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
  
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }
  
  return html + pixel;
}

export function wrapLinksWithTracking(html: string, trackingId: string): string {
  const baseUrl = getBaseUrl();
  
  const linkRegex = /<a\s+([^>]*?)href=["']([^"'#][^"']*)["']([^>]*)>/gi;
  
  return html.replace(linkRegex, (match, before, url, after) => {
    if (url.startsWith('mailto:') || url.startsWith('tel:') || url.includes('/api/marketing/track/')) {
      return match;
    }
    
    const trackedUrl = `${baseUrl}/api/marketing/track/click/${trackingId}?url=${encodeURIComponent(url)}`;
    return `<a ${before}href="${trackedUrl}"${after}>`;
  });
}

export function addUnsubscribeLink(html: string, trackingId: string): string {
  const baseUrl = getBaseUrl();
  const unsubscribeUrl = `${baseUrl}/unsubscribe/${trackingId}`;
  
  const unsubscribeHtml = `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 0;">
        Si vous ne souhaitez plus recevoir nos emails, 
        <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">cliquez ici pour vous désinscrire</a>.
      </p>
    </div>
  `;
  
  if (html.includes('</body>')) {
    return html.replace('</body>', `${unsubscribeHtml}</body>`);
  }
  
  return html + unsubscribeHtml;
}

export async function sendMarketingEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    let html = options.html;
    
    html = wrapLinksWithTracking(html, options.trackingId);
    html = injectTrackingPixel(html, options.trackingId);
    html = addUnsubscribeLink(html, options.trackingId);
    
    const result = await resend.emails.send({
      from: `${options.fromName || 'SpeedAI Marketing'} <${options.fromEmail || 'marketing@speedai.fr'}>`,
      to: options.to,
      subject: options.subject,
      html: html,
      headers: {
        'X-Entity-Ref-ID': options.trackingId,
        'List-Unsubscribe': `<${getBaseUrl()}/api/marketing/unsubscribe/${options.trackingId}>`,
      },
    });
    
    if ('error' in result && result.error) {
      return { success: false, error: result.error.message };
    }
    
    return { success: true, messageId: (result as any).data?.id };
  } catch (error: any) {
    console.error("[MarketingEmail] Send error:", error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function sendCampaignToRecipients(
  campaignId: string,
  userId: string,
  onProgress?: (sent: number, total: number) => void
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const campaign = await storage.getMarketingCampaignById(campaignId, userId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  
  if (campaign.channel !== 'email' && campaign.channel !== 'both') {
    throw new Error('Campaign is not configured for email');
  }
  
  let contacts: any[] = [];
  
  if (campaign.targetAll) {
    contacts = await storage.getMarketingContacts(userId, { optInEmail: true, hasEmail: true });
  } else if (campaign.segmentId) {
    const segment = await storage.getMarketingSegmentById(campaign.segmentId, userId);
    if (segment?.filters) {
      const segmentContacts = await storage.getMarketingContactsBySegmentFilters(userId, segment.filters as any);
      contacts = segmentContacts.filter(c => c.email && c.optInEmail);
    }
  } else if (campaign.customFilters) {
    const filterContacts = await storage.getMarketingContactsBySegmentFilters(userId, campaign.customFilters as any);
    contacts = filterContacts.filter(c => c.email && c.optInEmail);
  }
  
  await storage.updateMarketingCampaign(campaignId, userId, {
    status: 'sending',
    sendingStartedAt: new Date(),
    totalRecipients: contacts.length,
  });
  
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (const contact of contacts) {
    try {
      const send = await storage.createMarketingSend({
        campaignId,
        contactId: contact.id,
        channel: 'email',
        status: 'pending',
        recipientEmail: contact.email,
      });
      
      const variables: TemplateVariables = {
        prenom: contact.firstName || '',
        nom: contact.lastName || '',
        email: contact.email || '',
        telephone: contact.phone || '',
      };
      
      const personalizedSubject = replaceVariables(campaign.emailSubject || '', variables);
      const personalizedContent = replaceVariables(campaign.emailContent || '', variables);
      
      const result = await sendMarketingEmail({
        to: contact.email,
        subject: personalizedSubject,
        html: personalizedContent,
        previewText: campaign.emailPreviewText || undefined,
        trackingId: send.trackingId,
      });
      
      if (result.success) {
        await storage.updateMarketingSend(send.id, {
          status: 'sent',
          sentAt: new Date(),
          externalMessageId: result.messageId,
        });
        await storage.incrementContactEmailStats(contact.id, 'sent');
        sent++;
      } else {
        await storage.updateMarketingSend(send.id, {
          status: 'failed',
          failedAt: new Date(),
          errorMessage: result.error,
        });
        failed++;
        errors.push(`${contact.email}: ${result.error}`);
      }
      
      if (onProgress) {
        onProgress(sent + failed, contacts.length);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      failed++;
      errors.push(`${contact.email}: ${error.message}`);
    }
  }
  
  await storage.updateMarketingCampaign(campaignId, userId, {
    status: 'sent',
    sentAt: new Date(),
    totalSent: sent,
    totalFailed: failed,
  });
  
  return { sent, failed, errors };
}

export function createBaseEmailTemplate(content: string, companyName: string = 'SpeedAI'): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { padding: 24px; text-align: center; background-color: #1a1a2e; color: #C8B88A; }
    .content { padding: 32px 24px; color: #333333; line-height: 1.6; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #666666; background-color: #f5f5f5; }
    .button { display: inline-block; padding: 14px 28px; background-color: #C8B88A; color: #1a1a2e; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .button:hover { background-color: #b8a87a; }
    h1 { margin: 0 0 16px 0; font-size: 24px; }
    h2 { margin: 0 0 12px 0; font-size: 20px; color: #1a1a2e; }
    p { margin: 0 0 16px 0; }
    .highlight { background-color: #f0eee6; padding: 16px; border-radius: 8px; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${companyName}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${companyName}. Tous droits réservés.</p>
    </div>
  </div>
</body>
</html>
`;
}

export const systemEmailTemplates = {
  promo: {
    restaurant: {
      name: 'Offre Promotionnelle Restaurant',
      subject: '{prenom}, une offre exclusive vous attend !',
      content: `
        <h2>Bonjour {prenom} !</h2>
        <p>Nous avons une offre spéciale rien que pour vous :</p>
        <div class="highlight">
          <strong>{reduction} de réduction sur votre prochaine visite !</strong>
          <p style="margin-top: 8px; margin-bottom: 0; font-size: 14px;">Valable jusqu'au {date_fin}</p>
        </div>
        <p>Utilisez le code <strong>{code_promo}</strong> lors de votre réservation.</p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="{lien_reservation}" class="button">Réserver maintenant</a>
        </p>
      `,
      variables: ['prenom', 'reduction', 'date_fin', 'code_promo', 'lien_reservation'],
    },
    default: {
      name: 'Offre Promotionnelle',
      subject: '{prenom}, profitez de notre offre exclusive !',
      content: `
        <h2>Bonjour {prenom} !</h2>
        <p>Une offre exceptionnelle vous attend :</p>
        <div class="highlight">
          <strong>{reduction} de réduction !</strong>
          <p style="margin-top: 8px; margin-bottom: 0; font-size: 14px;">Offre valable jusqu'au {date_fin}</p>
        </div>
        <p>N'attendez plus pour en profiter !</p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="{lien}" class="button">En profiter</a>
        </p>
      `,
      variables: ['prenom', 'reduction', 'date_fin', 'lien'],
    },
  },
  birthday: {
    name: 'Voeux d\'anniversaire',
    subject: 'Joyeux anniversaire {prenom} ! 🎂',
    content: `
      <h2>Joyeux anniversaire {prenom} ! 🎉</h2>
      <p>Toute l'équipe de {entreprise} vous souhaite un excellent anniversaire !</p>
      <div class="highlight">
        <p style="margin: 0;"><strong>Pour célébrer avec vous, nous vous offrons :</strong></p>
        <p style="margin: 8px 0 0 0; font-size: 20px; color: #C8B88A;">{cadeau}</p>
      </div>
      <p>Valable jusqu'au {date_fin}</p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="{lien}" class="button">Récupérer mon cadeau</a>
      </p>
    `,
    variables: ['prenom', 'entreprise', 'cadeau', 'date_fin', 'lien'],
  },
  reactivation: {
    name: 'Réactivation Client',
    subject: '{prenom}, vous nous manquez !',
    content: `
      <h2>Bonjour {prenom} !</h2>
      <p>Cela fait un moment que nous ne vous avons pas vu et vous nous manquez.</p>
      <p>Pour vous encourager à nous rendre visite, nous vous offrons une réduction spéciale :</p>
      <div class="highlight">
        <strong>{reduction} de réduction sur votre prochaine visite !</strong>
      </div>
      <p>Nous espérons vous revoir très bientôt.</p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="{lien}" class="button">Revenir nous voir</a>
      </p>
    `,
    variables: ['prenom', 'reduction', 'lien'],
  },
  welcome: {
    name: 'Bienvenue',
    subject: 'Bienvenue chez {entreprise}, {prenom} !',
    content: `
      <h2>Bienvenue {prenom} !</h2>
      <p>Nous sommes ravis de vous compter parmi nos clients.</p>
      <p>Voici ce qui vous attend :</p>
      <ul>
        <li>Des offres exclusives réservées à nos membres</li>
        <li>Des actualités et nouveautés en avant-première</li>
        <li>Des surprises pour votre anniversaire</li>
      </ul>
      <div class="highlight">
        <strong>Pour votre première visite : {offre_bienvenue}</strong>
      </div>
      <p style="text-align: center; margin-top: 24px;">
        <a href="{lien}" class="button">Découvrir</a>
      </p>
    `,
    variables: ['prenom', 'entreprise', 'offre_bienvenue', 'lien'],
  },
  event: {
    name: 'Événement',
    subject: '{prenom}, ne manquez pas cet événement !',
    content: `
      <h2>Bonjour {prenom} !</h2>
      <p>Nous organisons un événement exceptionnel et vous êtes invité(e) :</p>
      <div class="highlight">
        <h3 style="margin: 0 0 8px 0;">{nom_evenement}</h3>
        <p style="margin: 0;"><strong>📅 Date :</strong> {date_evenement}</p>
        <p style="margin: 4px 0 0 0;"><strong>📍 Lieu :</strong> {lieu}</p>
      </div>
      <p>{description}</p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="{lien_inscription}" class="button">S'inscrire</a>
      </p>
    `,
    variables: ['prenom', 'nom_evenement', 'date_evenement', 'lieu', 'description', 'lien_inscription'],
  },
};
