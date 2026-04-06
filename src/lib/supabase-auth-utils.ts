import type { NextResponse } from "next/server";
import { getSupabaseAuthCookieOptions } from "@/lib/auth-cookie-options";

type CookieLike = {
  name: string;
  value: string;
};

const SUPABASE_AUTH_TOKEN_COOKIE_PATTERN =
  /^sb-[a-z0-9-]+-auth-token(?:\.\d+)?$/i;
const SUPABASE_AUTH_TOKEN_CODE_VERIFIER_COOKIE_PATTERN =
  /^sb-[a-z0-9-]+-auth-token-code-verifier(?:\.\d+)?$/i;
const CLEAR_SITE_DATA_HEADER_VALUE = '"cache", "cookies", "storage"';

type SupabaseAuthErrorLike = {
  code?: unknown;
  message?: unknown;
};

export function isSupabaseAuthTokenCookieName(name: string) {
  return SUPABASE_AUTH_TOKEN_COOKIE_PATTERN.test(name);
}

export function isSupabaseAuthTokenCodeVerifierCookieName(name: string) {
  return SUPABASE_AUTH_TOKEN_CODE_VERIFIER_COOKIE_PATTERN.test(name);
}

function isSupabaseAuthFlowCookieName(name: string) {
  return (
    isSupabaseAuthTokenCookieName(name) ||
    isSupabaseAuthTokenCodeVerifierCookieName(name)
  );
}

export function filterCookiesForSupabaseAuthCodeExchange(cookies: CookieLike[]) {
  const filtered = cookies.filter(
    ({ name }) =>
      !isSupabaseAuthTokenCookieName(name) ||
      isSupabaseAuthTokenCodeVerifierCookieName(name)
  );

  // Keep the latest value per cookie name to avoid stale duplicate entries
  // (for example from prior auth attempts) breaking PKCE code exchange.
  const dedupedByName = new Map<string, CookieLike>();
  filtered.forEach((cookie) => {
    dedupedByName.set(cookie.name, cookie);
  });

  return Array.from(dedupedByName.values());
}

export function isSupabaseRefreshTokenNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as SupabaseAuthErrorLike;
  const code =
    typeof maybeError.code === "string" ? maybeError.code.toLowerCase() : "";
  const message =
    typeof maybeError.message === "string"
      ? maybeError.message.toLowerCase()
      : "";

  return (
    code === "refresh_token_not_found" ||
    code === "invalid_refresh_token" ||
    code === "over_request_rate_limit" ||
    code === "invalid_grant" ||
    code === "session_not_found" ||
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token") ||
    message.includes("invalid grant") ||
    message.includes("session not found") ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  );
}

export function clearSupabaseAuthTokenCookies(
  response: NextResponse,
  cookies: CookieLike[]
) {
  const cookieNames = new Set(
    cookies
      .map(({ name }) => name)
      .filter((name) => isSupabaseAuthFlowCookieName(name))
  );

  if (cookieNames.size === 0) {
    return;
  }

  cookieNames.forEach((name) => {
    response.cookies.set(name, "", {
      ...getSupabaseAuthCookieOptions(),
      maxAge: 0,
    });
  });
}

export function applyAuthResetResponseHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Clear-Site-Data", CLEAR_SITE_DATA_HEADER_VALUE);
}
