type ProfilePathInput = {
  id: string | number;
  username?: string | null;
  displayName?: string | null;
  email?: string | null;
};

export const PROFILE_USERNAME_MIN_LENGTH = 3;
export const PROFILE_USERNAME_MAX_LENGTH = 30;

const PROFILE_USERNAME_PATTERN = /^(?=.*[a-z])[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toAsciiSlug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeProfileUsername(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, PROFILE_USERNAME_MAX_LENGTH)
    .replace(/^-+|-+$/g, '');

  return normalized;
}

export function getProfileUsernameValidationError(value: string) {
  if (!value) {
    return null;
  }

  if (value.length < PROFILE_USERNAME_MIN_LENGTH) {
    return `Username must be at least ${PROFILE_USERNAME_MIN_LENGTH} characters.`;
  }

  if (value.length > PROFILE_USERNAME_MAX_LENGTH) {
    return `Username must be ${PROFILE_USERNAME_MAX_LENGTH} characters or less.`;
  }

  if (!PROFILE_USERNAME_PATTERN.test(value)) {
    return 'Username can include lowercase letters, numbers, and hyphens.';
  }

  return null;
}

function parsePositiveInt(value: string | number) {
  const parsed =
    typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function resolveDisplaySlug(input: {
  displayName?: string | null;
  email?: string | null;
}) {
  const normalizedName = input.displayName?.trim() ?? '';
  if (normalizedName) {
    return toAsciiSlug(normalizedName) || 'user';
  }

  const emailPrefix = input.email?.split('@')[0]?.trim() ?? '';
  if (emailPrefix) {
    return toAsciiSlug(emailPrefix) || 'user';
  }

  return 'user';
}

export function getPublicProfilePath(input: ProfilePathInput) {
  const normalizedUsername = normalizeProfileUsername(input.username ?? '');
  if (normalizedUsername) {
    return `/profile/${normalizedUsername}`;
  }

  const id = parsePositiveInt(input.id);
  if (!id) {
    return '/profile';
  }

  const slug = resolveDisplaySlug({
    displayName: input.displayName,
    email: input.email,
  });

  return `/profile/${slug}-${id}`;
}

export function parsePublicProfileId(identifier: string | number) {
  if (typeof identifier === 'number') {
    return parsePositiveInt(identifier);
  }

  let normalized = identifier.trim();
  try {
    normalized = decodeURIComponent(normalized).trim();
  } catch {
    normalized = normalized.trim();
  }

  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    return parsePositiveInt(normalized);
  }

  const trailingIdMatch = normalized.match(/(?:^|[-_])(\d+)$/);
  if (!trailingIdMatch) {
    return null;
  }

  return parsePositiveInt(trailingIdMatch[1]);
}
