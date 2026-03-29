import { createHmac, timingSafeEqual } from 'crypto';

export const CUSTOM_SESSION_COOKIE_NAME = 'rk_session';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionAuthMethod = 'otp';

export type CustomSessionPayload = {
  sub: string;
  email: string;
  name: string | null;
  amr: SessionAuthMethod;
  iat: number;
  exp: number;
};

function getSessionSecret() {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    null
  );
}

function sign(input: string, secret: string) {
  return createHmac('sha256', secret).update(input).digest('base64url');
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function createCustomSessionToken(input: {
  userId: string | number;
  email: string;
  name?: string | null;
  authMethod?: SessionAuthMethod;
}) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('Missing AUTH_SESSION_SECRET (or NEXTAUTH_SECRET/AUTH_SECRET) for custom sessions.');
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: CustomSessionPayload = {
    sub: String(input.userId),
    email: input.email.toLowerCase(),
    name: input.name ?? null,
    amr: input.authMethod ?? 'otp',
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
  };

  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url'
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(unsigned, secret);

  return `${unsigned}.${signature}`;
}

export function verifyCustomSessionToken(token: string | null | undefined): CustomSessionPayload | null {
  if (!token) {
    return null;
  }

  const secret = getSessionSecret();
  if (!secret) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(unsigned, secret);

  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  const decodedPayloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  const payload = safeJsonParse<CustomSessionPayload>(decodedPayloadJson);

  if (!payload || !payload.sub || !payload.email || !payload.exp || !payload.iat) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return null;
  }

  return payload;
}

export function getCustomSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
