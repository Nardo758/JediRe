/**
 * Gmail Token Encryption — AES-256-GCM application-layer encryption
 *
 * Protects access_token and refresh_token at rest in user_email_accounts.
 * A database breach yields ciphertext only; the key lives exclusively in the
 * GMAIL_TOKEN_ENCRYPTION_KEY environment secret.
 *
 * Storage format:  enc:v1:<base64(12-byte IV | 16-byte GCM auth-tag | ciphertext)>
 *
 * Backward compatibility: values that do NOT start with "enc:v1:" are treated
 * as legacy plaintext and returned unchanged by decryptToken(). This allows a
 * safe rolling migration without a forced downtime window.
 *
 * Key requirement: GMAIL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte
 * (256-bit) secret. Generate with:
 *   node -e "require('crypto').randomBytes(32).toString('base64') |> console.log"
 * or:
 *   openssl rand -base64 32
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { logger } from '../../utils/logger';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 12;   // 96-bit IV — recommended for GCM
const TAG_BYTES = 16;  // 128-bit authentication tag
const ENC_PREFIX = 'enc:v1:';

/**
 * Derive the 32-byte key from GMAIL_TOKEN_ENCRYPTION_KEY.
 * Throws if the env var is absent or the key is the wrong length.
 */
function getKey(): Buffer {
  const raw = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'GMAIL_TOKEN_ENCRYPTION_KEY is not set. ' +
      'Generate with: openssl rand -base64 32'
    );
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(
      `GMAIL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes; got ${buf.length}. ` +
      'Re-generate with: openssl rand -base64 32'
    );
  }
  return buf;
}

/**
 * Encrypt a plaintext token. Returns a self-describing ciphertext string.
 * Throws if GMAIL_TOKEN_ENCRYPTION_KEY is not configured.
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Concatenate IV + auth-tag + ciphertext → single base64 blob
  const payload = Buffer.concat([iv, tag, encrypted]);
  return ENC_PREFIX + payload.toString('base64');
}

/**
 * Decrypt a token previously encrypted by encryptToken().
 *
 * Plaintext fallback: values without the enc:v1: prefix are returned as-is.
 * This allows the system to handle legacy rows safely during a rolling migration.
 *
 * Throws on authentication failure (tampered ciphertext).
 */
export function decryptToken(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) {
    // Legacy plaintext row — return unchanged
    return value;
  }
  const key = getKey();
  const payload = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
  const iv = payload.subarray(0, IV_BYTES);
  const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = payload.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/**
 * Returns true if the value is already encrypted with our scheme.
 * Useful for idempotent re-encryption scripts.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

/**
 * Decrypt a nullable token field — returns null unchanged.
 */
export function decryptTokenOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  return decryptToken(value);
}

/**
 * Encrypt a nullable token field — returns null unchanged.
 */
export function encryptTokenOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  return encryptToken(value);
}

/**
 * Verify that the encryption key is properly configured.
 * Call at startup to fail fast rather than at first token write.
 */
export function verifyEncryptionKey(): void {
  try {
    getKey();
    logger.info('[TokenEncryption] GMAIL_TOKEN_ENCRYPTION_KEY is configured and valid');
  } catch (err: any) {
    logger.warn(`[TokenEncryption] ${err.message} — Gmail token encryption disabled until key is set`);
  }
}

/**
 * Returns true if encryption is available (key is configured).
 * When false, encrypt/decrypt calls will throw.
 */
export function isEncryptionAvailable(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe encrypt: only encrypts if key is configured; otherwise returns plaintext.
 * Use for writes where we want to encrypt when possible but not crash if key is absent.
 */
export function safeEncryptToken(value: string): string {
  if (!isEncryptionAvailable()) return value;
  return encryptToken(value);
}

/**
 * Safe decrypt: only decrypts if key is configured and value is encrypted;
 * otherwise returns plaintext. Handles the startup race where key may not
 * be set yet.
 */
export function safeDecryptToken(value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value;
  if (!isEncryptionAvailable()) {
    logger.warn('[TokenEncryption] Encrypted token found but key not configured — token unusable');
    return value; // will fail at OAuth, not silently
  }
  return decryptToken(value);
}
