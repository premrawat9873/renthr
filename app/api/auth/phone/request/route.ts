import { NextResponse } from 'next/server';

import { resolveAuthenticatedUserId } from '@/lib/address-utils';
import { generateOtpCode, hashOtpCode, OTP_CODE_LENGTH, OTP_EXPIRY_MINUTES } from '@/lib/otp';
import {
  getPhoneVerificationUnavailableMessage,
  isPhoneVerificationEnabled,
  isPhoneSmsConfigured,
  PhoneSmsError,
  sendPhoneVerificationOtpSms,
} from '@/lib/phone-sms';
import { prisma } from '@/lib/prisma';

const REQUEST_COOLDOWN_SECONDS = 60;
const SUPPORTED_PHONE_PATTERN = /^\+91\d{10}$/;

type PhoneOtpRequestBody = {
  phone?: unknown;
};

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
        { error: 'Please log in before requesting phone verification.' },
        { status: 401 }
      );
    }

    if (!isPhoneVerificationEnabled()) {
      return NextResponse.json(
        { error: getPhoneVerificationUnavailableMessage() },
        { status: 503 }
      );
    }

    const body = (await request.json()) as PhoneOtpRequestBody;
    const normalizedPhone = normalizeIndianPhone(body.phone);

    if (!SUPPORTED_PHONE_PATTERN.test(normalizedPhone)) {
      return NextResponse.json(
        { error: 'Enter a valid Indian phone number.' },
        { status: 400 }
      );
    }

    const duplicatePhoneOwner = await prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        NOT: { id: userId },
      },
      select: { id: true },
    });

    if (duplicatePhoneOwner) {
      return NextResponse.json(
        { error: 'This phone number is already linked to another account.' },
        { status: 409 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        isVerified: true,
        verificationStatus: true,
        otpRequestedAt: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (existingUser.otpRequestedAt) {
      const elapsedSeconds = Math.floor(
        (Date.now() - existingUser.otpRequestedAt.getTime()) / 1000
      );

      if (elapsedSeconds < REQUEST_COOLDOWN_SECONDS) {
        const waitSeconds = REQUEST_COOLDOWN_SECONDS - elapsedSeconds;
        return NextResponse.json(
          {
            error: `Please wait ${waitSeconds}s before requesting another OTP.`,
          },
          { status: 429 }
        );
      }
    }

    const otpCode = generateOtpCode();
    const otpCodeHash = hashOtpCode(`phone:${normalizedPhone}`, otpCode);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        phone: normalizedPhone,
        isVerified: false,
        verificationStatus: 'PENDING',
        otpCodeHash,
        otpExpiresAt,
        otpRequestedAt: new Date(),
      },
    });

    const shouldExposeOtp =
      process.env.NODE_ENV !== 'production' || process.env.PHONE_OTP_DEBUG === 'true';
    const smsConfigured = isPhoneSmsConfigured();

    if (!smsConfigured && !shouldExposeOtp) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          phone: existingUser.phone,
          isVerified: existingUser.isVerified,
          verificationStatus: existingUser.verificationStatus,
          otpCodeHash: null,
          otpExpiresAt: null,
          otpRequestedAt: null,
        },
      });

      return NextResponse.json(
        {
          error:
            'Phone OTP SMS is not configured on the server. Please enable the SMS provider and try again.',
        },
        { status: 503 }
      );
    }

    if (smsConfigured) {
      try {
        await sendPhoneVerificationOtpSms({
          phoneE164: normalizedPhone,
          otpCode,
          expiryMinutes: OTP_EXPIRY_MINUTES,
        });
      } catch (error) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            phone: existingUser.phone,
            isVerified: existingUser.isVerified,
            verificationStatus: existingUser.verificationStatus,
            otpCodeHash: null,
            otpExpiresAt: null,
            otpRequestedAt: null,
          },
        });

        const status = error instanceof PhoneSmsError ? error.status : 502;
        const message =
          error instanceof PhoneSmsError
            ? error.message
            : 'Unable to deliver OTP SMS right now. Please try again.';

        return NextResponse.json({ error: message }, { status });
      }
    }

    const message = smsConfigured
      ? `OTP sent to ${normalizedPhone}. Enter the ${OTP_CODE_LENGTH}-digit code to verify.`
      : `OTP generated. Enter the ${OTP_CODE_LENGTH}-digit code to verify your phone number.`;

    return NextResponse.json({
      message,
      phone: normalizedPhone,
      ...(shouldExposeOtp ? { otpPreview: otpCode } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to request phone OTP right now. Please try again.' },
      { status: 500 }
    );
  }
}
