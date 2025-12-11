// Review Sync Cron Job - Daily synchronization of reviews from all platforms
import cron from 'node-cron';
import { syncAllReviewSources } from '../services/review-sync';

let isRunning = false;

export async function syncAllReviews() {
  if (isRunning) {
    console.log('[ReviewSyncCron] Sync already running, skipping...');
    return;
  }

  isRunning = true;
  console.log('[ReviewSyncCron] Starting review sync...');

  try {
    await syncAllReviewSources();
    console.log('[ReviewSyncCron] Sync completed successfully');
  } catch (error) {
    console.error('[ReviewSyncCron] Sync failed:', error);
    throw error;
  } finally {
    isRunning = false;
  }
}

export function startReviewSyncCron() {
  // Run daily at 4:00 AM Paris time (to avoid conflicts with other crons)
  // Format: second minute hour day month weekday
  cron.schedule('0 4 * * *', async () => {
    if (isRunning) {
      console.log('[ReviewSyncCron] Sync already running, skipping...');
      return;
    }

    isRunning = true;
    console.log('[ReviewSyncCron] Starting daily review sync...');

    try {
      await syncAllReviewSources();
      console.log('[ReviewSyncCron] Daily sync completed successfully');
    } catch (error) {
      console.error('[ReviewSyncCron] Daily sync failed:', error);
    } finally {
      isRunning = false;
    }
  }, {
    timezone: 'Europe/Paris'
  });

  console.log('[ReviewSyncCron] Cron job started - will run daily at 4:00 AM Paris time');
}
