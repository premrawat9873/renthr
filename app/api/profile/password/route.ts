import { NextResponse } from 'next/server';

import { resolveAuthenticatedUserId } from '@/lib/address-utils';
import { hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type UpdatePasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

const MIN_PASSWORD_LENGTH = 8;

function normalizePassword(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export async function POST(request: Request) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Please log in before updating your password.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as UpdatePasswordBody;
    const currentPassword = normalizePassword(body.currentPassword);
    const newPassword = normalizePassword(body.newPassword);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const hasExistingPassword = Boolean(user.passwordHash);

    if (hasExistingPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required.' },
          { status: 400 }
        );
      }

      const isCurrentPasswordValid = await verifyPassword(
        currentPassword,
        user.passwordHash as string
      );

      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect.' },
          { status: 401 }
        );
      }

      if (currentPassword === newPassword) {
        return NextResponse.json(
          { error: 'New password must be different from current password.' },
          { status: 400 }
        );
      }
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: hasExistingPassword
        ? 'Password updated successfully.'
        : 'Password set successfully.',
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to update password right now.' },
      { status: 500 }
    );
  }
}
