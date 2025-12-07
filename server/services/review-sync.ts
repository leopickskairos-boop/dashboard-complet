// Review Sync Service - Fetches reviews from all connected platforms
import { storage } from '../storage';
import type { ReviewSource, InsertReview } from '@shared/schema';
import { TripAdvisorService, createTripAdvisorService } from './tripadvisor';
import { GoogleBusinessService, refreshGoogleAccessToken } from './google-business';
import { FacebookPagesService } from './facebook-pages';

export async function syncReviewSource(source: ReviewSource): Promise<{
  success: boolean;
  newCount: number;
  updatedCount: number;
  error?: string;
}> {
  console.log(`[ReviewSync] Starting sync for ${source.platform} source ${source.id}`);

  // Create sync log
  const syncLog = await storage.createSyncLog({
    sourceId: source.id,
    status: 'running',
    fetchedCount: 0,
    newCount: 0,
    updatedCount: 0,
  });

  try {
    let result: { newCount: number; updatedCount: number; fetchedCount: number };

    switch (source.platform) {
      case 'tripadvisor':
        result = await syncTripAdvisorReviews(source);
        break;
      case 'google':
        result = await syncGoogleReviews(source);
        break;
      case 'facebook':
        result = await syncFacebookReviews(source);
        break;
      default:
        throw new Error(`Unknown platform: ${source.platform}`);
    }

    // Update sync log as success
    await storage.updateSyncLog(syncLog.id, {
      status: 'success',
      completedAt: new Date(),
      fetchedCount: result.fetchedCount,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
    });

    // Update source last sync
    await storage.updateReviewSource(source.id, source.userId, {
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
      lastSyncError: null,
    });

    console.log(`✅ [ReviewSync] ${source.platform} sync completed: ${result.newCount} new, ${result.updatedCount} updated`);

    return {
      success: true,
      newCount: result.newCount,
      updatedCount: result.updatedCount,
    };

  } catch (error: any) {
    console.error(`[ReviewSync] Error syncing ${source.platform}:`, error);

    // Update sync log as error
    await storage.updateSyncLog(syncLog.id, {
      status: 'error',
      completedAt: new Date(),
      errorMessage: error.message,
    });

    // Update source with error
    await storage.updateReviewSource(source.id, source.userId, {
      lastSyncAt: new Date(),
      lastSyncStatus: 'error',
      lastSyncError: error.message,
    });

    return {
      success: false,
      newCount: 0,
      updatedCount: 0,
      error: error.message,
    };
  }
}

async function syncTripAdvisorReviews(source: ReviewSource): Promise<{
  fetchedCount: number;
  newCount: number;
  updatedCount: number;
}> {
  const taService = createTripAdvisorService();
  
  if (!taService) {
    throw new Error('TripAdvisor service not configured');
  }

  if (!source.platformLocationId) {
    throw new Error('No location ID configured');
  }

  const reviews = await taService.getReviews(source.platformLocationId);

  let newCount = 0;
  let updatedCount = 0;

  for (const review of reviews) {
    const normalized = taService.normalizeReview(review, source.userId, source.id);
    
    // Check if review already exists
    const existing = await storage.getReviewByPlatformId(normalized.platformReviewId, 'tripadvisor');
    
    const reviewData: InsertReview = {
      userId: normalized.userId,
      sourceId: normalized.sourceId,
      platform: normalized.platform,
      platformReviewId: normalized.platformReviewId,
      reviewUrl: normalized.reviewUrl,
      rating: normalized.rating,
      content: normalized.content,
      reviewerName: normalized.reviewerName,
      reviewerAvatarUrl: normalized.reviewerAvatarUrl,
      reviewDate: normalized.reviewDate,
      responseText: normalized.responseText,
      responseDate: normalized.responseDate,
      responseStatus: normalized.responseStatus,
    };

    if (existing) {
      await storage.updateReview(existing.id, source.userId, reviewData);
      updatedCount++;
    } else {
      await storage.createReview(reviewData);
      newCount++;
    }
  }

  return {
    fetchedCount: reviews.length,
    newCount,
    updatedCount,
  };
}

async function syncGoogleReviews(source: ReviewSource): Promise<{
  fetchedCount: number;
  newCount: number;
  updatedCount: number;
}> {
  if (!source.accessToken) {
    throw new Error('No access token');
  }

  // Check if token needs refresh
  let accessToken = source.accessToken;
  
  if (source.tokenExpiry && new Date(source.tokenExpiry) < new Date()) {
    if (!source.refreshToken) {
      throw new Error('Token expired and no refresh token available');
    }

    const refreshed = await refreshGoogleAccessToken(source.refreshToken);
    if (!refreshed) {
      throw new Error('Failed to refresh token');
    }

    accessToken = refreshed.accessToken;
    
    // Update stored token
    await storage.updateReviewSource(source.id, source.userId, {
      accessToken: refreshed.accessToken,
      tokenExpiry: new Date(Date.now() + refreshed.expiresIn * 1000),
    });
  }

  const service = new GoogleBusinessService(accessToken);
  const metadata = source.metadata as { accountName?: string; locationName?: string } | null;
  
  if (!metadata?.accountName || !metadata?.locationName) {
    throw new Error('Missing account/location metadata');
  }

  const reviews = await service.getAllReviews(metadata.accountName, metadata.locationName);

  let newCount = 0;
  let updatedCount = 0;

  for (const review of reviews) {
    const normalized = service.normalizeReview(review, source.userId, source.id);
    
    const existing = await storage.getReviewByPlatformId(normalized.platformReviewId, 'google');
    
    const reviewData: InsertReview = {
      userId: normalized.userId,
      sourceId: normalized.sourceId,
      platform: normalized.platform,
      platformReviewId: normalized.platformReviewId,
      reviewUrl: normalized.reviewUrl,
      rating: normalized.rating,
      content: normalized.content,
      reviewerName: normalized.reviewerName,
      reviewerAvatarUrl: normalized.reviewerAvatarUrl,
      reviewDate: normalized.reviewDate,
      responseText: normalized.responseText,
      responseDate: normalized.responseDate,
      responseStatus: normalized.responseStatus,
    };

    if (existing) {
      await storage.updateReview(existing.id, source.userId, reviewData);
      updatedCount++;
    } else {
      await storage.createReview(reviewData);
      newCount++;
    }
  }

  return {
    fetchedCount: reviews.length,
    newCount,
    updatedCount,
  };
}

async function syncFacebookReviews(source: ReviewSource): Promise<{
  fetchedCount: number;
  newCount: number;
  updatedCount: number;
}> {
  if (!source.accessToken) {
    throw new Error('No access token');
  }

  if (!source.platformLocationId) {
    throw new Error('No page ID configured');
  }

  // Facebook page tokens are long-lived, but check expiry
  if (source.tokenExpiry && new Date(source.tokenExpiry) < new Date()) {
    throw new Error('Page token expired - reconnect required');
  }

  const service = new FacebookPagesService(source.accessToken);
  const ratings = await service.getAllPageRatings(source.platformLocationId, source.accessToken);

  let newCount = 0;
  let updatedCount = 0;

  for (const rating of ratings) {
    // Skip ratings without review text
    if (!rating.has_review && !rating.review_text) {
      continue;
    }

    const normalized = service.normalizeRating(rating, source.userId, source.id, source.platformLocationId);
    
    const existing = await storage.getReviewByPlatformId(normalized.platformReviewId, 'facebook');
    
    const reviewData: InsertReview = {
      userId: normalized.userId,
      sourceId: normalized.sourceId,
      platform: normalized.platform,
      platformReviewId: normalized.platformReviewId,
      reviewUrl: normalized.reviewUrl,
      rating: normalized.rating,
      content: normalized.content,
      reviewerName: normalized.reviewerName,
      reviewerAvatarUrl: normalized.reviewerAvatarUrl,
      reviewDate: normalized.reviewDate,
      responseText: normalized.responseText,
      responseDate: normalized.responseDate,
      responseStatus: normalized.responseStatus,
    };

    if (existing) {
      await storage.updateReview(existing.id, source.userId, reviewData);
      updatedCount++;
    } else {
      await storage.createReview(reviewData);
      newCount++;
    }
  }

  return {
    fetchedCount: ratings.length,
    newCount,
    updatedCount,
  };
}

// Sync all connected sources for all users (called by cron)
export async function syncAllReviewSources(): Promise<void> {
  console.log('[ReviewSync] Starting daily sync for all sources...');

  const sources = await storage.getAllConnectedSources();
  console.log(`[ReviewSync] Found ${sources.length} connected sources to sync`);

  for (const source of sources) {
    try {
      await syncReviewSource(source);
    } catch (error) {
      console.error(`[ReviewSync] Failed to sync source ${source.id}:`, error);
    }
    
    // Add small delay between sources to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('[ReviewSync] Daily sync completed');
}
