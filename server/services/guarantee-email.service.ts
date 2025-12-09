import nodemailer from 'nodemailer';
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

function createTransporter(config: ClientGuaranteeConfig) {
  if (config.gmailSenderEmail && config.gmailAppPassword) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.gmailSenderEmail,
        pass: config.gmailAppPassword,
      },
    });
  }
  
  if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  
  return null;
}

function getFromAddress(config: ClientGuaranteeConfig): string {
  const name = config.gmailSenderName || config.companyName || 'SpeedAI';
  const email = config.gmailSenderEmail || process.env.SMTP_USER;
  return `"${name}" <${email}>`;
}

export async function sendCardRequestEmail(options: GuaranteeEmailOptions): Promise<EmailResult> {
  const { config, session, checkoutUrl } = options;
  
  if (!session.customerEmail) {
    return { success: false, error: 'Pas d\'email client' };
  }
  
  if (!checkoutUrl) {
    return { success: false, error: 'URL de validation manquante' };
  }
  
  const transporter = createTransporter(config);
  if (!transporter) {
    return { success: false, error: 'SMTP non configuré' };
  }
  
  const brandColor = config.brandColor || '#C8B88A';
  const companyName = config.companyName || 'Notre établissement';
  const reservationDate = formatDate(new Date(session.reservationDate));
  const totalPenalty = (config.penaltyAmount || 30) * session.nbPersons;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, ${brandColor} 0%, #0a0a0a 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .header p { margin: 10px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 30px; }
    .reservation-box { background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); border-radius: 12px; padding: 24px; margin: 20px 0; color: white; }
    .reservation-box h3 { margin: 0 0 16px; color: ${brandColor}; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .reservation-detail { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .reservation-detail:last-child { border-bottom: none; }
    .reservation-detail .label { color: #888; font-size: 14px; }
    .reservation-detail .value { color: white; font-weight: 500; }
    .guarantee-info { background: #fffbeb; border-left: 4px solid ${brandColor}; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .guarantee-info p { margin: 0; color: #92400e; font-size: 14px; }
    .cta-button { display: block; background: ${brandColor}; color: #0a0a0a !important; text-decoration: none; padding: 16px 32px; text-align: center; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 24px 0; transition: transform 0.2s; }
    .cta-button:hover { transform: scale(1.02); }
    .footer { text-align: center; padding: 24px; color: #666; font-size: 13px; background: #fafafa; }
    .footer a { color: ${brandColor}; text-decoration: none; }
    .steps { margin: 24px 0; }
    .step { display: flex; align-items: flex-start; margin-bottom: 16px; }
    .step-number { background: ${brandColor}; color: #0a0a0a; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; margin-right: 12px; flex-shrink: 0; }
    .step-text { font-size: 14px; color: #444; padding-top: 4px; }
    @media (max-width: 600px) { .container { padding: 10px; } .header { padding: 30px 20px; } .content { padding: 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        ${config.logoUrl ? `<img src="${config.logoUrl}" alt="${companyName}" style="max-height: 60px; margin-bottom: 16px;">` : ''}
        <h1>Confirmez votre réservation</h1>
        <p>Une garantie par carte bancaire est requise</p>
      </div>
      
      <div class="content">
        <p>Bonjour <strong>${session.customerName}</strong>,</p>
        
        <p>Nous avons bien reçu votre demande de réservation. Pour la confirmer définitivement, nous vous demandons d'enregistrer une carte bancaire comme garantie.</p>
        
        <div class="reservation-box">
          <h3>Détails de votre réservation</h3>
          <div class="reservation-detail">
            <span class="label">Date</span>
            <span class="value">${reservationDate}</span>
          </div>
          ${session.reservationTime ? `
          <div class="reservation-detail">
            <span class="label">Heure</span>
            <span class="value">${session.reservationTime}</span>
          </div>
          ` : ''}
          <div class="reservation-detail">
            <span class="label">Nombre de personnes</span>
            <span class="value">${session.nbPersons} personne${session.nbPersons > 1 ? 's' : ''}</span>
          </div>
        </div>
        
        <div class="guarantee-info">
          <p><strong>💳 Comment ça marche ?</strong></p>
          <p style="margin-top: 8px;">Votre carte ne sera <strong>pas débitée</strong> lors de l'enregistrement. Elle servira uniquement de garantie en cas de non-présentation (${totalPenalty}€).</p>
        </div>
        
        <div class="steps">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-text">Cliquez sur le bouton ci-dessous</div>
          </div>
          <div class="step">
            <div class="step-number">2</div>
            <div class="step-text">Entrez les informations de votre carte (sécurisé par Stripe)</div>
          </div>
          <div class="step">
            <div class="step-number">3</div>
            <div class="step-text">Recevez votre confirmation par email</div>
          </div>
        </div>
        
        <a href="${checkoutUrl}" class="cta-button">Enregistrer ma carte bancaire</a>
        
        <p style="text-align: center; color: #666; font-size: 13px;">
          🔒 Paiement 100% sécurisé par <strong>Stripe</strong>
        </p>
        
        ${config.cancellationDelay ? `
        <p style="color: #666; font-size: 13px; margin-top: 24px;">
          <strong>Annulation gratuite</strong> jusqu'à ${config.cancellationDelay}h avant votre réservation.
        </p>
        ` : ''}
      </div>
      
      <div class="footer">
        <p>${companyName}</p>
        ${config.companyAddress ? `<p>${config.companyAddress}</p>` : ''}
        ${config.companyPhone ? `<p>📞 ${config.companyPhone}</p>` : ''}
        ${config.termsUrl ? `<p><a href="${config.termsUrl}">Conditions générales</a></p>` : ''}
      </div>
    </div>
  </div>
</body>
</html>
`;

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(config),
      to: session.customerEmail,
      subject: `${companyName} - Confirmez votre réservation du ${reservationDate}`,
      html,
      text: `Bonjour ${session.customerName},\n\nPour confirmer votre réservation du ${reservationDate} pour ${session.nbPersons} personne(s), veuillez enregistrer votre carte bancaire en cliquant sur ce lien : ${checkoutUrl}\n\nVotre carte ne sera pas débitée. Elle servira uniquement de garantie en cas de non-présentation.\n\n${companyName}`,
    });
    
    console.log(`✅ [GuaranteeEmail] Card request email sent to ${session.customerEmail}, ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
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
  
  const transporter = createTransporter(config);
  if (!transporter) {
    return { success: false, error: 'SMTP non configuré' };
  }
  
  const brandColor = config.brandColor || '#C8B88A';
  const companyName = config.companyName || 'Notre établissement';
  const reservationDate = formatDate(new Date(session.reservationDate));
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .header .checkmark { font-size: 48px; margin-bottom: 16px; }
    .content { padding: 30px; }
    .reservation-box { background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); border-radius: 12px; padding: 24px; margin: 20px 0; color: white; }
    .reservation-box h3 { margin: 0 0 16px; color: ${brandColor}; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .reservation-detail { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .reservation-detail:last-child { border-bottom: none; }
    .reservation-detail .label { color: #888; font-size: 14px; }
    .reservation-detail .value { color: white; font-weight: 500; }
    .success-badge { background: #d1fae5; color: #065f46; padding: 12px 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-weight: 500; }
    .footer { text-align: center; padding: 24px; color: #666; font-size: 13px; background: #fafafa; }
    .footer a { color: ${brandColor}; text-decoration: none; }
    .tips { background: #f0f9ff; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .tips h4 { margin: 0 0 12px; color: #0369a1; font-size: 14px; }
    .tips ul { margin: 0; padding-left: 20px; color: #0c4a6e; font-size: 14px; }
    .tips li { margin-bottom: 6px; }
    @media (max-width: 600px) { .container { padding: 10px; } .header { padding: 30px 20px; } .content { padding: 20px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="checkmark">✓</div>
        <h1>Réservation confirmée !</h1>
      </div>
      
      <div class="content">
        <p>Bonjour <strong>${session.customerName}</strong>,</p>
        
        <div class="success-badge">
          🎉 Votre réservation est maintenant confirmée
        </div>
        
        <p>Nous avons bien enregistré votre carte bancaire comme garantie. Votre réservation est désormais définitivement confirmée.</p>
        
        <div class="reservation-box">
          <h3>Récapitulatif de votre réservation</h3>
          <div class="reservation-detail">
            <span class="label">Date</span>
            <span class="value">${reservationDate}</span>
          </div>
          ${session.reservationTime ? `
          <div class="reservation-detail">
            <span class="label">Heure</span>
            <span class="value">${session.reservationTime}</span>
          </div>
          ` : ''}
          <div class="reservation-detail">
            <span class="label">Nombre de personnes</span>
            <span class="value">${session.nbPersons} personne${session.nbPersons > 1 ? 's' : ''}</span>
          </div>
          <div class="reservation-detail">
            <span class="label">Référence</span>
            <span class="value">${session.reservationId}</span>
          </div>
        </div>
        
        <div class="tips">
          <h4>📋 Bon à savoir</h4>
          <ul>
            <li>Votre carte <strong>ne sera pas débitée</strong> si vous honorez votre réservation</li>
            ${config.cancellationDelay ? `<li>Annulation gratuite jusqu'à <strong>${config.cancellationDelay}h</strong> avant votre réservation</li>` : ''}
            <li>En cas de retard, prévenez-nous pour conserver votre table</li>
          </ul>
        </div>
        
        <p style="text-align: center; margin-top: 24px;">
          Nous avons hâte de vous accueillir !
        </p>
      </div>
      
      <div class="footer">
        <p><strong>${companyName}</strong></p>
        ${config.companyAddress ? `<p>📍 ${config.companyAddress}</p>` : ''}
        ${config.companyPhone ? `<p>📞 ${config.companyPhone}</p>` : ''}
      </div>
    </div>
  </div>
</body>
</html>
`;

  try {
    const info = await transporter.sendMail({
      from: getFromAddress(config),
      to: session.customerEmail,
      subject: `✓ Réservation confirmée - ${companyName} - ${reservationDate}`,
      html,
      text: `Bonjour ${session.customerName},\n\nVotre réservation est confirmée !\n\nDate : ${reservationDate}\n${session.reservationTime ? `Heure : ${session.reservationTime}\n` : ''}Personnes : ${session.nbPersons}\nRéférence : ${session.reservationId}\n\nNous avons hâte de vous accueillir !\n\n${companyName}`,
    });
    
    console.log(`✅ [GuaranteeEmail] Confirmation email sent to ${session.customerEmail}, ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('[GuaranteeEmail] Error sending confirmation email:', error);
    return { success: false, error: error.message };
  }
}

export function isEmailConfigured(config: ClientGuaranteeConfig): boolean {
  return !!(
    (config.gmailSenderEmail && config.gmailAppPassword) ||
    (process.env.SMTP_USER && process.env.SMTP_PASSWORD)
  );
}
