import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import {
  CUSTOM_SESSION_COOKIE_NAME,
  verifyCustomSessionToken,
} from "@/lib/custom-session";
import { prisma } from "@/lib/prisma";
import {
  getAvatarUrlFromMetadata,
} from "@/lib/profile-avatar";
import { isSupabaseRefreshTokenNotFoundError } from "@/lib/supabase-auth-utils";

export type CurrentUserInfo = {
  id: string | null;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  role?: 'USER' | 'ADMIN' | null;
};

function isMissingColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2022"
  );
}

function parsePositiveInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function getCurrentUserInfo(): Promise<CurrentUserInfo | null> {
  const cookieStore = await cookies();
  const customSession = verifyCustomSessionToken(
    cookieStore.get(CUSTOM_SESSION_COOKIE_NAME)?.value
  );

  if (customSession) {
    const sessionUserId = parsePositiveInt(customSession.sub);
    const userSelect = {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      phone: true,
      isVerified: true,
      role: true,
      sessionRevokedAt: true,
    } as const;
    const fallbackUserSelect = {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      phone: true,
      isVerified: true,
      role: true,
    } as const;
    let user: unknown;

    try {
      user = sessionUserId
        ? await prisma.user.findUnique({
            where: { id: sessionUserId },
            select: userSelect as never,
          })
        : await prisma.user.findUnique({
            where: { email: customSession.email.toLowerCase() },
            select: userSelect as never,
          });
    } catch (error) {
      if (!isMissingColumnError(error)) {
        throw error;
      }

      user = sessionUserId
        ? await prisma.user.findUnique({
            where: { id: sessionUserId },
            select: fallbackUserSelect as never,
          })
        : await prisma.user.findUnique({
            where: { email: customSession.email.toLowerCase() },
            select: fallbackUserSelect as never,
          });
    }

    const userWithRevocation = user as (typeof user & {
      sessionRevokedAt?: Date | null;
      id?: number;
      email?: string;
      name?: string | null;
      avatarUrl?: string | null;
      phone?: string | null;
      isVerified?: boolean;
      role?: 'USER' | 'ADMIN' | null;
    }) | null;
    const tokenIssuedAtMs = customSession.iat * 1000;
    if (
      userWithRevocation?.sessionRevokedAt &&
      tokenIssuedAtMs <= userWithRevocation.sessionRevokedAt.getTime()
    ) {
      return null;
    }

    return {
      id: userWithRevocation?.id ? String(userWithRevocation.id) : null,
      email: userWithRevocation?.email ?? customSession.email.toLowerCase(),
      name: userWithRevocation?.name ?? customSession.name ?? null,
      avatarUrl: userWithRevocation?.avatarUrl ?? null,
      isVerified: Boolean(userWithRevocation?.isVerified && userWithRevocation?.phone),
      role: (userWithRevocation?.role as 'USER' | 'ADMIN') ?? 'USER',
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // No-op for server pages.
      },
    },
  });

  let supabaseUser = null;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    supabaseUser = user;
  } catch (error) {
    if (isSupabaseRefreshTokenNotFoundError(error)) {
      return null;
    }

    return null;
  }

  if (!supabaseUser?.email) {
    return null;
  }

  const normalizedEmail = supabaseUser.email.toLowerCase();
  const supabaseAvatarUrl = getAvatarUrlFromMetadata(supabaseUser.user_metadata);
  const dbUserSelect = {
    id: true,
    email: true,
    name: true,
    avatarUrl: true,
    phone: true,
    isVerified: true,
    role: true,
  } as const;
  const dbUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: dbUserSelect as never,
  });
  const typedDbUser = dbUser as {
    id: number;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    phone: string | null;
    isVerified: boolean;
    role: 'USER' | 'ADMIN' | null;
  } | null;

  const metadataName =
    typeof supabaseUser.user_metadata?.name === "string"
      ? supabaseUser.user_metadata.name.trim()
      : null;

  if (typedDbUser && !typedDbUser.avatarUrl && supabaseAvatarUrl) {
    await prisma.user.update({
      where: { id: typedDbUser.id },
      data: {
        avatarUrl: supabaseAvatarUrl,
      },
    });
  }

  return {
    id: typedDbUser ? String(typedDbUser.id) : null,
    email: typedDbUser?.email ?? normalizedEmail,
    name: typedDbUser?.name ?? metadataName ?? null,
    avatarUrl: typedDbUser?.avatarUrl ?? supabaseAvatarUrl ?? null,
    isVerified: Boolean(typedDbUser?.isVerified && typedDbUser?.phone),
    role: typedDbUser?.role ?? 'USER',
  };
}
