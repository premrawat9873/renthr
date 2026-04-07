import { NextResponse } from 'next/server';

import { resolveAuthenticatedUserId } from '@/lib/address-utils';
import { resolveProfileAvatarUrl } from '@/lib/profile-avatar';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type UpdateProfileBody = {
  name?: unknown;
};

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;

function normalizeName(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ');
}

export async function GET() {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Please log in to view your profile details.' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        email: user.email,
        name: user.name,
        avatarUrl: resolveProfileAvatarUrl(user.avatarUrl),
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to fetch profile details right now.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Please log in before updating your profile details.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as UpdateProfileBody;
    const normalizedName = normalizeName(body.name);

    if (normalizedName.length > 0 && normalizedName.length < NAME_MIN_LENGTH) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters.' },
        { status: 400 }
      );
    }

    if (normalizedName.length > NAME_MAX_LENGTH) {
      return NextResponse.json(
        { error: 'Name must be 80 characters or less.' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: normalizedName || null,
      },
      select: {
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({
      user: {
        email: updatedUser.email,
        name: updatedUser.name,
        avatarUrl: resolveProfileAvatarUrl(updatedUser.avatarUrl),
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to update profile details right now.' },
      { status: 500 }
    );
  }
}
