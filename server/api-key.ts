import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Generate a secure API key using cryptographically random bytes
 * Format: speedai_live_[64 hex characters] = 256 bits of entropy
 * 
 * Returns the plain text key (to show to user ONCE) and the hash (to store in DB)
 */
export async function generateApiKey(): Promise<{ apiKey: string; apiKeyHash: string }> {
  const randomBytes = crypto.randomBytes(32); // 32 bytes = 256 bits
  const hexString = randomBytes.toString('hex'); // 64 hex characters
  const apiKey = `speedai_live_${hexString}`;
  
  // Hash the API key with bcrypt (same as passwords)
  const apiKeyHash = await bcrypt.hash(apiKey, 10);
  
  return { apiKey, apiKeyHash };
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  // Must start with speedai_live_ and have exactly 64 hex characters after
  const pattern = /^speedai_live_[0-9a-f]{64}$/;
  return pattern.test(apiKey);
}

/**
 * Verify an API key against a stored hash
 */
export async function verifyApiKey(apiKey: string, apiKeyHash: string): Promise<boolean> {
  return bcrypt.compare(apiKey, apiKeyHash);
}
