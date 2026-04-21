import { NextResponse } from 'next/server';

import { resolveAuthenticatedUserId } from '@/lib/address-utils';
import { resolveProfileAvatarUrl } from '@/lib/profile-avatar';
import {
  getProfileUsernameValidationError,
  getPublicProfilePath,
  normalizeProfileUsername,
} from '@/lib/profile-url';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type UpdateProfileBody = {
  name?: unknown;
  username?: unknown;
};

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;

const userSelectWithUsername = {
  id: true,
  email: true,
  name: true,
  username: true,
  avatarUrl: true,
} as const;

function normalizeName(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ');
}

function hasOwnField(value: unknown, key: string) {
  return Boolean(value && typeof value === 'object' && key in value);
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
      select: userSelectWithUsername,
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        email: user.email,
        name: user.name,
        username: user.username,
        avatarUrl: resolveProfileAvatarUrl(user.avatarUrl),
        publicProfilePath: getPublicProfilePath({
          id: user.id,
          username: user.username,
          displayName: user.name,
          email: user.email,
        }),
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
    const hasUsernameField = hasOwnField(body, 'username');
    const rawUsername = typeof body.username === 'string' ? body.username.trim() : '';
    const normalizedUsername = normalizeProfileUsername(body.username);

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

    if (hasUsernameField) {
      if (rawUsername.length > 0 && normalizedUsername.length === 0) {
        return NextResponse.json(
          { error: 'Username can include lowercase letters, numbers, and hyphens.' },
          { status: 400 }
        );
      }

      const usernameError = getProfileUsernameValidationError(normalizedUsername);
      if (usernameError) {
        return NextResponse.json(
          { error: usernameError },
          { status: 400 }
        );
      }

      if (normalizedUsername) {
        const existingUser = await prisma.user.findUnique({
          where: { username: normalizedUsername },
          select: { id: true },
        });

        if (existingUser && existingUser.id !== userId) {
          return NextResponse.json(
            { error: 'Username is already taken. Please choose another one.' },
            { status: 409 }
          );
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: normalizedName || null,
        ...(hasUsernameField
          ? { username: normalizedUsername || null }
          : {}),
      },
      select: userSelectWithUsername,
    });

    return NextResponse.json({
      user: {
        email: updatedUser.email,
        name: updatedUser.name,
        username: updatedUser.username,
        avatarUrl: resolveProfileAvatarUrl(updatedUser.avatarUrl),
        publicProfilePath: getPublicProfilePath({
          id: updatedUser.id,
          username: updatedUser.username,
          displayName: updatedUser.name,
          email: updatedUser.email,
        }),
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Unable to update profile details right now.' },
      { status: 500 }
    );
  }
}
