import { Router, Request, Response } from 'express';
import { waitlistService } from '../services/waitlist.service';
import { waitlistScheduler } from '../services/waitlist-scheduler.service';
import { triggerWaitlistSchema, confirmWaitlistSchema } from '@shared/schema';
import { requireAuth } from './middleware';
import { requireApiKey } from '../api-key-auth';
import { z } from 'zod';

const router = Router();

// ========== PUBLIC ROUTES (No Auth) ==========

// Get waitlist entry info by token (for public confirmation page)
router.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const result = await waitlistService.getEntryByToken(token);
    
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        error: 'Token invalide ou expiré' 
      });
    }

    // Return minimal data for public page (no sensitive info)
    res.json({
      success: true,
      data: {
        firstName: result.entry.firstName,
        lastName: result.entry.lastName,
        phone: result.entry.phone,
        email: result.entry.email,
        requestedSlot: result.entry.requestedSlot,
        alternativeSlots: result.entry.alternativeSlots,
        nbPersons: result.entry.nbPersons,
        businessName: result.businessName,
        slotStart: result.slot.slotStart
      }
    });
  } catch (error: any) {
    console.error('[WaitlistAPI] Error getting entry by token:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Confirm waitlist registration (public)
router.post('/confirm/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    const validatedData = confirmWaitlistSchema.parse(req.body);
    
    const result = await waitlistService.confirmRegistration(token, validatedData);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({ success: true, message: 'Inscription confirmée' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Données invalides',
        details: error.errors 
      });
    }
    console.error('[WaitlistAPI] Error confirming registration:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ========== API KEY AUTHENTICATED (For Voice Agent / N8N) ==========

// Trigger waitlist flow from voice agent
router.post('/trigger', requireApiKey, async (req: Request, res: Response) => {
  try {
    const validatedData = triggerWaitlistSchema.parse(req.body);
    
    // Get user ID from API key authentication
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Non autorisé' });
    }

    const result = await waitlistService.triggerWaitlistFlow({
      userId,
      requestedSlot: validatedData.requested_slot,
      phone: validatedData.phone,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email,
      nbPersons: validatedData.nbPersons,
      alternativeSlots: validatedData.alternativeSlots,
      source: validatedData.source
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      entryId: result.entryId,
      waitlistUrl: result.waitlistUrl
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Données invalides',
        details: error.errors 
      });
    }
    console.error('[WaitlistAPI] Error triggering waitlist:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ========== AUTHENTICATED DASHBOARD ROUTES ==========

// Get user's waitlist slots
router.get('/slots', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const slots = await waitlistService.getSlotsByUser(userId);
    res.json({ success: true, slots });
  } catch (error: any) {
    console.error('[WaitlistAPI] Error getting slots:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get entries for a specific slot
router.get('/slots/:slotId/entries', requireAuth, async (req: Request, res: Response) => {
  try {
    const { slotId } = req.params;
    const entries = await waitlistService.getEntriesBySlot(slotId);
    res.json({ success: true, entries });
  } catch (error: any) {
    console.error('[WaitlistAPI] Error getting entries:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get all user's waitlist entries with slots
router.get('/entries', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const entries = await waitlistService.getEntriesByUser(userId);
    res.json({ success: true, entries });
  } catch (error: any) {
    console.error('[WaitlistAPI] Error getting entries:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Get waitlist statistics
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const stats = await waitlistService.getWaitlistStats(userId);
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('[WaitlistAPI] Error getting stats:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Cancel an entry
router.post('/entries/:entryId/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    await waitlistService.cancelEntry(entryId);
    res.json({ success: true, message: 'Entrée annulée' });
  } catch (error: any) {
    console.error('[WaitlistAPI] Error cancelling entry:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Delete an entry
router.delete('/entries/:entryId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { entryId } = req.params;
    await waitlistService.deleteEntry(entryId);
    res.json({ success: true, message: 'Entrée supprimée' });
  } catch (error: any) {
    console.error('[WaitlistAPI] Error deleting entry:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ========== CRON ENDPOINT (External trigger) ==========

// External cron trigger for waitlist check
router.post('/cron/check', async (req: Request, res: Response) => {
  try {
    // Verify N8N master API key
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    const masterKey = process.env.N8N_MASTER_API_KEY;
    
    if (!masterKey || apiKey !== masterKey) {
      return res.status(401).json({ success: false, error: 'Non autorisé' });
    }

    const result = await waitlistScheduler.runGlobalCheck();
    
    res.json({ 
      success: true, 
      checked: result.checked,
      expired: result.expired,
      activeTimers: waitlistScheduler.getActiveTimersCount()
    });
  } catch (error: any) {
    console.error('[WaitlistAPI] Error running cron check:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Health check for waitlist scheduler
router.get('/health', async (_req: Request, res: Response) => {
  res.json({ 
    success: true,
    activeTimers: waitlistScheduler.getActiveTimersCount()
  });
});

export default router;
