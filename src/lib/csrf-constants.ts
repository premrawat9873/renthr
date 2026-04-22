export const CSRF_COOKIE_NAME = 'rk_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutatingMethod(method: string) {
  return MUTATING_METHODS.has(method.toUpperCase());
}