// Twilio SMS Service for sending review request messages
// Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER environment variables

interface SendSmsOptions {
  to: string;
  message: string;
}

interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class TwilioSmsService {
  private accountSid: string | undefined;
  private authToken: string | undefined;
  private fromNumber: string | undefined;
  private baseUrl: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER;
    this.baseUrl = 'https://api.twilio.com/2010-04-01';
  }

  isConfigured(): boolean {
    return !!(this.accountSid && this.authToken && this.fromNumber);
  }

  async sendSms(options: SendSmsOptions): Promise<SmsResult> {
    if (!this.isConfigured()) {
      console.warn('[TwilioSMS] Service not configured - missing credentials');
      return {
        success: false,
        error: 'Twilio SMS not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER.',
      };
    }

    const { to, message } = options;

    // Format phone number (ensure E.164 format)
    const formattedTo = this.formatPhoneNumber(to);
    if (!formattedTo) {
      return {
        success: false,
        error: 'Invalid phone number format',
      };
    }

    try {
      const url = `${this.baseUrl}/Accounts/${this.accountSid}/Messages.json`;
      
      const body = new URLSearchParams({
        To: formattedTo,
        From: this.fromNumber!,
        Body: message,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[TwilioSMS] API Error:', data);
        return {
          success: false,
          error: data.message || 'Failed to send SMS',
        };
      }

      console.log(`✅ [TwilioSMS] Message sent to ${formattedTo}, SID: ${data.sid}`);
      
      return {
        success: true,
        messageId: data.sid,
      };
    } catch (error: any) {
      console.error('[TwilioSMS] Error sending SMS:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  }

  private formatPhoneNumber(phone: string): string | null {
    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If no + prefix, assume French number
    if (!cleaned.startsWith('+')) {
      // French mobile numbers starting with 0
      if (cleaned.startsWith('0') && cleaned.length === 10) {
        cleaned = '+33' + cleaned.substring(1);
      } 
      // Already has country code without +
      else if (cleaned.length >= 11) {
        cleaned = '+' + cleaned;
      }
      else {
        return null;
      }
    }

    // Validate E.164 format (+ followed by 10-15 digits)
    if (/^\+\d{10,15}$/.test(cleaned)) {
      return cleaned;
    }

    return null;
  }
}

// Singleton instance
let twilioService: TwilioSmsService | null = null;

export function getTwilioService(): TwilioSmsService {
  if (!twilioService) {
    twilioService = new TwilioSmsService();
  }
  return twilioService;
}

export async function sendReviewRequestSms(
  phone: string,
  customerName: string,
  companyName: string,
  reviewLink: string,
  incentiveText?: string
): Promise<SmsResult> {
  const service = getTwilioService();
  
  if (!service.isConfigured()) {
    return {
      success: false,
      error: 'SMS service not configured',
    };
  }

  const message = `Bonjour ${customerName} !\n\nMerci pour votre visite chez ${companyName}.${incentiveText ? `\n🎁 ${incentiveText}` : ''}\n\nVotre avis compte : ${reviewLink}`;

  return service.sendSms({ to: phone, message });
}

interface GuaranteeSmsConfig {
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
  twilioFromNumber?: string | null;
  companyName?: string | null;
}

class ClientTwilioService {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private baseUrl = 'https://api.twilio.com/2010-04-01';

  constructor(config: GuaranteeSmsConfig) {
    this.accountSid = config.twilioAccountSid || '';
    this.authToken = config.twilioAuthToken || '';
    this.fromNumber = config.twilioFromNumber || '';
  }

  isConfigured(): boolean {
    return !!(this.accountSid && this.authToken && this.fromNumber);
  }

  private formatPhoneNumber(phone: string): string | null {
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('0') && cleaned.length === 10) {
        cleaned = '+33' + cleaned.substring(1);
      } else if (cleaned.length >= 11) {
        cleaned = '+' + cleaned;
      } else {
        return null;
      }
    }

    if (/^\+\d{10,15}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }

  async sendSms(to: string, message: string): Promise<SmsResult> {
    const formattedTo = this.formatPhoneNumber(to);
    if (!formattedTo) {
      return { success: false, error: 'Invalid phone number format' };
    }

    try {
      const url = `${this.baseUrl}/Accounts/${this.accountSid}/Messages.json`;
      
      const body = new URLSearchParams({
        To: formattedTo,
        From: this.fromNumber,
        Body: message,
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[ClientTwilioSMS] API Error:', data);
        return { success: false, error: data.message || 'Failed to send SMS' };
      }

      console.log(`✅ [ClientTwilioSMS] Message sent to ${formattedTo}, SID: ${data.sid}`);
      return { success: true, messageId: data.sid };
    } catch (error: any) {
      console.error('[ClientTwilioSMS] Error:', error);
      return { success: false, error: error.message };
    }
  }
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short'
  }).format(date);
}

export async function sendGuaranteeCardRequestSms(
  phone: string,
  customerName: string,
  companyName: string,
  checkoutUrl: string,
  reservationDate: Date,
  nbPersons: number,
  config?: GuaranteeSmsConfig
): Promise<SmsResult> {
  let service: TwilioSmsService | ClientTwilioService;
  
  if (config?.twilioAccountSid && config?.twilioAuthToken && config?.twilioFromNumber) {
    service = new ClientTwilioService(config);
  } else {
    service = getTwilioService();
  }

  if (!service.isConfigured()) {
    return { success: false, error: 'SMS service not configured' };
  }

  const dateStr = formatDateShort(reservationDate);
  const message = `${companyName} - Réservation ${dateStr}\n\nBonjour ${customerName},\nPour confirmer votre table (${nbPersons} pers.), enregistrez votre CB :\n${checkoutUrl}\n\n🔒 Sécurisé, non débité`;

  if (service instanceof ClientTwilioService) {
    return service.sendSms(phone, message);
  }
  return service.sendSms({ to: phone, message });
}

export async function sendGuaranteeConfirmationSms(
  phone: string,
  customerName: string,
  companyName: string,
  reservationDate: Date,
  reservationTime: string | null,
  nbPersons: number,
  config?: GuaranteeSmsConfig
): Promise<SmsResult> {
  let service: TwilioSmsService | ClientTwilioService;
  
  if (config?.twilioAccountSid && config?.twilioAuthToken && config?.twilioFromNumber) {
    service = new ClientTwilioService(config);
  } else {
    service = getTwilioService();
  }

  if (!service.isConfigured()) {
    return { success: false, error: 'SMS service not configured' };
  }

  const dateStr = formatDateShort(reservationDate);
  const timeStr = reservationTime ? ` à ${reservationTime}` : '';
  const message = `✓ Réservation confirmée !\n\n${companyName}\n📅 ${dateStr}${timeStr}\n👥 ${nbPersons} personne${nbPersons > 1 ? 's' : ''}\n\nÀ bientôt ${customerName} !`;

  if (service instanceof ClientTwilioService) {
    return service.sendSms(phone, message);
  }
  return service.sendSms({ to: phone, message });
}

export function isSmsConfigured(config?: GuaranteeSmsConfig): boolean {
  if (config?.twilioAccountSid && config?.twilioAuthToken && config?.twilioFromNumber) {
    return true;
  }
  return getTwilioService().isConfigured();
}

export { TwilioSmsService, ClientTwilioService };
