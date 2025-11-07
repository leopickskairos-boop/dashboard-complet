import crypto from "crypto";

/**
 * Generate a secure API key using cryptographically random bytes
 * Format: speedai_live_[64 hex characters] = 256 bits of entropy
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32); // 32 bytes = 256 bits
  const hexString = randomBytes.toString('hex'); // 64 hex characters
  return `speedai_live_${hexString}`;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  // Must start with speedai_live_ and have exactly 64 hex characters after
  const pattern = /^speedai_live_[0-9a-f]{64}$/;
  return pattern.test(apiKey);
}
