import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

// Environment variable priority:
// 1. FRONTEND_URL (explicit configuration, e.g., custom domain)
// 2. REPLIT_DOMAINS (production deployment URL - comma-separated, use first one)
// 3. REPLIT_DEV_DOMAIN (development URL)
// 4. localhost:5000 (local development fallback)
function getFrontendUrl(): string {
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  // In production, REPLIT_DOMAINS contains the production URL(s)
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    const productionDomain = domains.find(d => d.includes('.replit.app')) || domains[0];
    console.log('[Gmail] Using production domain:', productionDomain);
    return `https://${productionDomain}`;
  }
  // In development
  if (process.env.REPLIT_DEV_DOMAIN) {
    console.log('[Gmail] Using dev domain:', process.env.REPLIT_DEV_DOMAIN);
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'http://localhost:5000';
}

const FRONTEND_URL = getFrontendUrl();
console.log('[Gmail] FRONTEND_URL configured as:', FRONTEND_URL);

if (!SMTP_USER || !SMTP_PASSWORD) {
  console.warn('[Gmail] SMTP credentials not configured. Emails will not be sent.');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASSWORD,
  },
});

export async function sendVerificationEmail(email: string, token: string) {
  if (!SMTP_USER || !SMTP_PASSWORD) {
    console.error('[Gmail] Cannot send verification email: SMTP not configured');
    throw new Error("Configuration email manquante");
  }

  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  try {
    const info = await transporter.sendMail({
      from: `"SpeedAI" <${SMTP_USER}>`,
      to: email,
      subject: "Vérifiez votre adresse email - SpeedAI",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Bienvenue sur SpeedAI</h1>
            </div>
            <div class="content">
              <p>Bonjour,</p>
              <p>Merci de vous être inscrit sur SpeedAI. Pour activer votre compte et accéder à toutes nos fonctionnalités, veuillez vérifier votre adresse email.</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Vérifier mon email</a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Ou copiez ce lien dans votre navigateur :</p>
              <p style="word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 4px; font-size: 13px;">${verificationUrl}</p>
              <p style="margin-top: 30px; color: #6b7280; font-size: 14px;"><strong>Note :</strong> Ce lien expirera dans 24 heures.</p>
            </div>
            <div class="footer">
              <p>Si vous n'avez pas créé de compte SpeedAI, vous pouvez ignorer cet email.</p>
              <p>© 2025 SpeedAI. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('[Gmail] Verification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('[Gmail] Error sending verification email:', error);
    throw new Error("Impossible d'envoyer l'email de vérification");
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  if (!SMTP_USER || !SMTP_PASSWORD) {
    console.error('[Gmail] Cannot send password reset email: SMTP not configured');
    throw new Error("Configuration email manquante");
  }

  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  try {
    const info = await transporter.sendMail({
      from: `"SpeedAI" <${SMTP_USER}>`,
      to: email,
      subject: "Réinitialisation de votre mot de passe - SpeedAI",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Réinitialisation de mot de passe</h1>
            </div>
            <div class="content">
              <p>Bonjour,</p>
              <p>Vous avez demandé une réinitialisation de votre mot de passe SpeedAI. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Ou copiez ce lien dans votre navigateur :</p>
              <p style="word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 4px; font-size: 13px;">${resetUrl}</p>
              <div class="warning">
                <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Important :</strong> Ce lien expirera dans 1 heure pour des raisons de sécurité.</p>
              </div>
              <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.</p>
            </div>
            <div class="footer">
              <p>Pour votre sécurité, ne partagez jamais ce lien avec qui que ce soit.</p>
              <p>© 2025 SpeedAI. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log('[Gmail] Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('[Gmail] Error sending password reset email:', error);
    throw new Error("Impossible d'envoyer l'email de réinitialisation");
  }
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}) {
  if (!SMTP_USER || !SMTP_PASSWORD) {
    console.error('[Gmail] Cannot send email: SMTP not configured');
    throw new Error("Configuration email manquante");
  }

  try {
    const info = await transporter.sendMail({
      from: `"SpeedAI" <${SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    console.log('[Gmail] Email sent successfully:', info.messageId);
    if (options.attachments) {
      console.log(`[Gmail] Sent with ${options.attachments.length} attachment(s)`);
    }
    return info;
  } catch (error) {
    console.error('[Gmail] Error sending email:', error);
    throw new Error("Impossible d'envoyer l'email");
  }
}
