import { NextResponse } from 'next/server';

import { resolveAuthenticatedUserId } from '@/lib/address-utils';
import { hashOtpCode, OTP_CODE_LENGTH } from '@/lib/otp';
import {
  getPhoneVerificationUnavailableMessage,
  isPhoneVerificationEnabled,
} from '@/lib/phone-sms';
import { prisma } from '@/lib/prisma';

type VerifyPhoneOtpRequestBody = {
  phone?: unknown;
  otp?: unknown;
};

const OTP_PATTERN = /^\d{6}$/;
const SUPPORTED_PHONE_PATTERN = /^\+91\d{10}$/;

function normalizeIndianPhone(value: unknown) {
  const raw = typeof value === 'string' ? value : '';
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  return '';
}

export async function POST(request: Request) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Please log in before verifying phone number.' },
        { status: 401 }
      );
    }

    if (!isPhoneVerificationEnabled()) {
      return NextResponse.json(
        { error: getPhoneVerificationUnavailableMessage() },
        { status: 503 }
      );
    }

    const body = (await request.json()) as VerifyPhoneOtpRequestBody;
    const phone = normalizeIndianPhone(body.phone);
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

    if (!SUPPORTED_PHONE_PATTERN.test(phone)) {
      return NextResponse.json(
        { error: 'Enter a valid Indian phone number.' },
        { status: 400 }
      );
    }

    if (!OTP_PATTERN.test(otp)) {
      return NextResponse.json(
        { error: `Enter a valid ${OTP_CODE_LENGTH}-digit OTP.` },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        isVerified: true,
        otpCodeHash: true,
        otpExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.phone !== phone) {
      return NextResponse.json(
        { error: 'Phone number does not match your latest OTP request.' },
        { status: 400 }
      );
    }

    if (!user.otpCodeHash || !user.otpExpiresAt) {
      return NextResponse.json(
        { error: 'Request a new phone OTP before verification.' },
        { status: 400 }
      );
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpCodeHash: null,
          otpExpiresAt: null,
          otpRequestedAt: null,
          verificationStatus: 'UNVERIFIED',
        },
      });

      return NextResponse.json(
        { error: 'OTP expired. Please request a new code.' },
        { status: 401 }
      );
    }

    const providedHash = hashOtpCode(`phone:${phone}`, otp);
    if (providedHash !== user.otpCodeHash) {
      return NextResponse.json({ error: 'Incorrect OTP. Please try again.' }, { status: 401 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        phone,
        isVerified: true,
        verificationStatus: 'VERIFIED',
        otpCodeHash: null,
        otpExpiresAt: null,
        otpRequestedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        isVerified: true,
      },
    });

    return NextResponse.json({
      message: 'Phone number verified successfully.',
      user: {
        id: String(updatedUser.id),
        email: updatedUser.email,
        name: updatedUser.name,
        avatarUrl: updatedUser.avatarUrl,
        phone: updatedUser.phone,
        isVerified: updatedUser.isVerified,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to verify phone right now. Please try again.' },
      { status: 500 }
    );
  }
}
