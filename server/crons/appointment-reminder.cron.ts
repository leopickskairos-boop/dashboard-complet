import cron from 'node-cron';
import { storage } from '../storage';
import { sendAppointmentReminderSms, isSmsConfigured } from '../services/twilio-sms.service';

let isRunning = false;

export async function processAppointmentReminders(): Promise<{ sent: number; failed: number; details: { sessions: number; calls: number; orders: number } }> {
  if (isRunning) {
    console.log('[AppointmentReminderCron] Already running, skipping...');
    return { sent: 0, failed: 0, details: { sessions: 0, calls: 0, orders: 0 } };
  }

  isRunning = true;
  let sent = 0;
  let failed = 0;
  const details = { sessions: 0, calls: 0, orders: 0 };

  try {
    if (!isSmsConfigured()) {
      console.warn('[AppointmentReminderCron] SMS service not configured');
      return { sent: 0, failed: 0, details };
    }

    console.log('[AppointmentReminderCron] Starting appointment reminder processing...');
    
    // 1. Process CB Guarantee sessions
    const sessions = await storage.getSessionsForAppointmentReminder();
    console.log(`[AppointmentReminderCron] Found ${sessions.length} guarantee sessions to remind`);

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
          details.sessions++;
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

    // 2. Process calls with appointment dates
    const callsToRemind = await storage.getCallsForAppointmentReminder();
    console.log(`[AppointmentReminderCron] Found ${callsToRemind.length} calls to remind`);

    for (const call of callsToRemind) {
      try {
        if (!call.phoneNumber) {
          console.warn(`[AppointmentReminderCron] Call ${call.id} has no phone number`);
          continue;
        }

        const companyName = call.guaranteeConfig?.companyName || call.companyName || 'Votre établissement';
        
        const result = await sendAppointmentReminderSms(
          call.phoneNumber,
          call.clientName,
          companyName,
          call.appointmentDate!,
          call.appointmentHour !== null && call.appointmentHour !== undefined ? `${call.appointmentHour}:00` : null,
          call.nbPersonnes || 1
        );

        if (result.success) {
          await storage.markCallReminderSent(call.id);
          sent++;
          details.calls++;
          console.log(`✅ [AppointmentReminderCron] SMS sent for call ${call.id}`);
        } else {
          failed++;
          console.error(`❌ [AppointmentReminderCron] Failed to send SMS for call ${call.id}: ${result.error}`);
        }
      } catch (error: any) {
        failed++;
        console.error(`❌ [AppointmentReminderCron] Error processing call ${call.id}:`, error.message);
      }
    }

    // 3. Process external orders with reservation dates
    const ordersToRemind = await storage.getOrdersForAppointmentReminder();
    console.log(`[AppointmentReminderCron] Found ${ordersToRemind.length} orders to remind`);

    for (const order of ordersToRemind) {
      try {
        if (!order.customerPhone) {
          console.warn(`[AppointmentReminderCron] Order ${order.id} has no phone number`);
          continue;
        }

        const companyName = order.guaranteeConfig?.companyName || 'Votre établissement';
        
        const result = await sendAppointmentReminderSms(
          order.customerPhone,
          order.customerName,
          companyName,
          order.reservationDate!,
          order.reservationTime || null,
          order.partySize || 1
        );

        if (result.success) {
          await storage.markOrderReminderSent(order.id);
          sent++;
          details.orders++;
          console.log(`✅ [AppointmentReminderCron] SMS sent for order ${order.id}`);
        } else {
          failed++;
          console.error(`❌ [AppointmentReminderCron] Failed to send SMS for order ${order.id}: ${result.error}`);
        }
      } catch (error: any) {
        failed++;
        console.error(`❌ [AppointmentReminderCron] Error processing order ${order.id}:`, error.message);
      }
    }

    console.log(`[AppointmentReminderCron] Completed: ${sent} sent (sessions: ${details.sessions}, calls: ${details.calls}, orders: ${details.orders}), ${failed} failed`);
    return { sent, failed, details };
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

  console.log('[AppointmentReminderCron] Cron job started - runs every 15 minutes (sessions, calls, orders)');
}
