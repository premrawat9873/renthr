import { createHash, randomInt } from 'crypto';

export const OTP_CODE_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;

function getOtpSecret() {
  return process.env.OTP_SECRET || process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET || null;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function generateOtpCode() {
  return randomInt(0, 10 ** OTP_CODE_LENGTH).toString().padStart(OTP_CODE_LENGTH, '0');
}

export function hashOtpCode(email: string, otpCode: string) {
  const secret = getOtpSecret();
  if (!secret) {
    throw new Error('Missing OTP_SECRET (or AUTH_SESSION_SECRET/NEXTAUTH_SECRET) for OTP hashing.');
  }

  return createHash('sha256')
    .update(`${normalizeEmail(email)}:${otpCode}:${secret}`)
    .digest('hex');
}
