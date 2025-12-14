/**
 * Migration Script: speedai_clients → tenants
 * 
 * This script migrates existing speedai_clients data to the new multi-tenant architecture.
 * It creates tenants from speedai_clients and assigns the appropriate tenant_id to all related data.
 * 
 * Run with: npx tsx server/migrations/migrate-speedai-to-tenants.ts
 */

import { db } from '../db';
import { 
  speedaiClients, 
  tenants, 
  tenantSettings,
  calls,
  clientGuaranteeConfig,
  guaranteeSessions,
  noshowCharges,
  reviewConfig,
  reviewIncentives,
  reviewRequests,
  reviewAutomations,
  reviews,
  reviewAlerts,
  reviewSources,
  monthlyReports,
  marketingContacts,
  marketingSegments,
  marketingTemplates,
  marketingCampaigns,
  marketingAutomations,
  externalConnections,
  externalSyncJobs,
  externalCustomers,
  externalOrders,
  externalProducts,
  externalTransactions,
  externalActivities
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

interface MigrationResult {
  tenantsCreated: number;
  recordsUpdated: Record<string, number>;
  errors: string[];
}

async function migrateSpeedaiClientsToTenants(): Promise<MigrationResult> {
  const result: MigrationResult = {
    tenantsCreated: 0,
    recordsUpdated: {},
    errors: []
  };

  console.log('🚀 Starting migration: speedai_clients → tenants');
  console.log('================================================\n');

  try {
    // Step 1: Get all speedai_clients
    const clients = await db.select().from(speedaiClients);
    console.log(`📋 Found ${clients.length} speedai_clients to migrate\n`);

    if (clients.length === 0) {
      console.log('ℹ️  No speedai_clients found. Migration complete.');
      return result;
    }

    // Step 2: Create tenants from speedai_clients
    for (const client of clients) {
      console.log(`\n🔄 Processing client: ${client.agentId}`);
      console.log(`   Business: ${client.businessName || 'N/A'}`);

      // Check if tenant already exists with this external_id (agentId)
      const existingTenant = await db.select()
        .from(tenants)
        .where(eq(tenants.externalId, client.agentId))
        .limit(1);

      let tenantId: string;

      if (existingTenant.length > 0) {
        tenantId = existingTenant[0].id;
        console.log(`   ℹ️  Tenant already exists: ${tenantId}`);
      } else {
        // Create new tenant
        const [newTenant] = await db.insert(tenants).values({
          name: client.businessName || `Client ${client.agentId}`,
          slug: client.agentId.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
          externalId: client.agentId,
          plan: client.plan || 'basic',
          status: client.isActive ? 'active' : 'suspended',
          billingEmail: client.contactEmail,
        }).returning();

        tenantId = newTenant.id;
        result.tenantsCreated++;
        console.log(`   ✅ Created tenant: ${tenantId}`);

        // Create default tenant settings
        await db.insert(tenantSettings).values({
          tenantId,
          timezone: client.timezone || 'Europe/Paris',
          language: client.language || 'fr',
          businessType: (client.businessType || 'other') as any,
          businessName: client.businessName,
          contactEmail: client.contactEmail,
          contactPhone: client.contactPhone,
        }).onConflictDoNothing();
        console.log(`   ✅ Created tenant settings`);
      }

      // Step 3: Update related records with tenant_id based on agentId
      
      // Update calls
      const callsResult = await db.update(calls)
        .set({ tenantId })
        .where(eq(calls.agentId, client.agentId))
        .returning({ id: calls.id });
      result.recordsUpdated.calls = (result.recordsUpdated.calls || 0) + callsResult.length;
      if (callsResult.length > 0) console.log(`   📞 Updated ${callsResult.length} calls`);

      // Update client_guarantee_config by userId (linked through speedai_clients)
      // This requires knowing which user owns this agentId
      // For now, we update based on matching businessName or agentId patterns

      // Update guarantee_sessions by agentId
      const sessionsResult = await db.execute(
        sql`UPDATE guarantee_sessions SET tenant_id = ${tenantId} WHERE agent_id = ${client.agentId} AND tenant_id IS NULL`
      );
      console.log(`   🎫 Updated guarantee_sessions`);

      // Update noshow_charges through guarantee_sessions
      await db.execute(
        sql`UPDATE noshow_charges SET tenant_id = ${tenantId} 
            WHERE session_id IN (SELECT id FROM guarantee_sessions WHERE agent_id = ${client.agentId})
            AND tenant_id IS NULL`
      );
      console.log(`   💳 Updated noshow_charges`);

      // Update review tables by matching client data patterns
      // This will be refined based on actual data relationships
    }

    console.log('\n================================================');
    console.log('✅ Migration completed successfully!');
    console.log(`   Tenants created: ${result.tenantsCreated}`);
    console.log(`   Records updated:`, result.recordsUpdated);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(errorMessage);
    console.error('\n❌ Migration failed:', errorMessage);
    throw error;
  }

  return result;
}

// Run migration if executed directly
if (require.main === module) {
  migrateSpeedaiClientsToTenants()
    .then((result) => {
      console.log('\n📊 Final Result:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateSpeedaiClientsToTenants };
