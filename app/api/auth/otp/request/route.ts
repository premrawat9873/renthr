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

type ResendApiError = {
  statusCode?: number;
  name?: string;
  message?: string;
};

type OtpRequestBody = {
  email?: unknown;
};

function getOtpDeliveryErrorMessage(error: ResendApiError | null | undefined) {
  const message = typeof error?.message === 'string' ? error.message : '';
  const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 0;

  if (
    statusCode === 403 &&
    (message.includes('verify a domain') ||
      message.includes('testing emails') ||
      message.includes('own email address'))
  ) {
    return 'OTP email delivery is not configured for external recipients. Verify your domain in Resend and set RESEND_FROM_EMAIL to an address on that domain.';
  }

  if (message) {
    return `Unable to send OTP: ${message}`;
  }

  return 'Unable to send OTP right now. Please try again.';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OtpRequestBody;
    const email =
      typeof body.email === 'string' ? normalizeEmail(body.email) : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email is required.' },
        { status: 400 }
      );
    }

    // Create or fetch user
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
      select: {
        id: true,
        otpRequestedAt: true,
      },
    });

    // Cooldown check
    if (user.otpRequestedAt) {
      const elapsedSeconds = Math.floor(
        (Date.now() - user.otpRequestedAt.getTime()) / 1000
      );

      if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
        const secondsLeft =
          OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds;

        return NextResponse.json(
          {
            error: `Please wait ${secondsLeft}s before requesting another OTP.`,
          },
          { status: 429 }
        );
      }
    }

    // Generate OTP
    const otpCode = generateOtpCode();
    const otpCodeHash = hashOtpCode(email, otpCode);
    const otpExpiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
    );

    // Save OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCodeHash,
        otpExpiresAt,
        otpRequestedAt: new Date(),
      },
    });

    // Send Email
    const resend = getResendClient();

    const sendResult = await resend.emails.send({
      from: getResendFromEmail(),
      to: [email],
      subject: 'Your RentHour login OTP',

      html: `
      <div style="background:#f5f7f6; padding:40px 0; font-family:Arial, sans-serif;">
        
        <div style="
          max-width:480px;
          margin:0 auto;
          background:#ffffff;
          border-radius:12px;
          overflow:hidden;
          box-shadow:0 6px 20px rgba(0,0,0,0.08);
        ">

          <!-- Header -->
          <div style="
            background:linear-gradient(135deg,#1f7a4d,#2e9e63);
            padding:24px;
            text-align:center;
            color:#fff;
          ">
            <h1 style="margin:0; font-size:20px;">
              Rent<span style="background:#facc15;color:#000;padding:2px 6px;border-radius:4px;">hour</span>
            </h1>
            <p style="margin:6px 0 0; font-size:13px; opacity:0.9;">
              Rent anything, from anyone nearby
            </p>
          </div>

          <!-- Body -->
          <div style="padding:28px; text-align:center;">
            
            <h2 style="margin:0 0 10px; font-size:18px; color:#222;">
              Login Verification
            </h2>

            <p style="font-size:14px; color:#666; margin-bottom:20px;">
              Enter the OTP below to continue logging into your account
            </p>

            <!-- OTP Box -->
            <div style="
              background:#e8f5ee;
              border:1px solid #1f7a4d;
              border-radius:10px;
              padding:16px;
              font-size:30px;
              letter-spacing:8px;
              font-weight:bold;
              color:#1f7a4d;
              margin:20px 0;
            ">
              ${otpCode}
            </div>

            <p style="font-size:13px; color:#555;">
              This code expires in <b>${OTP_EXPIRY_MINUTES} minutes</b>
            </p>

          </div>

          <!-- Footer -->
          <div style="
            padding:16px;
            text-align:center;
            font-size:12px;
            color:#888;
            border-top:1px solid #eee;
          ">
            If you didn’t request this OTP, you can safely ignore this email.
          </div>

        </div>
      </div>
      `,

      text: `Your RentHour OTP is ${otpCode}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    });

    if (sendResult.error) {
      // Avoid locking users into cooldown when email delivery is rejected upstream.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpCodeHash: null,
          otpExpiresAt: null,
          otpRequestedAt: null,
        },
      });

      return NextResponse.json(
        {
          error: getOtpDeliveryErrorMessage(sendResult.error),
        },
        { status: 502 }
      );
    }

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

export async function GET() {
  return NextResponse.json(
    { error: 'Method Not Allowed' },
    { status: 405 }
  );
}

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204 });
}