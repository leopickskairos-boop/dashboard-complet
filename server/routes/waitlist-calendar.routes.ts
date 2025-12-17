/**
 * Waitlist Calendar OAuth Routes
 * 
 * Handles Google Calendar OAuth flow and calendar configuration
 * for the waitlist system.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth';
import { db } from '../db';
import { waitlistCalendarConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  GoogleCalendarService,
  generateCalendarOAuthUrl,
  exchangeCalendarAuthCode,
  refreshCalendarAccessToken,
} from '../services/google-calendar.service';

const router = Router();

// Helper to get frontend URL
function getFrontendUrl(): string {
  if (process.env.REPLIT_DEPLOYMENT) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return process.env.FRONTEND_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
}

// GET /api/waitlist/calendar/config - Get calendar configuration
router.get('/config', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const config = await db
      .select()
      .from(waitlistCalendarConfig)
      .where(eq(waitlistCalendarConfig.userId, userId))
      .limit(1);

    if (!config.length) {
      return res.json({
        success: true,
        config: null,
        isConnected: false,
      });
    }

    const cfg = config[0];
    
    res.json({
      success: true,
      config: {
        provider: cfg.provider,
        calendarId: cfg.calendarId,
        calendarName: cfg.calendarName,
        isEnabled: cfg.isEnabled,
        checkIntervalMinutes: cfg.checkIntervalMinutes,
        lastSyncAt: cfg.lastSyncAt,
        lastError: cfg.lastError,
      },
      isConnected: !!(cfg.googleAccessToken && cfg.googleRefreshToken),
    });
  } catch (error: any) {
    console.error('[WaitlistCalendar] Error getting config:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/waitlist/calendar/oauth/google/start - Start Google OAuth flow
router.get('/oauth/google/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const frontendUrl = getFrontendUrl();
    const redirectUri = `${frontendUrl}/api/waitlist/calendar/oauth/google/callback`;
    
    // Create state with user ID for callback
    const state = Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64');
    
    const oauthUrl = generateCalendarOAuthUrl(redirectUri, state);
    
    res.json({
      success: true,
      oauthUrl,
    });
  } catch (error: any) {
    console.error('[WaitlistCalendar] Error starting OAuth:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/waitlist/calendar/oauth/google/callback - Handle Google OAuth callback
router.get('/oauth/google/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;
    const frontendUrl = getFrontendUrl();

    if (error) {
      console.error('[WaitlistCalendar] OAuth error:', error);
      return res.redirect(`${frontendUrl}/waitlist?calendar_error=oauth_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/waitlist?calendar_error=missing_params`);
    }

    // Decode state to get user ID
    let userId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
      userId = stateData.userId;
    } catch {
      return res.redirect(`${frontendUrl}/waitlist?calendar_error=invalid_state`);
    }

    // Exchange code for tokens
    const redirectUri = `${frontendUrl}/api/waitlist/calendar/oauth/google/callback`;
    const tokens = await exchangeCalendarAuthCode(code as string, redirectUri);

    if (!tokens) {
      return res.redirect(`${frontendUrl}/waitlist?calendar_error=token_exchange_failed`);
    }

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

    // Upsert calendar config
    const existingConfig = await db
      .select()
      .from(waitlistCalendarConfig)
      .where(eq(waitlistCalendarConfig.userId, userId))
      .limit(1);

    if (existingConfig.length) {
      await db
        .update(waitlistCalendarConfig)
        .set({
          googleAccessToken: tokens.accessToken,
          googleRefreshToken: tokens.refreshToken,
          googleTokenExpiry: tokenExpiry,
          updatedAt: new Date(),
        })
        .where(eq(waitlistCalendarConfig.userId, userId));
    } else {
      await db.insert(waitlistCalendarConfig).values({
        userId,
        provider: 'google_calendar',
        googleAccessToken: tokens.accessToken,
        googleRefreshToken: tokens.refreshToken,
        googleTokenExpiry: tokenExpiry,
        isEnabled: false,
      });
    }

    res.redirect(`${frontendUrl}/waitlist?calendar_connected=true`);
  } catch (error: any) {
    console.error('[WaitlistCalendar] OAuth callback error:', error);
    const frontendUrl = getFrontendUrl();
    res.redirect(`${frontendUrl}/waitlist?calendar_error=server_error`);
  }
});

// GET /api/waitlist/calendar/calendars - List available calendars
router.get('/calendars', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const config = await db
      .select()
      .from(waitlistCalendarConfig)
      .where(eq(waitlistCalendarConfig.userId, userId))
      .limit(1);

    if (!config.length || !config[0].googleAccessToken) {
      return res.status(400).json({ success: false, error: 'Calendrier non connecté' });
    }

    const cfg = config[0];
    let accessToken = cfg.googleAccessToken!;

    // Check if token needs refresh
    if (cfg.googleTokenExpiry && cfg.googleTokenExpiry < new Date()) {
      if (!cfg.googleRefreshToken) {
        return res.status(401).json({ success: false, error: 'Token expiré, reconnexion nécessaire' });
      }

      const newTokens = await refreshCalendarAccessToken(cfg.googleRefreshToken);
      if (!newTokens) {
        return res.status(401).json({ success: false, error: 'Impossible de rafraîchir le token' });
      }

      accessToken = newTokens.accessToken;
      
      // Update stored token
      await db
        .update(waitlistCalendarConfig)
        .set({
          googleAccessToken: newTokens.accessToken,
          googleTokenExpiry: new Date(Date.now() + newTokens.expiresIn * 1000),
          updatedAt: new Date(),
        })
        .where(eq(waitlistCalendarConfig.userId, userId));
    }

    const calendarService = new GoogleCalendarService(accessToken);
    const calendars = await calendarService.listCalendars();

    res.json({
      success: true,
      calendars,
    });
  } catch (error: any) {
    console.error('[WaitlistCalendar] Error listing calendars:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/waitlist/calendar/select - Select a calendar to monitor
router.post('/select', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { calendarId, calendarName } = req.body;

    if (!calendarId) {
      return res.status(400).json({ success: false, error: 'calendarId requis' });
    }

    await db
      .update(waitlistCalendarConfig)
      .set({
        calendarId,
        calendarName,
        isEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(waitlistCalendarConfig.userId, userId));

    res.json({
      success: true,
      message: 'Calendrier sélectionné',
    });
  } catch (error: any) {
    console.error('[WaitlistCalendar] Error selecting calendar:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/waitlist/calendar/toggle - Enable/disable calendar monitoring
router.post('/toggle', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { isEnabled } = req.body;

    await db
      .update(waitlistCalendarConfig)
      .set({
        isEnabled: !!isEnabled,
        updatedAt: new Date(),
      })
      .where(eq(waitlistCalendarConfig.userId, userId));

    res.json({
      success: true,
      isEnabled: !!isEnabled,
    });
  } catch (error: any) {
    console.error('[WaitlistCalendar] Error toggling:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST /api/waitlist/calendar/disconnect - Disconnect calendar
router.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    await db
      .update(waitlistCalendarConfig)
      .set({
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiry: null,
        calendarId: null,
        calendarName: null,
        isEnabled: false,
        updatedAt: new Date(),
      })
      .where(eq(waitlistCalendarConfig.userId, userId));

    res.json({
      success: true,
      message: 'Calendrier déconnecté',
    });
  } catch (error: any) {
    console.error('[WaitlistCalendar] Error disconnecting:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// GET /api/waitlist/calendar/check/:slotId - Check slot availability on calendar
router.get('/check/:slotId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { slotId } = req.params;

    const config = await db
      .select()
      .from(waitlistCalendarConfig)
      .where(eq(waitlistCalendarConfig.userId, userId))
      .limit(1);

    if (!config.length || !config[0].googleAccessToken || !config[0].calendarId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Calendrier non configuré',
        isAvailable: null,
      });
    }

    const cfg = config[0];
    
    // Get the slot details
    const { waitlistSlots } = await import('@shared/schema');
    const slots = await db
      .select()
      .from(waitlistSlots)
      .where(eq(waitlistSlots.id, slotId))
      .limit(1);

    if (!slots.length) {
      return res.status(404).json({ success: false, error: 'Créneau non trouvé' });
    }

    const slot = slots[0];
    const slotEnd = slot.slotEnd || new Date(slot.slotStart.getTime() + 60 * 60 * 1000); // Default 1 hour

    let accessToken = cfg.googleAccessToken!;

    // Refresh token if needed
    if (cfg.googleTokenExpiry && cfg.googleTokenExpiry < new Date() && cfg.googleRefreshToken) {
      const newTokens = await refreshCalendarAccessToken(cfg.googleRefreshToken);
      if (newTokens) {
        accessToken = newTokens.accessToken;
        await db
          .update(waitlistCalendarConfig)
          .set({
            googleAccessToken: newTokens.accessToken,
            googleTokenExpiry: new Date(Date.now() + newTokens.expiresIn * 1000),
          })
          .where(eq(waitlistCalendarConfig.userId, userId));
      }
    }

    const calendarService = new GoogleCalendarService(accessToken);
    const availability = await calendarService.checkSlotAvailability(
      cfg.calendarId!,
      slot.slotStart,
      slotEnd
    );

    res.json({
      success: true,
      ...availability,
    });
  } catch (error: any) {
    console.error('[WaitlistCalendar] Error checking availability:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
