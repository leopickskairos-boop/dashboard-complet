/**
 * Google Calendar Service for Waitlist System
 * 
 * Verifies slot availability by checking Google Calendar events.
 * Uses OAuth2 tokens stored per-client for calendar access.
 */

export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status: string;
}

export interface CalendarAvailability {
  isAvailable: boolean;
  conflictingEvents: CalendarEvent[];
  checkedAt: Date;
}

export const GOOGLE_CALENDAR_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  scopes: [
    'https://www.googleapis.com/auth/calendar.readonly',
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
};

export class GoogleCalendarService {
  private accessToken: string;
  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest<T>(url: string, method: string = 'GET'): Promise<T> {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GoogleCalendar] Error ${response.status}: ${error}`);
      
      if (response.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }
      
      throw new Error(`Google Calendar API error: ${response.status} - ${error}`);
    }

    return response.json() as T;
  }

  /**
   * List all calendars for the authenticated user
   */
  async listCalendars(): Promise<{ id: string; summary: string; primary?: boolean }[]> {
    try {
      const response = await this.makeRequest<{ items: any[] }>(
        `${this.baseUrl}/users/me/calendarList`
      );
      return response.items?.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary,
      })) || [];
    } catch (error) {
      console.error('[GoogleCalendar] List calendars error:', error);
      return [];
    }
  }

  /**
   * Get events from a specific calendar within a time range
   */
  async getEvents(
    calendarId: string, 
    timeMin: Date, 
    timeMax: Date
  ): Promise<CalendarEvent[]> {
    try {
      const params = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      const encodedCalendarId = encodeURIComponent(calendarId);
      const response = await this.makeRequest<{ items: CalendarEvent[] }>(
        `${this.baseUrl}/calendars/${encodedCalendarId}/events?${params.toString()}`
      );
      
      return response.items || [];
    } catch (error) {
      console.error('[GoogleCalendar] Get events error:', error);
      return [];
    }
  }

  /**
   * Check if a specific time slot is available (no conflicting events)
   */
  async checkSlotAvailability(
    calendarId: string,
    slotStart: Date,
    slotEnd: Date
  ): Promise<CalendarAvailability> {
    const events = await this.getEvents(calendarId, slotStart, slotEnd);
    
    // Filter out cancelled events
    const activeEvents = events.filter(e => e.status !== 'cancelled');
    
    return {
      isAvailable: activeEvents.length === 0,
      conflictingEvents: activeEvents,
      checkedAt: new Date(),
    };
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCalendarAuthCode(code: string, redirectUri: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  try {
    const response = await fetch(GOOGLE_CALENDAR_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CALENDAR_OAUTH_CONFIG.clientId,
        client_secret: GOOGLE_CALENDAR_OAUTH_CONFIG.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GoogleCalendar] Token exchange error:', error);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error('[GoogleCalendar] Token exchange error:', error);
    return null;
  }
}

/**
 * Refresh an expired access token
 */
export async function refreshCalendarAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  try {
    const response = await fetch(GOOGLE_CALENDAR_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: GOOGLE_CALENDAR_OAUTH_CONFIG.clientId,
        client_secret: GOOGLE_CALENDAR_OAUTH_CONFIG.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GoogleCalendar] Token refresh error:', error);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error('[GoogleCalendar] Token refresh error:', error);
    return null;
  }
}

/**
 * Generate OAuth URL for calendar authorization
 */
export function generateCalendarOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CALENDAR_OAUTH_CONFIG.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_OAUTH_CONFIG.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_CALENDAR_OAUTH_CONFIG.authUrl}?${params.toString()}`;
}
