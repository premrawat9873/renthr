import { randomBytes } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf-constants';
import { getAuthCookieBaseOptions } from './auth-cookie-options';

export function generateCsrfToken() {
  return randomBytes(32).toString('base64url');
}

export function getCsrfCookieOptions() {
  return {
    ...getAuthCookieBaseOptions(),
    httpOnly: false as const,
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  } as Record<string, any>;
}

export function setCsrfCookie(response: NextResponse, token?: string) {
  const t = token ?? generateCsrfToken();
  response.cookies.set(CSRF_COOKIE_NAME, t, getCsrfCookieOptions());
  return t;
}

export function ensureCsrfCookie(request: NextRequest, response: NextResponse) {
  const existing = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!existing) {
    return setCsrfCookie(response);
  }
  return existing;
}

export function validateDoubleSubmit(request: NextRequest) {
  const cookieVal = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerVal = request.headers.get(CSRF_HEADER_NAME);
  if (!cookieVal || !headerVal) return false;
  return headerVal === cookieVal;
}

export default {
  generateCsrfToken,
  ensureCsrfCookie,
  validateDoubleSubmit,
  setCsrfCookie,
};
