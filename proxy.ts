import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase-proxy';

// Strict CORS configuration - only allows renthour.in website and mobile app requests
const ALLOWED_WEB_ORIGINS = new Set([
  'https://renthour.in',
  'https://www.renthour.in',
]);

if (process.env.NODE_ENV !== 'production') {
  ALLOWED_WEB_ORIGINS.add('http://localhost:3000');
}

// Expected header from mobile app requests
const MOBILE_APP_IDENTIFIER = 'X-App-Client';

const CORS_ALLOWED_METHODS = 'GET,POST,PATCH,PUT,DELETE,OPTIONS';
const CORS_ALLOWED_HEADERS =
  'Accept,Authorization,Content-Type,X-Requested-With,X-App-Client';

function isApiRequest(request: NextRequest) {
  return request.nextUrl.pathname.startsWith('/api/');
}

function isMobileAppRequest(request: NextRequest): boolean {
  // Mobile app requests typically don't send an Origin header
  // but they can optionally send an X-App-Client header for explicit identification
  const origin = request.headers.get('origin');
  const appClientHeader = request.headers.get(MOBILE_APP_IDENTIFIER);
  
  // If no origin header is present and it's an API request, consider it from mobile app
  // (Native mobile apps don't send Origin headers by default)
  return !origin && appClientHeader === 'true';
}

function getAllowedOrigin(origin: string | null, request: NextRequest) {
  if (!origin) {
    // Check if this is a legitimate mobile app request
    if (isMobileAppRequest(request)) {
      return 'mobile-app'; // Signal that this is a mobile app request
    }
    // No origin header and not identified as mobile app - allow for native requests
    return null;
  }

  // For web requests, validate against whitelist
  return ALLOWED_WEB_ORIGINS.has(origin) ? origin : null;
}

function withCorsHeaders(response: NextResponse, allowedOrigin: string | null) {
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
  response.headers.set('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);

  // Only set Access-Control-Allow-Origin if we have an allowed origin
  // This prevents accidental CORS allowance
  if (allowedOrigin && allowedOrigin !== 'mobile-app') {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  if (!isApiRequest(request)) {
    return updateSession(request);
  }

  const origin = request.headers.get('origin');
  const allowedOrigin = getAllowedOrigin(origin, request);
  const hasOriginHeader = Boolean(origin);

  // Strict CORS enforcement:
  // - If Origin header is present, it MUST be in the whitelist
  // - If no Origin header, allow only if it's a mobile app request or native request
  if (hasOriginHeader && !allowedOrigin) {
    // Browser-based cross-origin request from disallowed origin
    if (request.method === 'OPTIONS') {
      return withCorsHeaders(new NextResponse(null, { status: 403 }), null);
    }

    return withCorsHeaders(
      NextResponse.json({ error: 'CORS policy: Request origin not allowed. Only renthour.in and approved mobile apps can access this API.' }, { status: 403 }),
      null
    );
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