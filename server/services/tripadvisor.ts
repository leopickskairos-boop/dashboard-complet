// TripAdvisor Content API Integration
// API Documentation: https://tripadvisor-content-api.readme.io/reference/overview

interface TripAdvisorReview {
  id: string;
  lang: string;
  location_id: string;
  published_date: string;
  rating: number;
  helpful_votes: string;
  rating_image_url: string;
  url: string;
  trip_type: string;
  travel_date: string;
  text: string;
  title: string;
  owner_response?: {
    id: string;
    title: string;
    text: string;
    lang: string;
    author: string;
    published_date: string;
  };
  is_machine_translated: boolean;
  user: {
    user_id: string;
    member_id: string;
    type: string;
    username: string;
    user_location?: {
      name: string;
      id: string;
    };
    avatar?: {
      small: string;
      medium: string;
      large: string;
    };
    link: string;
  };
  subratings?: Record<string, {
    name: string;
    rating_image_url: string;
    value: number;
    localized_name: string;
  }>;
}

interface TripAdvisorLocationDetails {
  location_id: string;
  name: string;
  description: string;
  web_url: string;
  address_obj: {
    street1: string;
    street2: string;
    city: string;
    state: string;
    country: string;
    postalcode: string;
    address_string: string;
  };
  ancestors: Array<{
    level: string;
    name: string;
    location_id: string;
  }>;
  latitude: string;
  longitude: string;
  timezone: string;
  phone: string;
  website: string;
  email: string;
  category: {
    key: string;
    name: string;
  };
  subcategory: Array<{
    key: string;
    name: string;
  }>;
  rating: string;
  rating_image_url: string;
  num_reviews: string;
  review_rating_count: {
    "1": string;
    "2": string;
    "3": string;
    "4": string;
    "5": string;
  };
  photo_count: string;
  see_all_photos: string;
  hours: {
    periods: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
    weekday_text: string[];
  };
  features: string[];
  cuisine: Array<{
    key: string;
    name: string;
  }>;
  price_level: string;
  ranking_data: {
    geo_location_id: string;
    ranking_string: string;
    geo_location_name: string;
    ranking_out_of: string;
    ranking: string;
  };
  awards: Array<{
    award_type: string;
    year: string;
    images: {
      small: string;
      large: string;
    };
    categories: string[];
    display_name: string;
  }>;
}

interface TripAdvisorSearchResult {
  location_id: string;
  name: string;
  distance: string;
  rating: string;
  bearing: string;
  address_obj: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalcode?: string;
    address_string?: string;
  };
}

interface TripAdvisorReviewsResponse {
  data: TripAdvisorReview[];
}

interface TripAdvisorSearchResponse {
  data: TripAdvisorSearchResult[];
}

interface TripAdvisorLocationResponse {
  data?: TripAdvisorLocationDetails;
  error?: {
    code: number;
    message: string;
  };
}

export class TripAdvisorService {
  private apiKey: string;
  private baseUrl = 'https://api.content.tripadvisor.com/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set('key', this.apiKey);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    console.log(`[TripAdvisor] Fetching: ${url.toString().replace(this.apiKey, '***')}`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[TripAdvisor] Error ${response.status}: ${error}`);
      throw new Error(`TripAdvisor API error: ${response.status} - ${error}`);
    }

    return response.json() as T;
  }

  async searchLocation(query: string, category: string = 'restaurants'): Promise<TripAdvisorSearchResult[]> {
    try {
      const response = await this.makeRequest<TripAdvisorSearchResponse>('/location/search', {
        searchQuery: query,
        category: category,
        language: 'fr',
      });
      return response.data || [];
    } catch (error) {
      console.error('[TripAdvisor] Search error:', error);
      return [];
    }
  }

  async getLocationDetails(locationId: string): Promise<TripAdvisorLocationDetails | null> {
    try {
      const response = await this.makeRequest<TripAdvisorLocationResponse>(`/location/${locationId}/details`, {
        language: 'fr',
        currency: 'EUR',
      });
      return response.data || null;
    } catch (error) {
      console.error('[TripAdvisor] Location details error:', error);
      return null;
    }
  }

  async getReviews(locationId: string, language: string = 'fr'): Promise<TripAdvisorReview[]> {
    try {
      const response = await this.makeRequest<TripAdvisorReviewsResponse>(`/location/${locationId}/reviews`, {
        language: language,
      });
      return response.data || [];
    } catch (error) {
      console.error('[TripAdvisor] Reviews error:', error);
      return [];
    }
  }

  extractLocationIdFromUrl(url: string): string | null {
    // Extract location ID from TripAdvisor URL
    // Examples:
    // https://www.tripadvisor.fr/Restaurant_Review-g187147-d15626754-Reviews-...
    // https://www.tripadvisor.com/Restaurant_Review-g187147-d15626754-...
    // https://www.tripadvisor.fr/Attraction_Review-g187147-d15626754-...
    // https://www.tripadvisor.fr/Hotel_Review-g187147-d15626754-...
    
    const patterns = [
      /[Rr]estaurant_[Rr]eview-g\d+-d(\d+)/,
      /[Hh]otel_[Rr]eview-g\d+-d(\d+)/,
      /[Aa]ttraction_[Rr]eview-g\d+-d(\d+)/,
      /[Ss]how[Uu]ser[Rr]eviews-g\d+-d(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  normalizeReview(review: TripAdvisorReview, userId: string, sourceId: string): {
    userId: string;
    sourceId: string;
    platform: string;
    platformReviewId: string;
    reviewUrl: string;
    rating: number;
    content: string;
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
      platform: 'tripadvisor',
      platformReviewId: review.id,
      reviewUrl: review.url,
      rating: review.rating,
      content: review.title ? `${review.title}\n\n${review.text}` : review.text,
      reviewerName: review.user?.username || 'Anonyme',
      reviewerAvatarUrl: review.user?.avatar?.medium || null,
      reviewDate: new Date(review.published_date),
      responseText: review.owner_response?.text || null,
      responseDate: review.owner_response?.published_date 
        ? new Date(review.owner_response.published_date) 
        : null,
      responseStatus: review.owner_response ? 'published' : 'none',
    };
  }
}

export function createTripAdvisorService(): TripAdvisorService | null {
  const apiKey = process.env.TRIPADVISOR_API_KEY;
  
  if (!apiKey) {
    console.warn('[TripAdvisor] API key not configured (TRIPADVISOR_API_KEY)');
    return null;
  }

  return new TripAdvisorService(apiKey);
}
