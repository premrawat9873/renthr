import { compactVerify, createRemoteJWKSet } from 'jose';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type JsonRecord = Record<string, unknown>;

type RiscConfig = {
  issuer: string;
  jwks_uri: string;
};

type RiscClaims = {
  iss: string;
  aud: string | string[];
  iat?: number;
  jti: string;
  events: Record<string, { subject?: { sub?: string }; reason?: string }>;
};

const RISC_CONFIG_URL = 'https://accounts.google.com/.well-known/risc-configuration';

let cachedRiscConfig: RiscConfig | null = null;
let cachedRiscConfigAt = 0;
const RISC_CONFIG_TTL_MS = 10 * 60 * 1000;

function toStringList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function getExpectedAudiences() {
  const fromList = toStringList(process.env.GOOGLE_CLIENT_IDS);
  const fromPrimary = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.AUTH_GOOGLE_ID,
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  return Array.from(new Set([...fromPrimary, ...fromList]));
}

function normalizeIssuer(issuer: string) {
  return issuer.endsWith('/') ? issuer.slice(0, -1) : issuer;
}

async function getRiscConfig(): Promise<RiscConfig> {
  const now = Date.now();
  if (cachedRiscConfig && now - cachedRiscConfigAt < RISC_CONFIG_TTL_MS) {
    return cachedRiscConfig;
  }

  const response = await fetch(RISC_CONFIG_URL, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to load RISC configuration document.');
  }

  const payload = (await response.json()) as Partial<RiscConfig>;
  if (!payload.issuer || !payload.jwks_uri) {
    throw new Error('RISC configuration document is missing required fields.');
  }

  cachedRiscConfig = {
    issuer: payload.issuer,
    jwks_uri: payload.jwks_uri,
  };
  cachedRiscConfigAt = now;

  return cachedRiscConfig;
}

function parseIncomingToken(rawBody: string, contentTypeHeader: string | null) {
  const trimmedBody = rawBody.trim();
  if (!trimmedBody) {
    return null;
  }

  const isJsonBody = (contentTypeHeader || '').toLowerCase().includes('application/json');

  if (isJsonBody) {
    try {
      const parsed = JSON.parse(trimmedBody) as JsonRecord;
      const fromSecurityEventToken = parsed.security_event_token;
      if (typeof fromSecurityEventToken === 'string' && fromSecurityEventToken.trim().length > 0) {
        return fromSecurityEventToken.trim();
      }

      const fromToken = parsed.token;
      if (typeof fromToken === 'string' && fromToken.trim().length > 0) {
        return fromToken.trim();
      }

      const fromJwt = parsed.jwt;
      if (typeof fromJwt === 'string' && fromJwt.trim().length > 0) {
        return fromJwt.trim();
      }
    } catch {
      return null;
    }

    return null;
  }

  if (trimmedBody.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmedBody) as JsonRecord;
      const fromSecurityEventToken = parsed.security_event_token;
      if (typeof fromSecurityEventToken === 'string' && fromSecurityEventToken.trim().length > 0) {
        return fromSecurityEventToken.trim();
      }
    } catch {
      // Fall back to raw body handling.
    }
  }

  return trimmedBody;
}

function parseClaims(payloadBytes: Uint8Array): RiscClaims | null {
  try {
    const text = new TextDecoder().decode(payloadBytes);
    const parsed = JSON.parse(text) as Partial<RiscClaims>;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (typeof parsed.iss !== 'string' || !parsed.iss) {
      return null;
    }

    const audience = parsed.aud;
    const hasAudience =
      typeof audience === 'string' ||
      (Array.isArray(audience) && audience.every((item) => typeof item === 'string'));

    if (!hasAudience) {
      return null;
    }

    if (typeof parsed.jti !== 'string' || parsed.jti.trim().length === 0) {
      return null;
    }

    if (!parsed.events || typeof parsed.events !== 'object' || Array.isArray(parsed.events)) {
      return null;
    }

    return parsed as RiscClaims;
  } catch {
    return null;
  }
}

function resolveAudienceValues(aud: string | string[]) {
  return Array.isArray(aud) ? aud : [aud];
}

function resolveSubject(events: RiscClaims['events']) {
  for (const eventData of Object.values(events)) {
    const subject = eventData?.subject?.sub;
    if (typeof subject === 'string' && subject.trim().length > 0) {
      return subject.trim();
    }
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const token = parseIncomingToken(rawBody, request.headers.get('content-type'));

    if (!token) {
      return NextResponse.json(
        { error: 'Missing security event token in request body.' },
        { status: 400 }
      );
    }

    const expectedAudiences = getExpectedAudiences();
    if (expectedAudiences.length === 0) {
      return NextResponse.json(
        { error: 'Server is missing GOOGLE_CLIENT_ID (or GOOGLE_CLIENT_IDS) configuration.' },
        { status: 500 }
      );
    }

    const riscConfig = await getRiscConfig();
    const jwks = createRemoteJWKSet(new URL(riscConfig.jwks_uri));

    const verification = await compactVerify(token, jwks);
    const claims = parseClaims(verification.payload);

    if (!claims) {
      return NextResponse.json(
        { error: 'Security event token payload is invalid.' },
        { status: 400 }
      );
    }

    if (normalizeIssuer(claims.iss) !== normalizeIssuer(riscConfig.issuer)) {
      return NextResponse.json({ error: 'Invalid issuer claim.' }, { status: 400 });
    }

    const tokenAudiences = resolveAudienceValues(claims.aud);
    const audienceMatched = tokenAudiences.some((aud) => expectedAudiences.includes(aud));

    if (!audienceMatched) {
      return NextResponse.json({ error: 'Invalid audience claim.' }, { status: 400 });
    }

    const eventTypes = Object.keys(claims.events);
    if (eventTypes.length === 0) {
      return NextResponse.json({ error: 'No events found in token.' }, { status: 400 });
    }

    const subject = resolveSubject(claims.events);
    const linkedIdentity = subject
      ? await prisma.googleIdentity.findUnique({
          where: { subject },
          select: { userId: true },
        })
      : null;

    const userId = linkedIdentity?.userId ?? null;
    const audienceForStorage = resolveAudienceValues(claims.aud).join(',');

    try {
      await prisma.riscEvent.create({
        data: {
          jti: claims.jti,
          issuer: claims.iss,
          audience: audienceForStorage,
          subject,
          eventTypes,
          userId,
        },
      });
    } catch {
      // Duplicate JTI means this event was already processed or recorded.
      return new NextResponse(null, { status: 202 });
    }

    if (userId) {
      let shouldRevokeSessions = false;
      let shouldDisableGoogleSignIn: boolean | null = null;

      for (const [eventType, eventData] of Object.entries(claims.events)) {
        if (
          eventType ===
            'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked' ||
          eventType === 'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked'
        ) {
          shouldRevokeSessions = true;
          continue;
        }

        if (eventType === 'https://schemas.openid.net/secevent/risc/event-type/account-disabled') {
          const reason = typeof eventData?.reason === 'string' ? eventData.reason : '';
          if (reason === 'hijacking') {
            shouldRevokeSessions = true;
          } else if (!reason) {
            shouldDisableGoogleSignIn = true;
          }
          continue;
        }

        if (eventType === 'https://schemas.openid.net/secevent/risc/event-type/account-enabled') {
          shouldDisableGoogleSignIn = false;
        }
      }

      if (shouldRevokeSessions || shouldDisableGoogleSignIn !== null) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            sessionRevokedAt: shouldRevokeSessions ? new Date() : undefined,
            googleSignInDisabledAt:
              shouldDisableGoogleSignIn === null
                ? undefined
                : shouldDisableGoogleSignIn
                ? new Date()
                : null,
          },
        });
      }
    }

    await prisma.riscEvent.update({
      where: { jti: claims.jti },
      data: {
        processedAt: new Date(),
      },
    });

    return new NextResponse(null, { status: 202 });
  } catch {
    return NextResponse.json(
      { error: 'Unable to process Cross-Account Protection event token.' },
      { status: 400 }
    );
  }
}
