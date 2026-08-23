/**
 * Fetch wrapper that automatically handles CSRF double-submit cookie tokens.
 * Import this instead of raw `fetch()` in API modules that don't use apiFetch.
 */

import { captureCsrfToken, csrfHeaders } from './csrf';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function csrfFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const needsCsrf = UNSAFE_METHODS.has(method);

  const headers = new Headers(init.headers);
  if (needsCsrf) {
    for (const [k, v] of Object.entries(csrfHeaders())) {
      headers.set(k, v);
    }
  }

  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  captureCsrfToken(res);
  return res;
}
