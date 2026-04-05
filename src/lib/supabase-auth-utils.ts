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

export function filterCookiesForSupabaseAuthCodeExchange(cookies: CookieLike[]) {
  return cookies.filter(
    ({ name }) =>
      !isSupabaseAuthTokenCookieName(name) ||
      isSupabaseAuthTokenCodeVerifierCookieName(name)
  );
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
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token")
  );
}

export function clearSupabaseAuthTokenCookies(
  response: NextResponse,
  cookies: CookieLike[]
) {
  const cookieNames = new Set(
    cookies
      .map(({ name }) => name)
      .filter((name) => isSupabaseAuthTokenCookieName(name))
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
