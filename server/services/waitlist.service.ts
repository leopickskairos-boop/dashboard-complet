import { db } from '../db';
import { 
  waitlistSlots, 
  waitlistEntries, 
  waitlistTokens,
  WaitlistSlot,
  WaitlistEntry,
  WaitlistToken,
  clientProfiles
} from '@shared/schema';
import { eq, and, inArray, lt, isNull, sql, desc, asc } from 'drizzle-orm';
import { getTwilioService } from './twilio-sms.service';
import crypto from 'crypto';

const FRONTEND_URL = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
  : 'http://localhost:5000';

interface TriggerWaitlistParams {
  userId: string;
  requestedSlot: Date;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  nbPersons?: number;
  alternativeSlots?: Date[];
  source?: string;
  businessName?: string;
}

interface WaitlistResult {
  success: boolean;
  entryId?: string;
  token?: string;
  waitlistUrl?: string;
  error?: string;
}

class WaitlistService {
  private generateToken(): string {
    return `wl_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async triggerWaitlistFlow(params: TriggerWaitlistParams): Promise<WaitlistResult> {
    const { 
      userId, 
      requestedSlot, 
      phone, 
      firstName = 'Client', 
      lastName = '', 
      email,
      nbPersons = 1,
      alternativeSlots,
      source = 'voice_agent',
      businessName
    } = params;

    try {
      // Get business name from client profile if not provided
      let companyName = businessName;
      if (!companyName) {
        const profile = await db.select().from(clientProfiles).where(eq(clientProfiles.userId, userId)).limit(1);
        companyName = profile[0]?.companyName || 'SpeedAI';
      }

      // Find or create a slot for this time
      let slot = await this.findOrCreateSlot(userId, requestedSlot, companyName);

      // Calculate priority based on existing entries
      const existingEntries = await db.select({ count: sql<number>`count(*)` })
        .from(waitlistEntries)
        .where(and(
          eq(waitlistEntries.slotId, slot.id),
          eq(waitlistEntries.status, 'pending')
        ));
      const priority = (existingEntries[0]?.count || 0) + 1;

      // Create waitlist entry
      const [entry] = await db.insert(waitlistEntries).values({
        slotId: slot.id,
        userId,
        firstName,
        lastName,
        phone,
        email,
        requestedSlot,
        alternativeSlots: alternativeSlots || [],
        nbPersons,
        status: 'pending',
        priority,
        source
      }).returning();

      // Generate secure token
      const token = this.generateToken();
      const tokenHash = this.hashToken(token);
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

      await db.insert(waitlistTokens).values({
        entryId: entry.id,
        token,
        tokenHash,
        tokenType: 'registration',
        expiresAt
      });

      // Build waitlist URL
      const waitlistUrl = `${FRONTEND_URL}/waitlist/${token}`;

      // Send SMS with link
      const twilioService = getTwilioService();
      if (twilioService.isConfigured()) {
        const dateStr = new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit'
        }).format(requestedSlot);

        const message = `${companyName}\n\n` +
          `Votre créneau du ${dateStr} n'est pas disponible.\n\n` +
          `Rejoignez la liste d'attente :\n${waitlistUrl}`;

        const smsResult = await twilioService.sendSms({ to: phone, message });
        
        if (smsResult.success && smsResult.messageId) {
          await db.update(waitlistEntries)
            .set({ smsMessageSid: smsResult.messageId })
            .where(eq(waitlistEntries.id, entry.id));
        }
      }

      // Update slot to monitoring if this is the first entry
      if (slot.status === 'pending') {
        await this.activateSlotMonitoring(slot.id, requestedSlot);
      }

      console.log(`[Waitlist] Entry created: ${entry.id} for slot ${slot.id}`);

      return {
        success: true,
        entryId: entry.id,
        token,
        waitlistUrl
      };
    } catch (error: any) {
      console.error('[Waitlist] Error triggering waitlist flow:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async findOrCreateSlot(userId: string, slotStart: Date, businessName?: string): Promise<WaitlistSlot> {
    // Look for existing slot within 30 minute window
    const windowStart = new Date(slotStart.getTime() - 30 * 60 * 1000);
    const windowEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

    const existingSlots = await db.select()
      .from(waitlistSlots)
      .where(and(
        eq(waitlistSlots.userId, userId),
        inArray(waitlistSlots.status, ['pending', 'monitoring']),
        sql`${waitlistSlots.slotStart} >= ${windowStart}`,
        sql`${waitlistSlots.slotStart} <= ${windowEnd}`
      ))
      .limit(1);

    if (existingSlots.length > 0) {
      return existingSlots[0];
    }

    // Create new slot
    const [newSlot] = await db.insert(waitlistSlots).values({
      userId,
      slotStart,
      status: 'pending',
      businessName,
      checkIntervalMinutes: this.calculateCheckInterval(slotStart)
    }).returning();

    return newSlot;
  }

  private calculateCheckInterval(slotStart: Date): number {
    const now = new Date();
    const hoursUntilSlot = (slotStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilSlot <= 6) {
      return 3; // 3 minutes on day of slot
    } else if (hoursUntilSlot <= 24) {
      return 5; // 5 minutes within 24h
    } else {
      return 10; // 10 minutes otherwise
    }
  }

  private async activateSlotMonitoring(slotId: string, slotStart: Date): Promise<void> {
    const checkInterval = this.calculateCheckInterval(slotStart);
    const nextCheckAt = new Date(Date.now() + checkInterval * 60 * 1000);

    await db.update(waitlistSlots)
      .set({ 
        status: 'monitoring',
        checkIntervalMinutes: checkInterval,
        nextCheckAt,
        updatedAt: new Date()
      })
      .where(eq(waitlistSlots.id, slotId));
  }

  async getEntryByToken(token: string): Promise<{entry: WaitlistEntry; slot: WaitlistSlot; businessName: string} | null> {
    const tokenRecord = await db.select()
      .from(waitlistTokens)
      .where(and(
        eq(waitlistTokens.token, token),
        isNull(waitlistTokens.consumedAt),
        sql`${waitlistTokens.expiresAt} > NOW()`
      ))
      .limit(1);

    if (!tokenRecord.length) {
      return null;
    }

    const entry = await db.select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.id, tokenRecord[0].entryId))
      .limit(1);

    if (!entry.length) {
      return null;
    }

    const slot = await db.select()
      .from(waitlistSlots)
      .where(eq(waitlistSlots.id, entry[0].slotId))
      .limit(1);

    if (!slot.length) {
      return null;
    }

    // Get business name
    const profile = await db.select()
      .from(clientProfiles)
      .where(eq(clientProfiles.userId, slot[0].userId))
      .limit(1);

    return {
      entry: entry[0],
      slot: slot[0],
      businessName: profile[0]?.companyName || slot[0].businessName || 'SpeedAI'
    };
  }

  async confirmRegistration(token: string, data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    selectedSlots: string[];
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const tokenRecord = await db.select()
        .from(waitlistTokens)
        .where(and(
          eq(waitlistTokens.token, token),
          isNull(waitlistTokens.consumedAt),
          sql`${waitlistTokens.expiresAt} > NOW()`
        ))
        .limit(1);

      if (!tokenRecord.length) {
        return { success: false, error: 'Token invalide ou expiré' };
      }

      // Update entry with confirmed info
      await db.update(waitlistEntries)
        .set({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email,
          alternativeSlots: data.selectedSlots.map(s => new Date(s)),
          updatedAt: new Date()
        })
        .where(eq(waitlistEntries.id, tokenRecord[0].entryId));

      // Consume token
      await db.update(waitlistTokens)
        .set({ consumedAt: new Date() })
        .where(eq(waitlistTokens.id, tokenRecord[0].id));

      console.log(`[Waitlist] Registration confirmed for entry ${tokenRecord[0].entryId}`);

      return { success: true };
    } catch (error: any) {
      console.error('[Waitlist] Error confirming registration:', error);
      return { success: false, error: error.message };
    }
  }

  async getSlotsByUser(userId: string): Promise<WaitlistSlot[]> {
    return db.select()
      .from(waitlistSlots)
      .where(eq(waitlistSlots.userId, userId))
      .orderBy(desc(waitlistSlots.createdAt));
  }

  async getEntriesBySlot(slotId: string): Promise<WaitlistEntry[]> {
    return db.select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.slotId, slotId))
      .orderBy(asc(waitlistEntries.priority));
  }

  async getEntriesByUser(userId: string): Promise<(WaitlistEntry & { slot: WaitlistSlot })[]> {
    const entries = await db.select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.userId, userId))
      .orderBy(desc(waitlistEntries.createdAt));

    const result = [];
    for (const entry of entries) {
      const [slot] = await db.select()
        .from(waitlistSlots)
        .where(eq(waitlistSlots.id, entry.slotId))
        .limit(1);
      
      if (slot) {
        result.push({ ...entry, slot });
      }
    }

    return result;
  }

  async getWaitlistStats(userId: string): Promise<{
    totalEntries: number;
    pendingEntries: number;
    confirmedEntries: number;
    activeSlots: number;
    conversionRate: number;
  }> {
    const slots = await db.select()
      .from(waitlistSlots)
      .where(eq(waitlistSlots.userId, userId));

    const slotIds = slots.map(s => s.id);
    
    if (slotIds.length === 0) {
      return {
        totalEntries: 0,
        pendingEntries: 0,
        confirmedEntries: 0,
        activeSlots: 0,
        conversionRate: 0
      };
    }

    const entries = await db.select()
      .from(waitlistEntries)
      .where(inArray(waitlistEntries.slotId, slotIds));

    const totalEntries = entries.length;
    const pendingEntries = entries.filter(e => e.status === 'pending').length;
    const confirmedEntries = entries.filter(e => e.status === 'confirmed').length;
    const activeSlots = slots.filter(s => s.status === 'pending' || s.status === 'monitoring').length;
    const conversionRate = totalEntries > 0 ? (confirmedEntries / totalEntries) * 100 : 0;

    return {
      totalEntries,
      pendingEntries,
      confirmedEntries,
      activeSlots,
      conversionRate: Math.round(conversionRate * 10) / 10
    };
  }

  async cancelEntry(entryId: string): Promise<void> {
    await db.update(waitlistEntries)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(waitlistEntries.id, entryId));
  }

  async deleteEntry(entryId: string): Promise<void> {
    await db.delete(waitlistEntries).where(eq(waitlistEntries.id, entryId));
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await db.delete(waitlistTokens)
      .where(lt(waitlistTokens.expiresAt, new Date()))
      .returning();
    
    return result.length;
  }

  async cleanupExpiredSlots(): Promise<number> {
    // Mark slots as expired if past their time
    const expiredSlots = await db.update(waitlistSlots)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(
        inArray(waitlistSlots.status, ['pending', 'monitoring']),
        lt(waitlistSlots.slotStart, new Date())
      ))
      .returning();

    // Also mark entries as expired
    for (const slot of expiredSlots) {
      await db.update(waitlistEntries)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(and(
          eq(waitlistEntries.slotId, slot.id),
          eq(waitlistEntries.status, 'pending')
        ));
    }

    return expiredSlots.length;
  }

  /**
   * Notify a waitlist entry that their slot is now available
   * Sends SMS with confirmation link
   */
  async notifyEntryOfAvailability(entryId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get entry with slot info
      const [entry] = await db.select()
        .from(waitlistEntries)
        .where(eq(waitlistEntries.id, entryId))
        .limit(1);

      if (!entry) {
        return { success: false, error: 'Entrée non trouvée' };
      }

      // Get slot info
      const [slot] = await db.select()
        .from(waitlistSlots)
        .where(eq(waitlistSlots.id, entry.slotId))
        .limit(1);

      if (!slot) {
        return { success: false, error: 'Créneau non trouvé' };
      }

      // Create confirmation token
      const tokenData = await this.createToken(entryId, 'confirmation');
      if (!tokenData) {
        return { success: false, error: 'Erreur création token' };
      }

      // Build confirmation URL
      const frontendUrl = process.env.FRONTEND_URL || 
        `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      const confirmUrl = `${frontendUrl}/waitlist/${tokenData.token}`;

      // Send SMS notification
      const { sendWaitlistAvailabilitySms } = await import('./twilio-sms.service');
      
      const smsResult = await sendWaitlistAvailabilitySms(
        entry.phone,
        entry.firstName,
        slot.businessName || 'Notre établissement',
        slot.slotStart,
        confirmUrl
      );

      if (!smsResult.success) {
        console.error(`[WaitlistService] Failed to send availability SMS: ${smsResult.error}`);
        return { success: false, error: smsResult.error };
      }

      // Update entry status
      await db.update(waitlistEntries)
        .set({
          status: 'notified',
          notifiedAt: new Date(),
          smsMessageSid: smsResult.messageId,
          responseDeadline: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes to respond
          updatedAt: new Date()
        })
        .where(eq(waitlistEntries.id, entryId));

      console.log(`✅ [WaitlistService] Notified entry ${entryId} of availability`);
      return { success: true };

    } catch (error: any) {
      console.error(`[WaitlistService] Error notifying entry ${entryId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

export const waitlistService = new WaitlistService();
