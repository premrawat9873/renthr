import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  generateOtpCode,
  hashOtpCode,
  normalizeEmail,
  OTP_EXPIRY_MINUTES,
  OTP_CODE_LENGTH,
} from '@/lib/otp';
import { getResendClient, getResendFromEmail } from '@/lib/resend';

const OTP_RESEND_COOLDOWN_SECONDS = 60;

type OtpRequestBody = {
  email?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OtpRequestBody;
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
      },
      select: {
        id: true,
        otpRequestedAt: true,
      },
    });

    if (user.otpRequestedAt) {
      const elapsedSeconds = Math.floor((Date.now() - user.otpRequestedAt.getTime()) / 1000);
      if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
        const secondsLeft = OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds;
        return NextResponse.json(
          { error: `Please wait ${secondsLeft}s before requesting another OTP.` },
          { status: 429 }
        );
      }
    }

    const otpCode = generateOtpCode();
    const otpCodeHash = hashOtpCode(email, otpCode);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCodeHash,
        otpExpiresAt,
        otpRequestedAt: new Date(),
      },
    });

    const resend = getResendClient();

    await resend.emails.send({
      from: getResendFromEmail(),
      to: [email],
      subject: 'Your RentKart login OTP',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
          <h2 style="margin-bottom: 8px;">Your login code</h2>
          <p style="margin-top: 0;">Use this code to sign in to your RentKart account.</p>
          <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 16px 0;">${otpCode}</p>
          <p style="margin: 0;">This OTP expires in ${OTP_EXPIRY_MINUTES} minutes.</p>
          <p style="margin-top: 12px; color: #666; font-size: 12px;">If you did not request this, you can ignore this email.</p>
        </div>
      `,
      text: `Your RentKart OTP is ${otpCode}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    });

    return NextResponse.json({
      message: `OTP sent successfully. Enter the ${OTP_CODE_LENGTH}-digit code to continue.`,
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to send OTP right now. Please try again.' },
      { status: 500 }
    );
  }
}
