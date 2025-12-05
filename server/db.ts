// Reference: javascript_database blueprint
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Check for DATABASE_URL with helpful error message for deployment
if (!process.env.DATABASE_URL) {
  console.error('❌ [DATABASE] DATABASE_URL environment variable is not set.');
  console.error('   For deployment, ensure DATABASE_URL is added to your deployment secrets.');
  console.error('   Navigate to: Deployments pane → Secrets tab → Add DATABASE_URL');
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database or configure deployment secrets?",
  );
}

// Log sanitized DATABASE_URL for debugging (host + database name only, no password)
function logSanitizedDatabaseUrl() {
  try {
    const url = new URL(process.env.DATABASE_URL!);
    console.log(`🔌 [DB CONNECTION] Host: ${url.hostname} | Database: ${url.pathname.slice(1)} | User: ${url.username}`);
  } catch (e) {
    console.log('🔌 [DB CONNECTION] Could not parse DATABASE_URL');
  }
}
logSanitizedDatabaseUrl();

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Schema guard: Ensure critical columns exist (auto-migration for production parity)
async function ensureSchemaConsistency() {
  try {
    console.log('🔧 [SCHEMA GUARD] Checking schema consistency...');
    
    // Check if calls.metadata column exists
    const metadataCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'calls' AND column_name = 'metadata'
    `);
    
    if (metadataCheck.rows.length === 0) {
      console.log('🔧 [SCHEMA GUARD] Adding missing column: calls.metadata (JSONB)');
      await pool.query(`ALTER TABLE calls ADD COLUMN IF NOT EXISTS metadata JSONB`);
      console.log('✅ [SCHEMA GUARD] Column calls.metadata added successfully');
    } else {
      console.log('✅ [SCHEMA GUARD] Column calls.metadata exists');
    }
    
    // Check if users.account_status column exists
    const accountStatusCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'account_status'
    `);
    
    if (accountStatusCheck.rows.length === 0) {
      console.log('🔧 [SCHEMA GUARD] Adding missing column: users.account_status');
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'trial'`);
      console.log('✅ [SCHEMA GUARD] Column users.account_status added successfully');
    } else {
      console.log('✅ [SCHEMA GUARD] Column users.account_status exists');
    }
    
    console.log('✅ [SCHEMA GUARD] Schema consistency check completed');
  } catch (e) {
    console.error('❌ [SCHEMA GUARD] Error ensuring schema consistency:', e);
  }
}

// Diagnostic query at startup to verify connection and data access
async function runStartupDiagnostic() {
  try {
    const result = await pool.query(`
      SELECT id, email, 
             CASE WHEN api_key_hash IS NOT NULL THEN 'HAS_HASH' ELSE 'NULL' END as hash_status,
             LEFT(api_key_hash, 20) as hash_preview
      FROM users 
      WHERE api_key_hash IS NOT NULL
      LIMIT 5
    `);
    console.log('🔍 [DB DIAGNOSTIC] Users with API keys:');
    result.rows.forEach((row: any) => {
      console.log(`   - ${row.email} | Status: ${row.hash_status} | Preview: ${row.hash_preview}...`);
    });
    if (result.rows.length === 0) {
      console.log('   ⚠️ No users with api_key_hash found in database!');
    }
  } catch (e) {
    console.error('❌ [DB DIAGNOSTIC] Error running startup query:', e);
  }
}

// Run schema guard first, then diagnostic
async function initializeDatabase() {
  await ensureSchemaConsistency();
  await runStartupDiagnostic();
}

// Run initialization after a short delay to ensure connection is ready
setTimeout(initializeDatabase, 2000);
