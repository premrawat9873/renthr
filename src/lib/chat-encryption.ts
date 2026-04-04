import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTION_PREFIX = 'enc_v1';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_IV_BYTES = 12;

let cachedEncryptionKey: Buffer | null | undefined;

function getMessageEncryptionSecret() {
  return (
    process.env.MESSAGE_ENCRYPTION_SECRET ||
    process.env.CHAT_ENCRYPTION_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.OTP_SECRET ||
    null
  );
}

function resolveEncryptionKey(strict: boolean) {
  if (cachedEncryptionKey !== undefined) {
    if (strict && !cachedEncryptionKey) {
      throw new Error(
        'Missing MESSAGE_ENCRYPTION_SECRET (or CHAT_ENCRYPTION_SECRET/AUTH_SESSION_SECRET/NEXTAUTH_SECRET/AUTH_SECRET/OTP_SECRET).'
      );
    }

    return cachedEncryptionKey;
  }

  const secret = getMessageEncryptionSecret();
  if (!secret) {
    cachedEncryptionKey = null;
    if (strict) {
      throw new Error(
        'Missing MESSAGE_ENCRYPTION_SECRET (or CHAT_ENCRYPTION_SECRET/AUTH_SESSION_SECRET/NEXTAUTH_SECRET/AUTH_SECRET/OTP_SECRET).'
      );
    }

    return null;
  }

  cachedEncryptionKey = createHash('sha256').update(secret).digest();
  return cachedEncryptionKey;
}

function parseEncryptedPayload(value: string) {
  const parts = value.split(':');
  if (parts.length !== 4) {
    return null;
  }

  const [prefix, ivPart, tagPart, payloadPart] = parts;
  if (prefix !== ENCRYPTION_PREFIX || !ivPart || !tagPart || !payloadPart) {
    return null;
  }

  try {
    const iv = Buffer.from(ivPart, 'base64url');
    const tag = Buffer.from(tagPart, 'base64url');
    const payload = Buffer.from(payloadPart, 'base64url');

    if (iv.length !== ENCRYPTION_IV_BYTES || tag.length !== 16 || payload.length === 0) {
      return null;
    }

    return { iv, tag, payload };
  } catch {
    return null;
  }
}

export function encryptChatMessageContent(value: string) {
  if (!value) {
    return '';
  }

  const key = resolveEncryptionKey(true);
  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptChatMessageContent(value: string) {
  if (!value) {
    return '';
  }

  const encryptedPayload = parseEncryptedPayload(value);
  if (!encryptedPayload) {
    return value;
  }

  const key = resolveEncryptionKey(false);
  if (!key) {
    console.error('[chat] Unable to decrypt message content because encryption secret is missing.');
    return '';
  }

  try {
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, encryptedPayload.iv);

    decipher.setAuthTag(encryptedPayload.tag);

    const decrypted = Buffer.concat([
      decipher.update(encryptedPayload.payload),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    console.error('[chat] Unable to decrypt message content because payload format is invalid.');
    return '';
  }
}
