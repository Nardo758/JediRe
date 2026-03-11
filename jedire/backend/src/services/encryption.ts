import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const keyEnv = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required for token encryption. Set a 64-character hex string.');
  }
  let keyBuffer: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(keyEnv)) {
    keyBuffer = Buffer.from(keyEnv, 'hex');
  } else if (keyEnv.length === 32) {
    keyBuffer = Buffer.from(keyEnv, 'utf8');
  } else {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-character hex string or a 32-byte UTF-8 string (AES-256 requires exactly 32 bytes).');
  }
  if (keyBuffer.length !== 32) {
    throw new Error(`TOKEN_ENCRYPTION_KEY resolved to ${keyBuffer.length} bytes; AES-256 requires exactly 32 bytes.`);
  }
  return keyBuffer;
}

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!cachedKey) {
    cachedKey = getEncryptionKey();
  }
  return cachedKey;
}

export function encryptToken(token: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(encryptedToken: string): string {
  const key = getKey();
  const [ivHex, authTagHex, encryptedHex] = encryptedToken.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted token format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
