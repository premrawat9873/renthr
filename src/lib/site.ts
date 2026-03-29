const FALLBACK_SITE_URL = 'https://example.com';

export const SITE_NAME = 'Rent or Own Marketplace';
export const SITE_DESCRIPTION = 'Rent, buy, and sell trusted items in your neighborhood.';

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? FALLBACK_SITE_URL;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}
