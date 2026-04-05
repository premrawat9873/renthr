import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseAuthCookieOptions } from '@/lib/auth-cookie-options';

const DEFAULT_ALLOWED_MOBILE_REDIRECT_SCHEMES = ['renthour', 'exp'];

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectTarget = requestUrl.searchParams.get('redirect')?.trim() || '';

  if (!redirectTarget || !isAllowedMobileRedirect(redirectTarget)) {
    return NextResponse.json(
      { error: 'Invalid redirect URL for mobile OAuth flow.' },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(buildMobileRedirect(redirectTarget, 'missing_supabase_env'));
  }

  const callbackUrl = new URL('/api/auth/oauth/mobile/callback', requestUrl.origin);
  callbackUrl.searchParams.set('redirect', redirectTarget);

  let response = NextResponse.redirect(new URL('/login', requestUrl.origin));
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getSupabaseAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
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
    return NextResponse.redirect(buildMobileRedirect(redirectTarget, 'oauth_start_failed'));
  }

  response.headers.set('Location', data.url);
  return response;
}
