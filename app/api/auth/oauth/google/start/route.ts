import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseAuthCookieOptions } from '@/lib/auth-cookie-options';
import { clearSupabaseAuthTokenCookies } from '@/lib/supabase-auth-utils';

const DEFAULT_ALLOWED_MOBILE_REDIRECT_SCHEMES = ['renthour', 'exp'];

function isSafeInternalPath(path: string | null) {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

function getAllowedMobileRedirectSchemes() {
  const configuredSchemes = process.env.MOBILE_AUTH_REDIRECT_SCHEMES;
  if (!configuredSchemes) {
    return DEFAULT_ALLOWED_MOBILE_REDIRECT_SCHEMES;
  }

  const schemes = configuredSchemes
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  return schemes.length > 0 ? schemes : DEFAULT_ALLOWED_MOBILE_REDIRECT_SCHEMES;
}

function isAllowedMobileRedirect(redirectUrl: string) {
  try {
    const parsed = new URL(redirectUrl);
    const scheme = parsed.protocol.replace(':', '').toLowerCase();

    if (!scheme || scheme === 'http' || scheme === 'https') {
      return false;
    }

    return getAllowedMobileRedirectSchemes().includes(scheme);
  } catch {
    return false;
  }
}

function buildMobileRedirect(redirectUrl: string, errorCode: string) {
  const parsed = new URL(redirectUrl);
  parsed.searchParams.set('error', errorCode);
  return parsed.toString();
}

function buildWebLoginRedirect(requestUrl: URL, errorCode: string, nextPath: string) {
  const loginUrl = new URL('/login', requestUrl.origin);
  loginUrl.searchParams.set('error', errorCode);

  if (nextPath !== '/') {
    loginUrl.searchParams.set('next', nextPath);
  }

  return loginUrl;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectTarget = requestUrl.searchParams.get('redirect')?.trim() || '';
  const nextParam = requestUrl.searchParams.get('next');
  const nextPath = isSafeInternalPath(nextParam) ? nextParam : '/';

  const isMobileFlow = redirectTarget.length > 0;

  if (isMobileFlow && !isAllowedMobileRedirect(redirectTarget)) {
    return NextResponse.json(
      { error: 'Invalid redirect URL for mobile OAuth flow.' },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isMobileFlow) {
      return NextResponse.redirect(buildMobileRedirect(redirectTarget, 'missing_supabase_env'));
    }

    return NextResponse.redirect(
      buildWebLoginRedirect(requestUrl, 'missing_supabase_env', nextPath)
    );
  }

  const callbackUrl = isMobileFlow
    ? new URL('/api/auth/oauth/mobile/callback', requestUrl.origin)
    : new URL('/auth/callback', requestUrl.origin);

  if (isMobileFlow) {
    callbackUrl.searchParams.set('redirect', redirectTarget);
  } else {
    callbackUrl.searchParams.set('next', nextPath);
  }

  const response = NextResponse.redirect(new URL('/login', requestUrl.origin));
  const cookieStore = await cookies();
  const incomingCookies = cookieStore.getAll();

  // Ensure stale chunked auth cookies do not poison the next OAuth PKCE session.
  clearSupabaseAuthTokenCookies(response, incomingCookies);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getSupabaseAuthCookieOptions(),
    cookies: {
      getAll() {
        return incomingCookies;
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error || !data?.url) {
    if (isMobileFlow) {
      return NextResponse.redirect(buildMobileRedirect(redirectTarget, 'oauth_start_failed'));
    }

    return NextResponse.redirect(
      buildWebLoginRedirect(requestUrl, 'oauth_start_failed', nextPath)
    );
  }

  response.headers.set('Location', data.url);
  return response;
}
