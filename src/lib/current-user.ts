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
};

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

    const user = sessionUserId
      ? await prisma.user.findUnique({
          where: { id: sessionUserId },
          select: { id: true, email: true, name: true, avatarUrl: true },
        })
      : await prisma.user.findUnique({
          where: { email: customSession.email.toLowerCase() },
          select: { id: true, email: true, name: true, avatarUrl: true },
        });

    return {
      id: user ? String(user.id) : null,
      email: user?.email ?? customSession.email.toLowerCase(),
      name: user?.name ?? customSession.name ?? null,
      avatarUrl: user?.avatarUrl ?? null,
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
  const dbUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });

  const metadataName =
    typeof supabaseUser.user_metadata?.name === "string"
      ? supabaseUser.user_metadata.name.trim()
      : null;

  if (dbUser && !dbUser.avatarUrl && supabaseAvatarUrl) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        avatarUrl: supabaseAvatarUrl,
      },
    });
  }

  return {
    id: dbUser ? String(dbUser.id) : null,
    email: dbUser?.email ?? normalizedEmail,
    name: dbUser?.name ?? metadataName ?? null,
    avatarUrl: dbUser?.avatarUrl ?? supabaseAvatarUrl ?? null,
  };
}
