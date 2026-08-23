/**
 * CSRF double-submit cookie token manager.
 *
 * On the first GET response, the server sets a `csrf_token` cookie AND returns
 * the same value in the `X-CSRF-Token` response header. We cache it here so
 * every subsequent state-changing request (POST/PUT/PATCH/DELETE) can echo it
 * back in the `X-CSRF-Token` request header — satisfying the double-submit
 * cookie check on the server.
 *
 * The cached token is refreshed whenever the server sends a new one (e.g. after
 * cookie rotation on login/refresh).
 */

let cachedToken: string | null = null;

/**
 * Read the CSRF token from a response and cache it if present.
 * Call this on EVERY response (including errors) so the token stays fresh.
 */
export function captureCsrfToken(res: Response): void {
  const token = res.headers.get('x-csrf-token');
  if (token) {
    cachedToken = token;
  }
}

/**
 * Get the cached CSRF token, or read it directly from the document cookie
 * as a fallback (e.g. if no GET has been made yet in this session).
 */
export function getCsrfToken(): string | null {
  if (cachedToken) return cachedToken;

  // Fallback: read from cookie
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  if (match) {
    cachedToken = decodeURIComponent(match[1]);
    return cachedToken;
  }

  return null;
}

/**
 * Build headers object that includes the CSRF token for state-changing requests.
 * Merge with your existing headers.
 */
export function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { 'X-CSRF-Token': token } : {};
}

/**
 * Clear the cached token (e.g. on logout).
 */
export function clearCsrfToken(): void {
  cachedToken = null;
}
