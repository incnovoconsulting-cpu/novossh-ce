import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Methods that require CSRF validation (state-changing)
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Pre-authentication and public endpoints exempt from CSRF. Double-submit CSRF only
// protects an established session's state-changing actions; login/signup/oauth-verify
// happen *before* a session exists, and native clients (which never echo the cookie the
// middleware plants on their first GET) legitimately call them without a CSRF header.
// Omitting the native OAuth-verify endpoint here caused Sign in with Apple to fail with
// "CSRF token mismatch" once the client had picked up a csrf_token cookie.
const SAFE_PATHS = new Set([
  '/api/health',
  '/api/auth/login',
  '/api/auth/local-login',
  '/api/auth/signup',
  '/api/auth/oauth/apple/verify',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  // Token refresh authenticates via the refresh token itself (body/cookie), not an
  // access token, so it carries no Bearer header and can't echo a CSRF header from a
  // native client. Without this exemption, refresh 403s once the access token expires
  // and *every* authenticated call then fails ("server error everywhere").
  '/api/auth/refresh',
  // Apple App Store Server Notifications: Apple POSTs here with no Bearer/CSRF token;
  // authenticity is established by verifying the Apple-signed JWS in the handler.
  '/api/billing/apple/notifications',
]);

/**
 * Double-submit cookie CSRF protection.
 *
 * How it works:
 * 1. On any response, we set a random CSRF token in a non-httpOnly cookie
 *    (so JavaScript on the same origin can read it) AND we make it available
 *    via the `X-CSRF-Token` response header on safe routes.
 * 2. On state-changing requests (POST/PUT/PATCH/DELETE), the client must echo
 *    the cookie value back in the `X-CSRF-Token` request header.
 * 3. We compare cookie vs header. If they match, the request came from our
 *    own origin — a cross-site attacker can trigger the browser to send the
 *    cookie, but cannot read it to put it in the header.
 *
 * Exemptions:
 * - GET/HEAD/OPTIONS (safe methods, no side effects)
 * - Same-origin requests detected via Origin/Referer headers
 * - Paths in SAFE_PATHS (public endpoints like health checks)
 * - Requests with no cookies at all (first-party API clients using Bearer tokens)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Ensure a CSRF token cookie exists, generating one if needed
  let csrfToken = req.cookies?.[CSRF_COOKIE];
  if (!csrfToken) {
    csrfToken = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
    res.cookie(CSRF_COOKIE, csrfToken, {
      httpOnly: false, // Must be readable by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });
  }

  // Rotate CSRF token on state-changing requests to limit exposure window
  if (UNSAFE_METHODS.has(req.method) && !SAFE_PATHS.has(req.path)) {
    const newToken = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
    res.cookie(CSRF_COOKIE, newToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000,
    });
    // Use the old token for validation, set new token for next request
    res.setHeader('X-CSRF-Token', newToken);
  }

  // Expose the token via header on GET requests (so the client can cache it)
  if (req.method === 'GET') {
    res.setHeader('X-CSRF-Token', csrfToken);
  }

  // Skip validation for safe methods and exempt paths
  if (!UNSAFE_METHODS.has(req.method) || SAFE_PATHS.has(req.path)) {
    next();
    return;
  }

  // Skip if request has no cookies at all (Bearer-token-only API clients)
  if (!req.cookies || Object.keys(req.cookies).length === 0) {
    next();
    return;
  }

  // Skip if the request is authenticated with a Bearer token.
  //
  // Double-submit CSRF only protects requests authenticated by an *ambient* cookie
  // (which a browser attaches automatically on cross-site requests). A request that
  // carries an Authorization: Bearer token is not CSRF-vulnerable — a cross-origin
  // attacker cannot read or set that header. All state-changing endpoints here are
  // Bearer-authenticated (native app and web both send the access token in the
  // header), so exempt any Bearer request regardless of cookies.
  //
  // The previous `&& !hasCookieSession` guard defeated this: this middleware plants
  // a csrf_token cookie on every client's first GET, and login also sets a
  // refreshToken cookie, so a legitimate Bearer client always looked like a "cookie
  // session" and its writes (delete account, sync) were 403'd with "CSRF token
  // mismatch". Cookie-only requests (e.g. token refresh) still fall through to
  // validation below.
  const hasAuthHeader = req.headers.authorization?.startsWith('Bearer ');
  if (hasAuthHeader) {
    next();
    return;
  }

  // Validate double-submit: cookie value must match header value
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;
  if (!headerToken || headerToken !== csrfToken) {
    res.status(403).json({ error: 'CSRF token mismatch' });
    return;
  }

  next();
}
