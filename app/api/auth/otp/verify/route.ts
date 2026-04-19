import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashOtpCode, normalizeEmail, OTP_CODE_LENGTH } from '@/lib/otp';
import {
  createCustomSessionToken,
  CUSTOM_SESSION_COOKIE_NAME,
  getCustomSessionCookieOptions,
} from '@/lib/custom-session';

const OTP_PATTERN = /^\d{6}$/;

type VerifyOtpRequestBody = {
  email?: unknown;
  otp?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyOtpRequestBody;
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    if (!OTP_PATTERN.test(otp)) {
      return NextResponse.json(
        { error: `Enter a valid ${OTP_CODE_LENGTH}-digit OTP.` },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isVerified: true,
        otpCodeHash: true,
        otpExpiresAt: true,
      },
    });

    if (!user || !user.otpCodeHash || !user.otpExpiresAt) {
      return NextResponse.json({ error: 'Invalid OTP. Please request a new code.' }, { status: 401 });
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpCodeHash: null,
          otpExpiresAt: null,
        },
      });

      return NextResponse.json({ error: 'OTP expired. Please request a new code.' }, { status: 401 });
    }

    const providedHash = hashOtpCode(email, otp);

    if (providedHash !== user.otpCodeHash) {
      return NextResponse.json({ error: 'Incorrect OTP. Please try again.' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCodeHash: null,
        otpExpiresAt: null,
      },
    });

    const sessionToken = createCustomSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      authMethod: 'otp',
    });

    const response = NextResponse.json({
      user: {
        id: String(user.id),
        email: user.email,
        name: user.name,
        phone: user.phone,
        isVerified: user.isVerified,
      },
      sessionToken,
    });

    response.cookies.set(CUSTOM_SESSION_COOKIE_NAME, sessionToken, getCustomSessionCookieOptions());

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Unable to verify OTP right now. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405 }
  );
}

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204 });
}
