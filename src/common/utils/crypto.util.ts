import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SEP = '.';

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32');
  }
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(SEP);
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(SEP);
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.split(SEP).length === 3 && value.split(SEP)[0].length === 32;
}

/**
 * Encrypt any value (string, number, or object) to a hex cipher string.
 */
export function encryptField(value: any): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return encrypt(str);
}

/**
 * Decrypt a field, converting back to the original type.
 * Falls back gracefully for legacy unencrypted documents.
 */
export function decryptField(value: any, asType?: 'number' | 'object'): any {
  if (value === null || value === undefined) return value;

  // Legacy unencrypted document — just type-coerce and return
  if (!isEncrypted(String(value))) {
    if (asType === 'number') return typeof value === 'number' ? value : Number(value);
    if (asType === 'object' && typeof value === 'string') {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  }

  try {
    const plain = decrypt(String(value));
    if (asType === 'number') return Number(plain);
    if (asType === 'object') return JSON.parse(plain);
    return plain;
  } catch {
    return value; // graceful fallback
  }
}
