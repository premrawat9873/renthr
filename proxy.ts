import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase-proxy';

const ALLOWED_WEB_ORIGINS = new Set([
  'https://renthour.in',
  'https://www.renthour.in',
]);

if (process.env.NODE_ENV !== 'production') {
  ALLOWED_WEB_ORIGINS.add('http://localhost:3000');
}

const CORS_ALLOWED_METHODS = 'GET,POST,PATCH,PUT,DELETE,OPTIONS';
const CORS_ALLOWED_HEADERS =
  'Accept,Authorization,Content-Type,X-Requested-With,X-App-Client';

function isApiRequest(request: NextRequest) {
  return request.nextUrl.pathname.startsWith('/api/');
}

function getAllowedOrigin(origin: string | null) {
  if (!origin) {
    // Native app requests generally do not send an Origin header.
    return null;
  }

  return ALLOWED_WEB_ORIGINS.has(origin) ? origin : null;
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

  const origin = request.headers.get('origin');
  const allowedOrigin = getAllowedOrigin(origin);
  const hasOriginHeader = Boolean(origin);

  // Block browser-based cross-origin calls unless origin is explicitly allowed.
  if (hasOriginHeader && !allowedOrigin) {
    if (request.method === 'OPTIONS') {
      return withCorsHeaders(new NextResponse(null, { status: 403 }), null);
    }

    return withCorsHeaders(
      NextResponse.json({ error: 'CORS origin blocked.' }, { status: 403 }),
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