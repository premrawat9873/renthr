import { NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import {
  createCustomSessionToken,
  CUSTOM_SESSION_COOKIE_NAME,
  getCustomSessionCookieOptions,
} from '@/lib/custom-session';

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequestBody;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password. Use OTP if this account was created without a password.' },
        { status: 401 }
      );
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const sessionToken = createCustomSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      authMethod: 'password',
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      sessionToken,
    });

    response.cookies.set(CUSTOM_SESSION_COOKIE_NAME, sessionToken, getCustomSessionCookieOptions());

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Unable to sign in right now. Please try again.' },
      { status: 500 }
    );
  }
}
