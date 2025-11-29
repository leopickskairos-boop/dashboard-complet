// Reference: javascript_database blueprint
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
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

// Run diagnostic after a short delay to ensure connection is ready
setTimeout(runStartupDiagnostic, 2000);
