// Facebook Graph API Integration for Page Reviews
// API Documentation: https://developers.facebook.com/docs/graph-api/reference/page/ratings/

interface FacebookRating {
  created_time: string;
  has_rating: boolean;
  has_review: boolean;
  rating?: number;
  recommendation_type?: 'positive' | 'negative' | 'none';
  review_text?: string;
  reviewer: {
    id: string;
    name: string;
  };
  open_graph_story?: {
    id: string;
  };
}

interface FacebookRatingsResponse {
  data: FacebookRating[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}

interface FacebookPage {
  id: string;
  name: string;
  category: string;
  access_token: string;
  overall_star_rating?: number;
  rating_count?: number;
  picture?: {
    data: {
      url: string;
    };
  };
  link?: string;
}

interface FacebookPagesResponse {
  data: FacebookPage[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
}

export class FacebookPagesService {
  private accessToken: string;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set('access_token', this.accessToken);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    console.log(`[FacebookPages] Fetching: ${url.toString().replace(this.accessToken, '***')}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`[FacebookPages] Error ${response.status}:`, error);
      
      if (response.status === 401 || error.error?.code === 190) {
        throw new Error('TOKEN_EXPIRED');
      }
      
      throw new Error(`Facebook API error: ${response.status} - ${error.error?.message || 'Unknown error'}`);
    }

    return response.json() as T;
  }

  async getUserPages(): Promise<FacebookPage[]> {
    try {
      const response = await this.makeRequest<FacebookPagesResponse>('/me/accounts', {
        fields: 'id,name,category,access_token,overall_star_rating,rating_count,picture,link',
      });
      return response.data || [];
    } catch (error) {
      console.error('[FacebookPages] Get user pages error:', error);
      return [];
    }
  }

  async getPageRatings(pageId: string, pageAccessToken: string, after?: string): Promise<FacebookRatingsResponse> {
    try {
      const params: Record<string, string> = {
        access_token: pageAccessToken,
        fields: 'created_time,has_rating,has_review,rating,recommendation_type,review_text,reviewer{id,name}',
      };
      
      if (after) {
        params.after = after;
      }

      const url = new URL(`${this.baseUrl}/${pageId}/ratings`);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }

      console.log(`[FacebookPages] Fetching ratings: ${url.toString().replace(pageAccessToken, '***')}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`[FacebookPages] Ratings error ${response.status}:`, error);
        throw new Error(`Facebook API error: ${response.status}`);
      }

      return response.json() as FacebookRatingsResponse;
    } catch (error) {
      console.error('[FacebookPages] Get page ratings error:', error);
      return { data: [] };
    }
  }

  async getAllPageRatings(pageId: string, pageAccessToken: string): Promise<FacebookRating[]> {
    const allRatings: FacebookRating[] = [];
    let after: string | undefined;

    do {
      const response = await this.getPageRatings(pageId, pageAccessToken, after);
      allRatings.push(...response.data);
      after = response.paging?.cursors?.after;
    } while (after);

    return allRatings;
  }

  normalizeRating(rating: FacebookRating, userId: string, sourceId: string, pageId: string): {
    userId: string;
    sourceId: string;
    platform: string;
    platformReviewId: string;
    reviewUrl: string | null;
    rating: number;
    content: string | null;
    reviewerName: string;
    reviewerAvatarUrl: string | null;
    reviewDate: Date;
    responseText: string | null;
    responseDate: Date | null;
    responseStatus: string;
  } {
    // Facebook uses recommendations now (positive/negative) but some pages still have star ratings
    let normalizedRating = 5; // Default to positive
    
    if (rating.rating) {
      normalizedRating = rating.rating;
    } else if (rating.recommendation_type === 'negative') {
      normalizedRating = 1;
    } else if (rating.recommendation_type === 'positive') {
      normalizedRating = 5;
    }

    return {
      userId,
      sourceId,
      platform: 'facebook',
      platformReviewId: rating.open_graph_story?.id || `${rating.reviewer.id}_${rating.created_time}`,
      reviewUrl: null, // Facebook doesn't provide direct review URLs
      rating: normalizedRating,
      content: rating.review_text || null,
      reviewerName: rating.reviewer?.name || 'Anonyme',
      reviewerAvatarUrl: null, // Need additional API call to get profile picture
      reviewDate: new Date(rating.created_time),
      responseText: null, // Facebook doesn't expose responses via API
      responseDate: null,
      responseStatus: 'none',
    };
  }
}

// OAuth 2.0 configuration
export const FACEBOOK_OAUTH_CONFIG = {
  appId: process.env.FACEBOOK_APP_ID || '',
  appSecret: process.env.FACEBOOK_APP_SECRET || '',
  scopes: [
    'pages_read_user_content',
    'pages_read_engagement',
    'pages_show_list',
  ],
  authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
};

export async function exchangeFacebookAuthCode(
  code: string, 
  redirectUri: string,
  appId?: string,
  appSecret?: string
): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  try {
    const url = new URL(FACEBOOK_OAUTH_CONFIG.tokenUrl);
    url.searchParams.set('client_id', appId || FACEBOOK_OAUTH_CONFIG.appId);
    url.searchParams.set('client_secret', appSecret || FACEBOOK_OAUTH_CONFIG.appSecret);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code', code);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      console.error('[FacebookPages] Token exchange error:', error);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 5184000, // Default 60 days
    };
  } catch (error) {
    console.error('[FacebookPages] Token exchange error:', error);
    return null;
  }
}

export async function getLongLivedToken(
  shortLivedToken: string,
  appId?: string,
  appSecret?: string
): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  try {
    const url = new URL(FACEBOOK_OAUTH_CONFIG.tokenUrl);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', appId || FACEBOOK_OAUTH_CONFIG.appId);
    url.searchParams.set('client_secret', appSecret || FACEBOOK_OAUTH_CONFIG.appSecret);
    url.searchParams.set('fb_exchange_token', shortLivedToken);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const error = await response.json();
      console.error('[FacebookPages] Long-lived token error:', error);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 5184000, // ~60 days
    };
  } catch (error) {
    console.error('[FacebookPages] Long-lived token error:', error);
    return null;
  }
}

export function generateFacebookOAuthUrl(redirectUri: string, state: string, appId?: string): string {
  const params = new URLSearchParams({
    client_id: appId || FACEBOOK_OAUTH_CONFIG.appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: FACEBOOK_OAUTH_CONFIG.scopes.join(','),
    state,
  });

  return `${FACEBOOK_OAUTH_CONFIG.authUrl}?${params.toString()}`;
}
