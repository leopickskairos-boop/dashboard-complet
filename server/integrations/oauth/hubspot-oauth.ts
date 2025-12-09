import { Router, Request, Response } from "express";
import { storage } from "../../storage";

const router = Router();

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}/api/integrations/oauth/hubspot/callback`;

const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.companies.read',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'oauth'
].join(' ');

export function getHubSpotAuthUrl(connectionId: string, userId: string): string {
  if (!HUBSPOT_CLIENT_ID) {
    throw new Error("HubSpot OAuth not configured - missing HUBSPOT_CLIENT_ID");
  }
  
  const state = Buffer.from(JSON.stringify({ connectionId, userId })).toString('base64');
  
  const params = new URLSearchParams({
    client_id: HUBSPOT_CLIENT_ID,
    redirect_uri: HUBSPOT_REDIRECT_URI,
    scope: HUBSPOT_SCOPES,
    state: state
  });
  
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error("HubSpot OAuth error:", error);
      return res.redirect('/integrations/connections?error=oauth_denied');
    }
    
    if (!code || !state) {
      return res.redirect('/integrations/connections?error=missing_params');
    }
    
    if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
      return res.redirect('/integrations/connections?error=oauth_not_configured');
    }
    
    let stateData: { connectionId: string; userId: string };
    try {
      stateData = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
    } catch {
      return res.redirect('/integrations/connections?error=invalid_state');
    }
    
    const { connectionId, userId } = stateData;
    
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: HUBSPOT_REDIRECT_URI,
        code: code as string
      })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("HubSpot token exchange error:", errorData);
      return res.redirect('/integrations/connections?error=token_exchange_failed');
    }
    
    const tokens = await tokenResponse.json();
    
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
    
    await storage.updateExternalConnection(connectionId, userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
      status: 'active',
      connectedAt: new Date()
    });
    
    res.redirect('/integrations/connections?success=hubspot_connected');
  } catch (error) {
    console.error("HubSpot OAuth callback error:", error);
    res.redirect('/integrations/connections?error=callback_error');
  }
});

export async function refreshHubSpotToken(connectionId: string, userId: string, refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date } | null> {
  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
    console.error("HubSpot OAuth not configured");
    return null;
  }
  
  try {
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        refresh_token: refreshToken
      })
    });
    
    if (!response.ok) {
      console.error("HubSpot token refresh failed:", await response.text());
      return null;
    }
    
    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
    
    await storage.updateExternalConnection(connectionId, userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt
    });
    
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt
    };
  } catch (error) {
    console.error("HubSpot token refresh error:", error);
    return null;
  }
}

export function isHubSpotConfigured(): boolean {
  return !!(HUBSPOT_CLIENT_ID && HUBSPOT_CLIENT_SECRET);
}

export const hubspotOAuthRouter = router;
