import { db } from '../db';
import { waitlistSlots, waitlistEntries, waitlistCalendarConfig, WaitlistSlot } from '@shared/schema';
import { eq, and, inArray, lt, sql, asc } from 'drizzle-orm';
import { GoogleCalendarService, refreshCalendarAccessToken } from './google-calendar.service';
import { waitlistService } from './waitlist.service';

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
    // Cost-optimized adaptive frequency: >24h = 60min, D-1 = 30min, <6h = 10min
    const hoursUntilSlot = (slot.slotStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    let intervalMinutes: number;

    if (hoursUntilSlot <= 6) {
      intervalMinutes = 10; // Day of slot (within 6 hours): every 10 minutes
    } else if (hoursUntilSlot <= 24) {
      intervalMinutes = 30; // D-1 (within 24 hours): every 30 minutes
    } else {
      intervalMinutes = 60; // Beyond D-1: every 60 minutes (minimal checks)
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

      // Check calendar availability if configured
      const isAvailable = await this.checkCalendarAvailability(slot);
      
      if (isAvailable) {
        console.log(`[WaitlistScheduler] Slot ${slotId} is now AVAILABLE - notifying first entry`);
        
        // Mark slot as available
        await db.update(waitlistSlots)
          .set({ status: 'available', updatedAt: new Date() })
          .where(eq(waitlistSlots.id, slotId));
        
        // Notify the first pending entry (ordered by priority and creation)
        const [firstEntry] = await db.select()
          .from(waitlistEntries)
          .where(and(
            eq(waitlistEntries.slotId, slotId),
            eq(waitlistEntries.status, 'pending')
          ))
          .orderBy(asc(waitlistEntries.priority), asc(waitlistEntries.createdAt))
          .limit(1);
        
        if (firstEntry) {
          await waitlistService.notifyEntryOfAvailability(firstEntry.id);
        }
        
        // Stop monitoring this slot (it's been handled)
        this.clearSlotTimer(slotId);
        return;
      }

      // Reschedule next check (slot still occupied)
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

  /**
   * Check calendar availability for a slot using Google Calendar
   * Returns true if the slot is available (no conflicting events)
   */
  private async checkCalendarAvailability(slot: WaitlistSlot): Promise<boolean> {
    try {
      // Get calendar config for the slot owner
      const [calendarConfig] = await db.select()
        .from(waitlistCalendarConfig)
        .where(eq(waitlistCalendarConfig.userId, slot.userId))
        .limit(1);

      // If no calendar configured or not enabled, cannot determine availability
      if (!calendarConfig || !calendarConfig.isEnabled || !calendarConfig.calendarId) {
        // Log minimal info - no calendar configured is expected for some users
        return false; // Cannot verify, assume not available
      }

      if (!calendarConfig.googleAccessToken) {
        console.warn(`[WaitlistScheduler] No access token for user ${slot.userId}`);
        return false;
      }

      let accessToken = calendarConfig.googleAccessToken;

      // Refresh token if expired
      if (calendarConfig.googleTokenExpiry && calendarConfig.googleTokenExpiry < new Date()) {
        if (!calendarConfig.googleRefreshToken) {
          await db.update(waitlistCalendarConfig)
            .set({ lastError: 'Token expiré, reconnexion nécessaire', updatedAt: new Date() })
            .where(eq(waitlistCalendarConfig.userId, slot.userId));
          return false;
        }

        const newTokens = await refreshCalendarAccessToken(calendarConfig.googleRefreshToken);
        if (!newTokens) {
          await db.update(waitlistCalendarConfig)
            .set({ lastError: 'Impossible de rafraîchir le token', updatedAt: new Date() })
            .where(eq(waitlistCalendarConfig.userId, slot.userId));
          return false;
        }

        accessToken = newTokens.accessToken;

        // Update stored token
        await db.update(waitlistCalendarConfig)
          .set({
            googleAccessToken: newTokens.accessToken,
            googleTokenExpiry: new Date(Date.now() + newTokens.expiresIn * 1000),
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(waitlistCalendarConfig.userId, slot.userId));
      }

      // Check calendar for conflicts
      const calendarService = new GoogleCalendarService(accessToken);
      const slotEnd = slot.slotEnd || new Date(slot.slotStart.getTime() + 60 * 60 * 1000); // Default 1 hour

      const availability = await calendarService.checkSlotAvailability(
        calendarConfig.calendarId,
        slot.slotStart,
        slotEnd
      );

      // Update last sync time
      await db.update(waitlistCalendarConfig)
        .set({ lastSyncAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(eq(waitlistCalendarConfig.userId, slot.userId));

      return availability.isAvailable;

    } catch (error: any) {
      console.error(`[WaitlistScheduler] Error checking calendar for slot ${slot.id}:`, error.message);
      return false; // Assume not available on error
    }
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
