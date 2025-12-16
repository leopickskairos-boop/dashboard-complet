import { db } from '../db';
import { waitlistSlots, waitlistEntries, WaitlistSlot } from '@shared/schema';
import { eq, and, inArray, lt, sql, asc } from 'drizzle-orm';

const DISABLE_INTERNAL_CRONS = process.env.DISABLE_INTERNAL_CRONS === 'true';

class WaitlistScheduler {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;
  private checkInProgress = false;

  async initialize(): Promise<void> {
    if (DISABLE_INTERNAL_CRONS) {
      console.log('[WaitlistScheduler] Disabled - using external cron API');
      return;
    }

    if (this.isInitialized) return;
    this.isInitialized = true;

    console.log('[WaitlistScheduler] Initializing...');
    await this.rehydrateActiveSlots();
  }

  private async rehydrateActiveSlots(): Promise<void> {
    try {
      const activeSlots = await db.select()
        .from(waitlistSlots)
        .where(inArray(waitlistSlots.status, ['pending', 'monitoring']));

      if (activeSlots.length === 0) {
        console.log('[WaitlistScheduler] No active slots to monitor - staying idle');
        return;
      }

      console.log(`[WaitlistScheduler] Rehydrating ${activeSlots.length} active slots`);

      for (const slot of activeSlots) {
        await this.scheduleSlotCheck(slot);
      }
    } catch (error) {
      console.error('[WaitlistScheduler] Error rehydrating slots:', error);
    }
  }

  async scheduleSlotCheck(slot: WaitlistSlot): Promise<void> {
    // Clear existing timer if any
    this.clearSlotTimer(slot.id);

    // Check if slot is still valid
    const now = new Date();
    if (slot.slotStart < now) {
      console.log(`[WaitlistScheduler] Slot ${slot.id} has passed - marking expired`);
      await this.expireSlot(slot.id);
      return;
    }

    // Calculate check interval based on proximity to slot time
    // Adaptive frequency per spec: D-1 = 10min, Day-D (<=6h) = 3min
    const hoursUntilSlot = (slot.slotStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    let intervalMinutes: number;

    if (hoursUntilSlot <= 6) {
      intervalMinutes = 3; // Day of slot (within 6 hours): every 3 minutes
    } else if (hoursUntilSlot <= 24) {
      intervalMinutes = 10; // D-1 (within 24 hours): every 10 minutes
    } else {
      intervalMinutes = 30; // Beyond D-1: every 30 minutes (minimal checks)
    }

    // Schedule next check
    const nextCheckTime = intervalMinutes * 60 * 1000;
    
    const timer = setTimeout(async () => {
      await this.checkSlotAvailability(slot.id);
    }, nextCheckTime);

    this.timers.set(slot.id, timer);

    // Update slot with next check time
    await db.update(waitlistSlots)
      .set({ 
        nextCheckAt: new Date(Date.now() + nextCheckTime),
        checkIntervalMinutes: intervalMinutes,
        updatedAt: new Date()
      })
      .where(eq(waitlistSlots.id, slot.id));
  }

  private clearSlotTimer(slotId: string): void {
    const existingTimer = this.timers.get(slotId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.timers.delete(slotId);
    }
  }

  private async expireSlot(slotId: string): Promise<void> {
    this.clearSlotTimer(slotId);

    await db.update(waitlistSlots)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(waitlistSlots.id, slotId));

    await db.update(waitlistEntries)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(
        eq(waitlistEntries.slotId, slotId),
        eq(waitlistEntries.status, 'pending')
      ));
  }

  async checkSlotAvailability(slotId: string): Promise<void> {
    if (this.checkInProgress) return;
    this.checkInProgress = true;

    try {
      // Get current slot state
      const [slot] = await db.select()
        .from(waitlistSlots)
        .where(eq(waitlistSlots.id, slotId))
        .limit(1);

      if (!slot) {
        this.clearSlotTimer(slotId);
        return;
      }

      // Check if slot time has passed
      if (slot.slotStart < new Date()) {
        await this.expireSlot(slotId);
        return;
      }

      // Check if slot is still in monitoring state
      if (slot.status !== 'pending' && slot.status !== 'monitoring') {
        this.clearSlotTimer(slotId);
        return;
      }

      // Check for pending entries
      const pendingEntries = await db.select()
        .from(waitlistEntries)
        .where(and(
          eq(waitlistEntries.slotId, slotId),
          eq(waitlistEntries.status, 'pending')
        ));

      if (pendingEntries.length === 0) {
        console.log(`[WaitlistScheduler] No pending entries for slot ${slotId} - stopping monitoring`);
        this.clearSlotTimer(slotId);
        await db.update(waitlistSlots)
          .set({ status: 'pending', nextCheckAt: null, updatedAt: new Date() })
          .where(eq(waitlistSlots.id, slotId));
        return;
      }

      // Update last check time
      await db.update(waitlistSlots)
        .set({ lastCheckAt: new Date(), updatedAt: new Date() })
        .where(eq(waitlistSlots.id, slotId));

      // TODO: Here you would check actual calendar availability
      // For now, we just reschedule the next check
      // When integrated with Google Calendar, this would check if slot became available

      // Reschedule next check
      await this.scheduleSlotCheck(slot);

    } catch (error) {
      console.error(`[WaitlistScheduler] Error checking slot ${slotId}:`, error);
    } finally {
      this.checkInProgress = false;
    }
  }

  async runGlobalCheck(): Promise<{ checked: number; expired: number }> {
    let checked = 0;
    let expired = 0;

    try {
      // Get all active slots
      const activeSlots = await db.select()
        .from(waitlistSlots)
        .where(inArray(waitlistSlots.status, ['pending', 'monitoring']));

      if (activeSlots.length === 0) {
        return { checked: 0, expired: 0 };
      }

      for (const slot of activeSlots) {
        // Check if slot has passed
        if (slot.slotStart < new Date()) {
          await this.expireSlot(slot.id);
          expired++;
          continue;
        }

        // Check entries
        const pendingEntries = await db.select()
          .from(waitlistEntries)
          .where(and(
            eq(waitlistEntries.slotId, slot.id),
            eq(waitlistEntries.status, 'pending')
          ));

        if (pendingEntries.length > 0) {
          // Reschedule if not already scheduled
          if (!this.timers.has(slot.id)) {
            await this.scheduleSlotCheck(slot);
          }
          checked++;
        } else {
          // No entries, stop monitoring
          this.clearSlotTimer(slot.id);
          await db.update(waitlistSlots)
            .set({ status: 'pending', nextCheckAt: null, updatedAt: new Date() })
            .where(eq(waitlistSlots.id, slot.id));
        }
      }

      // Cleanup expired tokens
      const expiredTokens = await db.delete(waitlistSlots)
        .where(lt(waitlistSlots.slotStart, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))) // 7 days old
        .returning();

      if (expiredTokens.length > 0) {
        console.log(`[WaitlistScheduler] Cleaned up ${expiredTokens.length} old slots`);
      }

    } catch (error) {
      console.error('[WaitlistScheduler] Error in global check:', error);
    }

    return { checked, expired };
  }

  getActiveTimersCount(): number {
    return this.timers.size;
  }

  async shutdown(): Promise<void> {
    console.log('[WaitlistScheduler] Shutting down...');
    this.timers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.timers.clear();
    this.isInitialized = false;
  }
}

export const waitlistScheduler = new WaitlistScheduler();
