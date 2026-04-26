import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase-proxy';
import { isMutatingMethod } from '@/lib/csrf-constants';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/csrf-constants';

// Strict client allowlist - only website and signed mobile app requests.
const ALLOWED_WEB_ORIGINS = new Set([
  'https://renthour.in',
  'https://www.renthour.in',
]);

if (process.env.NODE_ENV !== 'production') {
  ALLOWED_WEB_ORIGINS.add('http://localhost:3000');
}

const MOBILE_APP_IDENTIFIER_HEADER = 'x-app-client';
const MOBILE_APP_KEY_HEADER = 'x-app-key';

const CORS_ALLOWED_METHODS = 'GET,POST,PATCH,PUT,DELETE,OPTIONS';
const CORS_ALLOWED_HEADERS =
  'Accept,Authorization,Content-Type,X-Requested-With,X-App-Client,X-App-Key';

function isApiRequest(request: NextRequest) {
  return request.nextUrl.pathname.startsWith('/api/');
}

function parseOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getRequestOrigin(request: NextRequest) {
  const origin = parseOrigin(request.headers.get('origin'));
  if (origin) return origin;
  return parseOrigin(request.headers.get('referer'));
}

function getMobileAppSecret() {
  return (process.env.MOBILE_APP_API_KEY || '').trim();
}

function isAllowedWebRequest(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  return Boolean(requestOrigin && ALLOWED_WEB_ORIGINS.has(requestOrigin));
}

function isAllowedMobileRequest(request: NextRequest) {
  // Native requests generally have no Origin/Referer.
  if (request.headers.get('origin') || request.headers.get('referer')) {
    return false;
  }

  const appClientHeader = request.headers.get(MOBILE_APP_IDENTIFIER_HEADER);
  if (appClientHeader !== 'true') {
    return false;
  }

  const expectedKey = getMobileAppSecret();
  if (!expectedKey) {
    // Fail closed in production if secret is not configured.
    return process.env.NODE_ENV !== 'production';
  }

  const providedKey = request.headers.get(MOBILE_APP_KEY_HEADER) || '';
  return providedKey === expectedKey;
}

function withCorsHeaders(response: NextResponse, allowedOrigin: string | null) {
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
  response.headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);

  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  if (!isApiRequest(request)) {
    return updateSession(request);
  }

  const allowedWebRequest = isAllowedWebRequest(request);
  const allowedMobileRequest = isAllowedMobileRequest(request);
  const requestOrigin = getRequestOrigin(request);
  const allowedOrigin = allowedWebRequest ? requestOrigin : null;

  if (!allowedWebRequest && !allowedMobileRequest) {
    if (request.method === 'OPTIONS') {
      return withCorsHeaders(new NextResponse(null, { status: 403 }), null);
    }

    return withCorsHeaders(
      NextResponse.json(
        { error: 'Access denied. API is restricted to RentHour website and approved mobile app clients.' },
        { status: 403 }
      ),
      null
    );
  }

  // If this appears to be a browser navigation/request (Origin or Referer present),
  // enforce additional protections for mutating HTTP methods.
  const isMutating = isMutatingMethod(request.method);
  const hasNavHeader = Boolean(request.headers.get('origin') || request.headers.get('referer'));

  if (isMutating && hasNavHeader) {
    // Double-submit CSRF check for browser mutating requests.
    const csrfHeader = request.headers.get(CSRF_HEADER_NAME);
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return withCorsHeaders(
        NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 }),
        null
      );
    }
  }

  if (request.method === 'OPTIONS') {
    return withCorsHeaders(new NextResponse(null, { status: 204 }), allowedOrigin);
  }

  const response = await updateSession(request);
  return withCorsHeaders(response, allowedOrigin);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
