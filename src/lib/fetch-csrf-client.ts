import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf-constants';

export function patchFetchWithCsrf() {
  if (typeof window === 'undefined') return;
  const win = window as Window & { __fetchPatchedWithCsrf?: boolean };
  if (win.__fetchPatchedWithCsrf) return;
  win.__fetchPatchedWithCsrf = true;

  const origFetch = window.fetch.bind(window);

  const patchedFetch: typeof window.fetch = async (input: URL | RequestInfo, init?: RequestInit) => {
    try {
      const method =
        (
          init?.method ||
          (typeof input === 'string' || input instanceof URL ? 'GET' : input.method) ||
          'GET'
        ).toUpperCase();
      const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      if (mutating) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const resolved = new URL(url, window.location.origin);
        if (resolved.origin === window.location.origin) {
          const match = document.cookie.match(new RegExp('(?:^|; )' + CSRF_COOKIE_NAME + '=([^;]+)'));
          const token = match?.[1];
          if (token) {
            init = init || {};
            init.headers = {
              ...(init.headers as Record<string, string> | undefined),
              [CSRF_HEADER_NAME]: token,
            } as Record<string, string>;
          }
        }
      }
    } catch {
      // Best-effort only
    }

    return origFetch(input, init);
  };

  window.fetch = patchedFetch;
}

export default patchFetchWithCsrf;
