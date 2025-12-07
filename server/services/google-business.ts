// Google Business Profile API Integration
// API Documentation: https://developers.google.com/my-business/reference/rest

interface GoogleReview {
  name: string; // Review resource name (format: accounts/{account_id}/locations/{location_id}/reviews/{review_id})
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating: 'STAR_RATING_UNSPECIFIED' | 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

interface GoogleReviewsResponse {
  reviews: GoogleReview[];
  averageRating: number;
  totalReviewCount: number;
  nextPageToken?: string;
}

interface GoogleLocation {
  name: string;
  locationName: string;
  title: string;
  storefrontAddress: {
    regionCode: string;
    languageCode: string;
    postalCode: string;
    administrativeArea: string;
    locality: string;
    addressLines: string[];
  };
  websiteUri?: string;
  regularHours?: {
    periods: Array<{
      openDay: string;
      openTime: string;
      closeDay: string;
      closeTime: string;
    }>;
  };
  metadata?: {
    mapsUri: string;
    newReviewUri: string;
    placeId: string;
  };
}

interface GoogleAccount {
  name: string;
  accountName: string;
  type: string;
  role: string;
  state: {
    status: string;
  };
}

const STAR_RATING_MAP: Record<string, number> = {
  'ONE': 1,
  'TWO': 2,
  'THREE': 3,
  'FOUR': 4,
  'FIVE': 5,
  'STAR_RATING_UNSPECIFIED': 0,
};

export class GoogleBusinessService {
  private accessToken: string;
  private baseUrl = 'https://mybusinessbusinessinformation.googleapis.com/v1';
  private reviewsUrl = 'https://mybusiness.googleapis.com/v4';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest<T>(url: string, method: string = 'GET'): Promise<T> {
    console.log(`[GoogleBusiness] Fetching: ${url}`);

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GoogleBusiness] Error ${response.status}: ${error}`);
      
      if (response.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }
      
      throw new Error(`Google API error: ${response.status} - ${error}`);
    }

    return response.json() as T;
  }

  async listAccounts(): Promise<GoogleAccount[]> {
    try {
      const response = await this.makeRequest<{ accounts: GoogleAccount[] }>(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
      );
      return response.accounts || [];
    } catch (error) {
      console.error('[GoogleBusiness] List accounts error:', error);
      return [];
    }
  }

  async listLocations(accountName: string): Promise<GoogleLocation[]> {
    try {
      const response = await this.makeRequest<{ locations: GoogleLocation[] }>(
        `${this.baseUrl}/${accountName}/locations`
      );
      return response.locations || [];
    } catch (error) {
      console.error('[GoogleBusiness] List locations error:', error);
      return [];
    }
  }

  async getReviews(accountName: string, locationName: string, pageToken?: string): Promise<GoogleReviewsResponse> {
    try {
      let url = `${this.reviewsUrl}/${accountName}/${locationName}/reviews`;
      if (pageToken) {
        url += `?pageToken=${pageToken}`;
      }

      const response = await this.makeRequest<GoogleReviewsResponse>(url);
      return response;
    } catch (error) {
      console.error('[GoogleBusiness] Get reviews error:', error);
      return { reviews: [], averageRating: 0, totalReviewCount: 0 };
    }
  }

  async getAllReviews(accountName: string, locationName: string): Promise<GoogleReview[]> {
    const allReviews: GoogleReview[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.getReviews(accountName, locationName, pageToken);
      allReviews.push(...response.reviews);
      pageToken = response.nextPageToken;
    } while (pageToken);

    return allReviews;
  }

  normalizeReview(review: GoogleReview, userId: string, sourceId: string): {
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
    return {
      userId,
      sourceId,
      platform: 'google',
      platformReviewId: review.reviewId,
      reviewUrl: null, // Google doesn't provide direct review URLs
      rating: STAR_RATING_MAP[review.starRating] || 0,
      content: review.comment || null,
      reviewerName: review.reviewer?.displayName || 'Anonyme',
      reviewerAvatarUrl: review.reviewer?.profilePhotoUrl || null,
      reviewDate: new Date(review.createTime),
      responseText: review.reviewReply?.comment || null,
      responseDate: review.reviewReply?.updateTime 
        ? new Date(review.reviewReply.updateTime) 
        : null,
      responseStatus: review.reviewReply ? 'published' : 'none',
    };
  }
}

// OAuth 2.0 configuration
export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  scopes: [
    'https://www.googleapis.com/auth/business.manage',
  ],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
};

export async function exchangeGoogleAuthCode(code: string, redirectUri: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  try {
    const response = await fetch(GOOGLE_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GoogleBusiness] Token exchange error:', error);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error('[GoogleBusiness] Token exchange error:', error);
    return null;
  }
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  try {
    const response = await fetch(GOOGLE_OAUTH_CONFIG.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GoogleBusiness] Token refresh error:', error);
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error('[GoogleBusiness] Token refresh error:', error);
    return null;
  }
}

export function generateGoogleOAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_CONFIG.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${GOOGLE_OAUTH_CONFIG.authUrl}?${params.toString()}`;
}
