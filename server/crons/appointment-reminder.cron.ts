import cron from 'node-cron';
import { storage } from '../storage';
import { sendAppointmentReminderSms, isSmsConfigured } from '../services/twilio-sms.service';

let isRunning = false;

export async function processAppointmentReminders(): Promise<{ sent: number; failed: number }> {
  if (isRunning) {
    console.log('[AppointmentReminderCron] Already running, skipping...');
    return { sent: 0, failed: 0 };
  }

  isRunning = true;
  let sent = 0;
  let failed = 0;

  try {
    if (!isSmsConfigured()) {
      console.warn('[AppointmentReminderCron] SMS service not configured');
      return { sent: 0, failed: 0 };
    }

    console.log('[AppointmentReminderCron] Starting appointment reminder processing...');
    
    const sessions = await storage.getSessionsForAppointmentReminder();
    console.log(`[AppointmentReminderCron] Found ${sessions.length} sessions to remind`);

    for (const session of sessions) {
      try {
        if (!session.customerPhone) {
          console.warn(`[AppointmentReminderCron] Session ${session.id} has no phone number`);
          continue;
        }

        const companyName = session.config.companyName || 'Votre établissement';
        
        const result = await sendAppointmentReminderSms(
          session.customerPhone,
          session.customerName,
          companyName,
          session.reservationDate!,
          session.reservationTime,
          session.nbPersons
        );

        if (result.success) {
          await storage.markAppointmentReminderSent(session.id);
          sent++;
          console.log(`✅ [AppointmentReminderCron] SMS sent for session ${session.id}`);
        } else {
          failed++;
          console.error(`❌ [AppointmentReminderCron] Failed to send SMS for session ${session.id}: ${result.error}`);
        }
      } catch (error: any) {
        failed++;
        console.error(`❌ [AppointmentReminderCron] Error processing session ${session.id}:`, error.message);
      }
    }

    console.log(`[AppointmentReminderCron] Completed: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  } catch (error: any) {
    console.error('[AppointmentReminderCron] Fatal error:', error.message);
    throw error;
  } finally {
    isRunning = false;
  }
}

export function startAppointmentReminderCron() {
  cron.schedule('*/15 * * * *', async () => {
    await processAppointmentReminders();
  }, {
    timezone: 'Europe/Paris'
  });

  console.log('[AppointmentReminderCron] Cron job started - runs every 15 minutes');
}
