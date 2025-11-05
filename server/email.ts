import nodemailer from "nodemailer";

// Create email transporter
// In production, configure with a real SMTP service (SendGrid, Mailgun, etc.)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "ethereal.user@ethereal.email",
    pass: process.env.SMTP_PASS || "ethereal.pass",
  },
});

export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/verify-email?token=${token}`;

  try {
    const info = await transporter.sendMail({
      from: '"VoiceAI" <noreply@voiceai.com>',
      to: email,
      subject: "Vérifiez votre adresse email - VoiceAI",
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
              <h1 style="margin: 0; font-size: 28px;">Bienvenue sur VoiceAI ! 🎉</h1>
            </div>
            <div class="content">
              <p>Bonjour,</p>
              <p>Merci de vous être inscrit sur VoiceAI. Pour activer votre compte et accéder à toutes nos fonctionnalités, veuillez vérifier votre adresse email.</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Vérifier mon email</a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">Ou copiez ce lien dans votre navigateur :</p>
              <p style="word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 4px; font-size: 13px;">${verificationUrl}</p>
              <p style="margin-top: 30px; color: #6b7280; font-size: 14px;"><strong>Note :</strong> Ce lien expirera dans 24 heures.</p>
            </div>
            <div class="footer">
              <p>Si vous n'avez pas créé de compte VoiceAI, vous pouvez ignorer cet email.</p>
              <p>© 2025 VoiceAI. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Verification email sent:", info.messageId);
    // For development with Ethereal, log the preview URL
    if (process.env.NODE_ENV !== 'production') {
      console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Impossible d'envoyer l'email de vérification");
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  // Future implementation for password reset
  console.log("Password reset email would be sent to:", email, token);
}
