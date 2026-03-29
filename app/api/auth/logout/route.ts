import { NextResponse } from 'next/server';
import {
  CUSTOM_SESSION_COOKIE_NAME,
  getCustomSessionCookieOptions,
} from '@/lib/custom-session';

export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(CUSTOM_SESSION_COOKIE_NAME, '', {
    ...getCustomSessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
