import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  CUSTOM_SESSION_COOKIE_NAME,
  getCustomSessionCookieOptions,
} from '@/lib/custom-session';
import {
  applyAuthResetResponseHeaders,
  clearSupabaseAuthTokenCookies,
} from '@/lib/supabase-auth-utils';

function isSafeInternalPath(path: string | null) {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

function clearAuthCookies(response: NextResponse, cookieList: Array<{ name: string; value: string }>) {
  response.cookies.set(CUSTOM_SESSION_COOKIE_NAME, '', {
    ...getCustomSessionCookieOptions(),
    maxAge: 0,
  });

  clearSupabaseAuthTokenCookies(response, cookieList);
  applyAuthResetResponseHeaders(response);
}

export async function POST() {
  const cookieStore = await cookies();
  const response = NextResponse.json({ success: true });

  clearAuthCookies(response, cookieStore.getAll());

  return response;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const requestUrl = new URL(request.url);
  const nextParam = requestUrl.searchParams.get('next');
  const nextPath = isSafeInternalPath(nextParam) ? nextParam : '/login';

  const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  clearAuthCookies(response, cookieStore.getAll());

  return response;
}
