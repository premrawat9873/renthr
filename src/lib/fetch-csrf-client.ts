import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf-constants';

export function patchFetchWithCsrf() {
  if (typeof window === 'undefined') return;
  const win = window as any;
  if (win.__fetchPatchedWithCsrf) return;
  win.__fetchPatchedWithCsrf = true;

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo, init?: RequestInit) => {
    try {
      const method = ((init && init.method) || (typeof input === 'string' ? 'GET' : (input as Request).method) || 'GET').toUpperCase();
      const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      if (mutating) {
        const url = typeof input === 'string' ? input : (input as Request).url;
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
    } catch (e) {
      // Best-effort only
    }

    return origFetch(input, init);
  };
}

export default patchFetchWithCsrf;
