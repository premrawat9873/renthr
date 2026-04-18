import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseAuthCookieOptions } from '@/lib/auth-cookie-options';
import { clearSupabaseAuthTokenCookies } from '@/lib/supabase-auth-utils';

const DEFAULT_ALLOWED_MOBILE_REDIRECT_SCHEMES = ['renthour', 'exp'];

function isSafeInternalPath(path: string | null) {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

function getFirstHeaderValue(value: string | null) {
  if (!value) {
    return '';
  }

  return value.split(',')[0]?.trim() || '';
}

function isLoopbackHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  );
}

function isLoopbackOrigin(origin: string) {
  try {
    return isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function parseHttpOrigin(originOrUrl: string) {
  if (!originOrUrl) {
    return '';
  }

  try {
    const parsed = new URL(originOrUrl);

    if (parsed.hostname === '0.0.0.0') {
      parsed.hostname = 'localhost';
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }

    return parsed.origin;
  } catch {
    return '';
  }
}

function getBrowserHeaderOrigin(request: Request) {
  const originHeader = getFirstHeaderValue(request.headers.get('origin'));
  const originFromHeader = parseHttpOrigin(originHeader);

  if (originFromHeader) {
    return originFromHeader;
  }

  const refererHeader = getFirstHeaderValue(request.headers.get('referer'));
  return parseHttpOrigin(refererHeader);
}

function getConfiguredPublicOrigin() {
  const configuredSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || process.env.SITE_URL || '';

  if (!configuredSiteUrl) {
    return '';
  }

  const parsedOrigin = parseHttpOrigin(configuredSiteUrl);
  if (!parsedOrigin) {
    return '';
  }

  if (process.env.NODE_ENV === 'production' && isLoopbackOrigin(parsedOrigin)) {
    return '';
  }

  return parsedOrigin;
}

function getSanitizedRequestOrigin(request: Request, requestUrl: URL) {
  const configuredPublicOrigin = getConfiguredPublicOrigin();
  const browserHeaderOrigin = getBrowserHeaderOrigin(request);
  const forwardedHost = getFirstHeaderValue(request.headers.get('x-forwarded-host'));
  const host = forwardedHost || getFirstHeaderValue(request.headers.get('host'));
  const forwardedProto = getFirstHeaderValue(request.headers.get('x-forwarded-proto'));
  const protocol = forwardedProto === 'http' || forwardedProto === 'https'
    ? forwardedProto
    : requestUrl.protocol.replace(':', '');

  if (host) {
    try {
      const forwardedUrl = new URL(`${protocol}://${host}`);

      if (forwardedUrl.hostname === '0.0.0.0') {
        forwardedUrl.hostname = 'localhost';
      }

      if (process.env.NODE_ENV === 'production' && isLoopbackHostname(forwardedUrl.hostname)) {
        if (configuredPublicOrigin) {
          return configuredPublicOrigin;
        }

        if (browserHeaderOrigin && !isLoopbackOrigin(browserHeaderOrigin)) {
          return browserHeaderOrigin;
        }

        if (!isLoopbackHostname(requestUrl.hostname)) {
          return requestUrl.origin;
        }
      }

      if (isLoopbackHostname(forwardedUrl.hostname)) {
        forwardedUrl.protocol = 'http:';
      }

      const forwardedOrigin = forwardedUrl.origin;

      return forwardedOrigin;
    } catch {
      // Fallback to request URL origin below.
    }
  }

  if (requestUrl.hostname === '0.0.0.0') {
    return `http://localhost:${requestUrl.port || '3000'}`;
  }

  if (process.env.NODE_ENV === 'production' && isLoopbackHostname(requestUrl.hostname)) {
    if (configuredPublicOrigin) {
      return configuredPublicOrigin;
    }

    if (browserHeaderOrigin && !isLoopbackOrigin(browserHeaderOrigin)) {
      return browserHeaderOrigin;
    }
  }

  if (isLoopbackHostname(requestUrl.hostname)) {
    return `http://${requestUrl.hostname}:${requestUrl.port || '3000'}`;
  }

  return requestUrl.origin;
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

function buildWebLoginRedirect(requestOrigin: string, errorCode: string, nextPath: string) {
  const loginUrl = new URL('/login', requestOrigin);
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
  const requestOrigin = getSanitizedRequestOrigin(request, requestUrl);

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
      buildWebLoginRedirect(requestOrigin, 'missing_supabase_env', nextPath)
    );
  }

  const callbackUrl = isMobileFlow
    ? new URL('/api/auth/oauth/mobile/callback', requestOrigin)
    : new URL('/auth/callback', requestOrigin);

  if (isMobileFlow) {
    callbackUrl.searchParams.set('redirect', redirectTarget);
  } else {
    callbackUrl.searchParams.set('next', nextPath);
  }

  const response = NextResponse.redirect(new URL('/login', requestOrigin));
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
      buildWebLoginRedirect(requestOrigin, 'oauth_start_failed', nextPath)
    );
  }

  response.headers.set('Location', data.url);
  return response;
}
