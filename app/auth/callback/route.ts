import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvatarUrlFromMetadata } from "@/lib/profile-avatar";
import {
  createCustomSessionToken,
  CUSTOM_SESSION_COOKIE_NAME,
  getCustomSessionCookieOptions,
} from "@/lib/custom-session";
import { getSupabaseAuthCookieOptions } from "@/lib/auth-cookie-options";
import {
  clearSupabaseAuthTokenCookies,
  filterCookiesForSupabaseAuthCodeExchange,
} from "@/lib/supabase-auth-utils";

function isSafeInternalPath(path: string | null) {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

function toLoginRedirect(requestUrl: URL, nextPath: string, errorCode: string) {
  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", errorCode);

  if (nextPath !== "/home") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next");
  const nextPath = isSafeInternalPath(nextParam) ? nextParam : "/home";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!code) {
    return toLoginRedirect(requestUrl, nextPath, "missing_oauth_code");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return toLoginRedirect(requestUrl, nextPath, "missing_supabase_env");
  }

  const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  const cookieStore = await cookies();
  const incomingCookies = cookieStore.getAll();

  const toLoginRedirectWithSessionReset = (errorCode: string) => {
    const redirectResponse = toLoginRedirect(requestUrl, nextPath, errorCode);
    clearSupabaseAuthTokenCookies(redirectResponse, incomingCookies);
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
    return toLoginRedirectWithSessionReset("oauth_exchange_failed");
  }

  let user = null;

  try {
    const {
      data,
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return toLoginRedirectWithSessionReset("oauth_user_missing");
    }

    user = data.user;
  } catch {
    return toLoginRedirectWithSessionReset("oauth_user_missing");
  }

  if (user?.email) {
    const normalizedEmail = user.email.trim().toLowerCase();
    const metadataName =
      typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name.trim()
        : "";
    const metadataAvatarUrl = getAvatarUrlFromMetadata(user.user_metadata);
    let sessionUserId: string | number = user.id;

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
          },
        });

        sessionUserId = createdUser.id;
      } else {
        sessionUserId = existingUser.id;

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
          await prisma.user.update({
            where: { id: existingUser.id },
            data: updateData,
          });
        }
      }
    } catch {
      // OAuth session is already established; skip profile sync failure for this request.
    }

    try {
      const sessionToken = createCustomSessionToken({
        userId: sessionUserId,
        email: normalizedEmail,
        name: metadataName || null,
        authMethod: "oauth",
      });

      response.cookies.set(
        CUSTOM_SESSION_COOKIE_NAME,
        sessionToken,
        getCustomSessionCookieOptions()
      );
    } catch {
      // Keep OAuth login successful even if custom cookie signing is unavailable.
    }
  }

  return response;
}
