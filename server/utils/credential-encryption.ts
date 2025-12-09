import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!key) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY or SESSION_SECRET must be set for credential encryption');
  }
  return crypto.scryptSync(key, 'salt', KEY_LENGTH);
}

export function encryptCredential(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptCredential(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(':')) return encryptedData;
  
  try {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) {
      return encryptedData;
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt credential:', error);
    return encryptedData;
  }
}

export function isEncrypted(value: string | null): boolean {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3 && 
         parts[0].length === IV_LENGTH * 2 && 
         parts[1].length === AUTH_TAG_LENGTH * 2;
}

export function encryptCredentials(credentials: {
  accessToken?: string | null;
  refreshToken?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  dbPassword?: string | null;
  webhookSecret?: string | null;
}): typeof credentials {
  return {
    accessToken: credentials.accessToken ? encryptCredential(credentials.accessToken) : credentials.accessToken,
    refreshToken: credentials.refreshToken ? encryptCredential(credentials.refreshToken) : credentials.refreshToken,
    apiKey: credentials.apiKey ? encryptCredential(credentials.apiKey) : credentials.apiKey,
    apiSecret: credentials.apiSecret ? encryptCredential(credentials.apiSecret) : credentials.apiSecret,
    dbPassword: credentials.dbPassword ? encryptCredential(credentials.dbPassword) : credentials.dbPassword,
    webhookSecret: credentials.webhookSecret ? encryptCredential(credentials.webhookSecret) : credentials.webhookSecret,
  };
}

export function decryptCredentials(credentials: {
  accessToken?: string | null;
  refreshToken?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  dbPassword?: string | null;
  webhookSecret?: string | null;
}): typeof credentials {
  return {
    accessToken: credentials.accessToken ? decryptCredential(credentials.accessToken) : credentials.accessToken,
    refreshToken: credentials.refreshToken ? decryptCredential(credentials.refreshToken) : credentials.refreshToken,
    apiKey: credentials.apiKey ? decryptCredential(credentials.apiKey) : credentials.apiKey,
    apiSecret: credentials.apiSecret ? decryptCredential(credentials.apiSecret) : credentials.apiSecret,
    dbPassword: credentials.dbPassword ? decryptCredential(credentials.dbPassword) : credentials.dbPassword,
    webhookSecret: credentials.webhookSecret ? decryptCredential(credentials.webhookSecret) : credentials.webhookSecret,
  };
}
