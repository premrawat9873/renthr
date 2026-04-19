const SUPABASE_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function isIpHostname(hostname: string) {
  return /^[\d.:]+$/.test(hostname);
}

function normalizeCookieDomain(domain: string) {
  return domain.trim().replace(/^\./, '');
}

function resolveCookieDomain() {
  if (process.env.NODE_ENV !== 'production') {
    return undefined;
  }

  const explicitDomain = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (explicitDomain) {
    return normalizeCookieDomain(explicitDomain);
  }

  const configuredSiteUrl =
    process.env.SITE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    '';

  if (!configuredSiteUrl) {
    return undefined;
  }

  try {
    const hostname = new URL(configuredSiteUrl).hostname.toLowerCase();

    if (LOCALHOST_HOSTNAMES.has(hostname) || isIpHostname(hostname)) {
      return undefined;
    }

    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return undefined;
  }
}

export function getAuthCookieBaseOptions() {
  const cookieDomain = resolveCookieDomain();

  return {
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

export function getSupabaseAuthCookieOptions() {
  return {
    ...getAuthCookieBaseOptions(),
    maxAge: SUPABASE_COOKIE_MAX_AGE_SECONDS,
  };
}