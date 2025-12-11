// Integration Sync Cron Job - Automatic synchronization of all active connections
import cron from 'node-cron';
import { storage } from '../storage';
import { integrationService } from '../integrations/integration-service';
import { isProviderSupported } from '../integrations/adapter-factory';

let isRunning = false;

async function syncAllActiveConnections() {
  console.log('[IntegrationSyncCron] Starting sync for all active connections...');
  
  // Get all users with active connections
  const connections = await storage.getAllActiveConnections();
  
  const stats = {
    total: connections.length,
    synced: 0,
    skipped: 0,
    failed: 0,
    customersImported: 0,
    ordersImported: 0,
    transactionsImported: 0
  };
  
  for (const connection of connections) {
    try {
      // Skip if provider not supported for real sync
      if (!isProviderSupported(connection.provider)) {
        console.log(`[IntegrationSyncCron] Skipping ${connection.name} - provider ${connection.provider} not yet supported`);
        stats.skipped++;
        continue;
      }
      
      // Check sync frequency
      const shouldSync = checkSyncSchedule(connection);
      if (!shouldSync) {
        console.log(`[IntegrationSyncCron] Skipping ${connection.name} - not scheduled for sync`);
        stats.skipped++;
        continue;
      }
      
      console.log(`[IntegrationSyncCron] Syncing ${connection.name} (${connection.provider})...`);
      
      const result = await integrationService.syncConnection(connection.id, connection.userId, false);
      
      if (result.success) {
        stats.synced++;
        stats.customersImported += result.customersImported;
        stats.ordersImported += result.ordersImported;
        stats.transactionsImported += result.transactionsImported;
        console.log(`[IntegrationSyncCron] Successfully synced ${connection.name}: ${result.customersImported} customers, ${result.ordersImported} orders, ${result.transactionsImported} transactions`);
      } else {
        stats.failed++;
        console.error(`[IntegrationSyncCron] Failed to sync ${connection.name}: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      stats.failed++;
      console.error(`[IntegrationSyncCron] Error syncing ${connection.name}:`, error);
    }
  }
  
  console.log(`[IntegrationSyncCron] Sync completed: ${stats.synced} synced, ${stats.skipped} skipped, ${stats.failed} failed`);
  console.log(`[IntegrationSyncCron] Total imported: ${stats.customersImported} customers, ${stats.ordersImported} orders, ${stats.transactionsImported} transactions`);
  
  return stats;
}

function checkSyncSchedule(connection: { syncFrequency: string | null; lastSyncAt: Date | null }): boolean {
  const frequency = connection.syncFrequency || 'daily';
  const lastSync = connection.lastSyncAt;
  
  if (!lastSync) {
    return true; // Never synced, should sync
  }
  
  const now = new Date();
  const timeSinceLastSync = now.getTime() - new Date(lastSync).getTime();
  
  switch (frequency) {
    case 'realtime':
      return true; // Always sync for realtime
    case 'hourly':
      return timeSinceLastSync >= 60 * 60 * 1000; // 1 hour
    case 'daily':
      return timeSinceLastSync >= 24 * 60 * 60 * 1000; // 24 hours
    case 'weekly':
      return timeSinceLastSync >= 7 * 24 * 60 * 60 * 1000; // 7 days
    case 'manual':
      return false; // Never auto-sync
    default:
      return timeSinceLastSync >= 24 * 60 * 60 * 1000; // Default to daily
  }
}

export function startIntegrationSyncCron() {
  // Run every hour at minute 15 to check for connections that need syncing
  // This allows hourly, daily, and weekly sync frequencies to work properly
  cron.schedule('15 * * * *', async () => {
    if (isRunning) {
      console.log('[IntegrationSyncCron] Sync already running, skipping...');
      return;
    }

    isRunning = true;
    console.log('[IntegrationSyncCron] Starting scheduled sync check...');

    try {
      await syncAllActiveConnections();
    } catch (error) {
      console.error('[IntegrationSyncCron] Scheduled sync failed:', error);
    } finally {
      isRunning = false;
    }
  }, {
    timezone: 'Europe/Paris'
  });

  console.log('[IntegrationSyncCron] Cron job started - will check for syncs every hour at :15');
}

// Export for manual trigger from API
export { syncAllActiveConnections };

// Alias for cron API routes
export async function runIntegrationSync() {
  if (isRunning) {
    console.log('[IntegrationSyncCron] Sync already running, skipping...');
    return { skipped: true };
  }

  isRunning = true;
  try {
    const result = await syncAllActiveConnections();
    return result;
  } finally {
    isRunning = false;
  }
}
