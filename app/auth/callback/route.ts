import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAvatarUrlFromMetadata } from "@/lib/profile-avatar";
import { extractGoogleSubject } from "@/lib/google-subject";
import {
  createCustomSessionToken,
  CUSTOM_SESSION_COOKIE_NAME,
  getCustomSessionCookieOptions,
} from "@/lib/custom-session";
import { getSupabaseAuthCookieOptions } from "@/lib/auth-cookie-options";
import {
  applyAuthResetResponseHeaders,
  clearSupabaseAuthTokenCookies,
  filterCookiesForSupabaseAuthCodeExchange,
} from "@/lib/supabase-auth-utils";

function isSafeInternalPath(path: string | null) {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

function getFirstHeaderValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.split(",")[0]?.trim() || "";
}

function isLoopbackHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
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
    return "";
  }

  try {
    const parsed = new URL(originOrUrl);

    if (parsed.hostname === "0.0.0.0") {
      parsed.hostname = "localhost";
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }

    return parsed.origin;
  } catch {
    return "";
  }
}

function getBrowserHeaderOrigin(request: Request) {
  const originHeader = getFirstHeaderValue(request.headers.get("origin"));
  const originFromHeader = parseHttpOrigin(originHeader);

  if (originFromHeader) {
    return originFromHeader;
  }

  const refererHeader = getFirstHeaderValue(request.headers.get("referer"));
  return parseHttpOrigin(refererHeader);
}

function getConfiguredPublicOrigin() {
  const configuredSiteUrl =
    process.env.SITE_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "";

  if (!configuredSiteUrl) {
    return "";
  }

  const parsedOrigin = parseHttpOrigin(configuredSiteUrl);
  if (!parsedOrigin) {
    return "";
  }

  if (process.env.NODE_ENV === "production" && isLoopbackOrigin(parsedOrigin)) {
    return "";
  }

  return parsedOrigin;
}

function getRequestOrigin(request: Request, requestUrl: URL) {
  const configuredPublicOrigin = getConfiguredPublicOrigin();
  const browserHeaderOrigin = getBrowserHeaderOrigin(request);
  const forwardedHost = getFirstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || getFirstHeaderValue(request.headers.get("host"));
  const forwardedProto = getFirstHeaderValue(request.headers.get("x-forwarded-proto"));
  const isForwardedRequest = Boolean(forwardedHost || forwardedProto);
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : requestUrl.protocol.replace(":", "");

  if (host) {
    try {
      const forwardedUrl = new URL(`${protocol}://${host}`);

      if (forwardedUrl.hostname === "0.0.0.0") {
        forwardedUrl.hostname = "localhost";
      }

      if (
        process.env.NODE_ENV === "production" &&
        isForwardedRequest &&
        isLoopbackHostname(forwardedUrl.hostname)
      ) {
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
        forwardedUrl.protocol = "http:";
      }

      const forwardedOrigin = forwardedUrl.origin;

      return forwardedOrigin;
    } catch {
      // Fallback below.
    }
  }

  if (requestUrl.hostname === "0.0.0.0") {
    return `http://localhost:${requestUrl.port || "3000"}`;
  }

  if (
    process.env.NODE_ENV === "production" &&
    isForwardedRequest &&
    isLoopbackHostname(requestUrl.hostname)
  ) {
    if (configuredPublicOrigin) {
      return configuredPublicOrigin;
    }

    if (browserHeaderOrigin && !isLoopbackOrigin(browserHeaderOrigin)) {
      return browserHeaderOrigin;
    }
  }

  if (isLoopbackHostname(requestUrl.hostname)) {
    return `http://${requestUrl.hostname}:${requestUrl.port || "3000"}`;
  }

  return requestUrl.origin;
}

function toLoginRedirect(requestOrigin: string, nextPath: string, errorCode: string) {
  const loginUrl = new URL("/login", requestOrigin);
  loginUrl.searchParams.set("error", errorCode);

  if (nextPath !== "/") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = getRequestOrigin(request, requestUrl);

  try {
    const code = requestUrl.searchParams.get("code");
    const nextParam = requestUrl.searchParams.get("next");
    const nextPath = isSafeInternalPath(nextParam) ? nextParam : "/";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!code) {
      return toLoginRedirect(requestOrigin, nextPath, "missing_oauth_code");
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return toLoginRedirect(requestOrigin, nextPath, "missing_supabase_env");
    }

    const response = NextResponse.redirect(new URL(nextPath, requestOrigin));
    const cookieStore = await cookies();
    const incomingCookies = cookieStore.getAll();

    // Clear any previously chunked auth token cookies first so old chunks cannot corrupt new sessions.
    clearSupabaseAuthTokenCookies(response, incomingCookies);

    const toLoginRedirectWithSessionReset = (errorCode: string) => {
      const redirectResponse = toLoginRedirect(requestOrigin, nextPath, errorCode);
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
      const googleSubject = extractGoogleSubject(user);
      const metadataName =
        typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name.trim()
          : "";
      const metadataAvatarUrl = getAvatarUrlFromMetadata(user.user_metadata);
      let sessionUserId: string | number = user.id;

      try {
        const { prisma } = await import("@/lib/prisma");

        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            googleSignInDisabledAt: true,
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
          if (existingUser.googleSignInDisabledAt) {
            return toLoginRedirectWithSessionReset("google_signin_disabled");
          }

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

        if (googleSubject) {
          await prisma.googleIdentity.upsert({
            where: { subject: googleSubject },
            update: {
              userId: Number(sessionUserId),
              provider: "google",
            },
            create: {
              userId: Number(sessionUserId),
              provider: "google",
              subject: googleSubject,
            },
          });
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
  } catch {
    const nextParam = requestUrl.searchParams.get("next");
    const nextPath = isSafeInternalPath(nextParam) ? nextParam : "/";
    return toLoginRedirect(requestOrigin, nextPath, "oauth_callback_unexpected");
  }
}
