import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAvatarUrlFromMetadata } from '@/lib/profile-avatar';
import {
  createCustomSessionToken,
  CUSTOM_SESSION_COOKIE_NAME,
  getCustomSessionCookieOptions,
} from '@/lib/custom-session';
import { getSupabaseAuthCookieOptions } from '@/lib/auth-cookie-options';
import {
  applyAuthResetResponseHeaders,
  clearSupabaseAuthTokenCookies,
  filterCookiesForSupabaseAuthCodeExchange,
} from '@/lib/supabase-auth-utils';

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

function buildMobileRedirect(
  redirectUrl: string,
  params: Record<string, string | null | undefined>
) {
  const parsed = new URL(redirectUrl);

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value !== 'string' || value.length === 0) {
      return;
    }

    parsed.searchParams.set(key, value);
  });

  return parsed.toString();
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirectTargetRaw = requestUrl.searchParams.get('redirect')?.trim() || '';

  if (!redirectTargetRaw || !isAllowedMobileRedirect(redirectTargetRaw)) {
    return NextResponse.json(
      { error: 'Invalid redirect URL for mobile OAuth callback.' },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.redirect(
      buildMobileRedirect(redirectTargetRaw, { error: 'missing_oauth_code' })
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(
      buildMobileRedirect(redirectTargetRaw, { error: 'missing_supabase_env' })
    );
  }

  const response = NextResponse.redirect(redirectTargetRaw);
  const cookieStore = await cookies();
  const incomingCookies = cookieStore.getAll();

  // Clear any previously chunked auth token cookies first so old chunks cannot corrupt new sessions.
  clearSupabaseAuthTokenCookies(response, incomingCookies);

  const redirectWithSessionReset = (errorCode: string) => {
    const redirectResponse = NextResponse.redirect(
      buildMobileRedirect(redirectTargetRaw, { error: errorCode })
    );
    clearSupabaseAuthTokenCookies(redirectResponse, incomingCookies);
    applyAuthResetResponseHeaders(redirectResponse);
    return redirectResponse;
  };

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: getSupabaseAuthCookieOptions(),
    cookies: {
      getAll() {
        return filterCookiesForSupabaseAuthCodeExchange(incomingCookies);
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let exchangeError: unknown = null;

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchangeError = error;
  } catch (error) {
    exchangeError = error;
  }

  if (exchangeError) {
    return redirectWithSessionReset('oauth_exchange_failed');
  }

  let supabaseUser = null;

  try {
    const {
      data,
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return redirectWithSessionReset('oauth_user_missing');
    }

    supabaseUser = data.user;
  } catch {
    return redirectWithSessionReset('oauth_user_missing');
  }

  if (!supabaseUser?.email) {
    return NextResponse.redirect(
      buildMobileRedirect(redirectTargetRaw, { error: 'oauth_user_missing' })
    );
  }

  const normalizedEmail = supabaseUser.email.trim().toLowerCase();
  const metadataName =
    typeof supabaseUser.user_metadata?.name === 'string'
      ? supabaseUser.user_metadata.name.trim()
      : '';
  const metadataAvatarUrl = getAvatarUrlFromMetadata(supabaseUser.user_metadata);

  let sessionUserId: string | number = supabaseUser.id;
  let sessionUserName: string | null = metadataName || null;
  let sessionUserAvatarUrl: string | null = metadataAvatarUrl;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!existingUser) {
      const createdUser = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: metadataName || null,
          avatarUrl: metadataAvatarUrl,
        },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      });

      sessionUserId = createdUser.id;
      sessionUserName = createdUser.name;
      sessionUserAvatarUrl = createdUser.avatarUrl;
    } else {
      sessionUserId = existingUser.id;
      sessionUserName = existingUser.name ?? (metadataName || null);
      sessionUserAvatarUrl = existingUser.avatarUrl ?? metadataAvatarUrl;

      const updateData: {
        name?: string;
        avatarUrl?: string;
      } = {};

      if (metadataName && !existingUser.name) {
        updateData.name = metadataName;
      }

      if (metadataAvatarUrl && !existingUser.avatarUrl) {
        updateData.avatarUrl = metadataAvatarUrl;
      }

      if (Object.keys(updateData).length > 0) {
        const updatedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: updateData,
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        });

        sessionUserName = updatedUser.name;
        sessionUserAvatarUrl = updatedUser.avatarUrl;
      }
    }
  } catch {
    // Keep OAuth login working even if profile sync fails unexpectedly.
  }

  let sessionToken: string;
  try {
    sessionToken = createCustomSessionToken({
      userId: sessionUserId,
      email: normalizedEmail,
      name: sessionUserName,
      authMethod: 'oauth',
    });
  } catch {
    return NextResponse.redirect(
      buildMobileRedirect(redirectTargetRaw, { error: 'custom_session_failed' })
    );
  }

  response.cookies.set(
    CUSTOM_SESSION_COOKIE_NAME,
    sessionToken,
    getCustomSessionCookieOptions()
  );

  response.headers.set(
    'Location',
    buildMobileRedirect(redirectTargetRaw, {
      sessionToken,
      userId: String(sessionUserId),
      email: normalizedEmail,
      name: sessionUserName || '',
      avatarUrl: sessionUserAvatarUrl || '',
    })
  );

  return response;
}
