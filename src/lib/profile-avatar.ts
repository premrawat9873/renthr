export const LOCAL_DEFAULT_PROFILE_AVATAR_URL = "/images/default-avatar.svg";
export const DEFAULT_PROFILE_AVATAR_STORAGE_KEY = "assets/default-profile-avatar.svg";

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

export function normalizeAvatarUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("/")) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export function getAvatarUrlFromMetadata(userMetadata: unknown) {
  if (!userMetadata || typeof userMetadata !== "object") {
    return null;
  }

  const metadata = userMetadata as Record<string, unknown>;
  return (
    normalizeAvatarUrl(metadata.avatar_url) ??
    normalizeAvatarUrl(metadata.picture) ??
    normalizeAvatarUrl(metadata.avatarUrl)
  );
}

export function getDefaultProfileAvatarUrl() {
  const serverExplicitUrl =
    typeof window === "undefined"
      ? normalizeAvatarUrl(process.env.DEFAULT_PROFILE_AVATAR_URL)
      : null;
  const explicitUrl =
    serverExplicitUrl ??
    normalizeAvatarUrl(process.env.NEXT_PUBLIC_DEFAULT_PROFILE_AVATAR_URL);

  if (explicitUrl) {
    return explicitUrl;
  }

  const serverR2BaseUrl =
    typeof window === "undefined"
      ? normalizeAvatarUrl(process.env.R2_PUBLIC_URL)
      : null;
  const r2BaseUrl =
    serverR2BaseUrl ?? normalizeAvatarUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);

  if (r2BaseUrl && !r2BaseUrl.startsWith("/")) {
    return new URL(
      DEFAULT_PROFILE_AVATAR_STORAGE_KEY,
      ensureTrailingSlash(r2BaseUrl)
    ).toString();
  }

  return LOCAL_DEFAULT_PROFILE_AVATAR_URL;
}

export function resolveProfileAvatarUrl(value: unknown) {
  return normalizeAvatarUrl(value) ?? getDefaultProfileAvatarUrl();
}
