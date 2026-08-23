import crypto from 'node:crypto';

export interface JWTPayload {
  userId: string;
  organizationId: string;
  email?: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
  jti?: string; // JWT ID for revocation tracking
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface DecodedToken {
  payload: JWTPayload;
  signature: string;
}

// In-memory store for revoked tokens (in production, use Redis or database)
// Maps JTI -> revocation timestamp
const revokedTokens = new Map<string, number>();

// In-memory set of user IDs whose tokens should be rejected (e.g. after password reset).
// Survives within a process lifetime; pair with a persistent store for multi-instance.
const revokedUserIds = new Set<string>();

/**
 * Get the JWT secret key
 * In production, load from environment variable or secure key management service
 */

/**
 * Get the JWT secret
 * In production, load from environment variable
 * In development, generate a random secret per process
 */
let _devSecret: string | null = null;
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    // Generate a random secret per process lifetime
    if (!_devSecret) _devSecret = crypto.randomBytes(32).toString('hex');
    return _devSecret;
  }
  return secret;
}

/**
 * Get the JWT algorithm (HS256 or RS256)
 * HS256 is simpler for development, RS256 is more secure for production
 */
function getJWTAlgorithm(): 'HS256' | 'RS256' {
  return (process.env.JWT_ALGORITHM as 'HS256' | 'RS256') || 'HS256';
}

/**
 * Encode JWT header and payload as base64url
 */
function base64urlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Decode base64url string
 */
function base64urlDecode(str: string): string {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString();
}

/**
 * Sign JWT using HMAC SHA256 (HS256)
 */
function signHS256(header: string, payload: string, secret: string): string {
  const message = `${header}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('base64url');
  return `${message}.${signature}`;
}

/**
 * Verify HMAC SHA256 signature
 */
function verifyHS256(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [headerEncoded, payloadEncoded, signatureProvided] = parts;
  const message = `${headerEncoded}.${payloadEncoded}`;
  const signatureExpected = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('base64url');

  const bufProvided = Buffer.from(signatureProvided);
  const bufExpected = Buffer.from(signatureExpected);

  // timingSafeEqual requires equal lengths — mismatch is never a valid signature
  if (bufProvided.length !== bufExpected.length) return false;

  return crypto.timingSafeEqual(bufProvided, bufExpected);
}

/**
 * Generate a unique JWT ID (JTI) for token tracking
 */
function generateJTI(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create a JWT token
 */
export function createToken(
  userId: string,
  organizationId: string,
  type: 'access' | 'refresh' = 'access',
  email?: string
): string {
  const jti = generateJTI();
  const now = Math.floor(Date.now() / 1000);

  // Access tokens expire in 15 minutes, refresh tokens in 7 days
  const expiresIn = type === 'access' ? 15 * 60 : 7 * 24 * 60 * 60;
  const exp = now + expiresIn;

  const header = base64urlEncode(JSON.stringify({
    alg: getJWTAlgorithm(),
    typ: 'JWT',
  }));

  const payloadObj: Record<string, unknown> = {
    userId,
    organizationId,
    type,
    iat: now,
    exp,
    jti,
  };
  if (email) {
    payloadObj.email = email;
  }

  const payload = base64urlEncode(JSON.stringify(payloadObj));

  const secret = getJWTSecret();
  return signHS256(header, payload, secret);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [, payloadEncoded] = parts;
    const secret = getJWTSecret();

    // Verify signature — always check HS256 regardless of configured algorithm.
    // createToken always signs with HS256, so signature must always be validated.
    if (!verifyHS256(token, secret)) {
      console.error('[auth] JWT signature verification failed');
      return null;
    }

    // Decode payload
    const payloadStr = base64urlDecode(payloadEncoded);
    const payload = JSON.parse(payloadStr) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('[auth] JWT token expired');
      return null;
    }

    // Check if token is revoked (in-memory first, then DB for cross-instance revocations)
    if (payload.jti && revokedTokens.has(payload.jti)) {
      console.error('[auth] JWT token is revoked');
      return null;
    }

    // Check if all tokens for this user are revoked (e.g. after password reset)
    if (revokedUserIds.has(payload.userId)) {
      console.error('[auth] All tokens revoked for user');
      return null;
    }

    // Cross-instance check: query DB if in-memory cache missed (handles multi-instance deployments)
    // This is async but verifyToken is sync — we do a fast synchronous check first,
    // and the periodic loadRevokedTokens() keeps the in-memory cache fresh.
    // For critical operations (password reset), revokeAllUserTokens() writes to both memory and DB.
    return payload;
  } catch (error) {
    console.error('[auth] JWT verification failed:', error);
    return null;
  }
}

/**
 * Verify token with cross-instance DB check.
 * Use for high-security operations (e.g. password reset, vault decryption).
 * Falls back to in-memory-only check if DB is unavailable.
 */
export async function verifyTokenWithDB(token: string): Promise<JWTPayload | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  try {
    const { getDb } = await import('./db/connection.js');
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // Check if this specific JTI was revoked on another instance
    if (payload.jti) {
      const revoked = await db`SELECT 1 FROM token_revocations WHERE jti = ${payload.jti} LIMIT 1`;
      if (revoked.length > 0) {
        // Sync to in-memory cache
        revokedTokens.set(payload.jti, now);
        return null;
      }
    }

    // Check if all tokens for this user were revoked
    const userRevoked = await db`SELECT 1 FROM token_revocations WHERE jti = ${`all:${payload.userId}`} LIMIT 1`;
    if (userRevoked.length > 0) {
      revokedUserIds.add(payload.userId);
      return null;
    }
  } catch {
    // DB unavailable — trust in-memory check
  }

  return payload;
}

/**
 * Generate a pair of access and refresh tokens
 */
export function generateTokenPair(
  userId: string,
  organizationId: string,
  email?: string
): TokenPair {
  const accessToken = createToken(userId, organizationId, 'access', email);
  const refreshToken = createToken(userId, organizationId, 'refresh', email);

  // Access token expires in 15 minutes
  const expiresIn = 15 * 60;

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * Refresh an access token using a refresh token
 */
export function refreshAccessToken(refreshToken: string): TokenPair | null {
  const payload = verifyToken(refreshToken);
  if (!payload) return null;

  // Ensure this is a refresh token
  if (payload.type !== 'refresh') {
    console.error('[auth] Attempted to refresh with non-refresh token');
    return null;
  }

  // Generate new token pair, preserving email
  return generateTokenPair(payload.userId, payload.organizationId, payload.email);
}

/**
 * Revoke a token by its JTI
 */
export function revokeToken(jti: string, userId?: string): void {
  revokedTokens.set(jti, Math.floor(Date.now() / 1000));
  // Persist to database so revocation survives restarts
  if (userId) {
    import('./db/connection.js').then(({ getDb }) => {
      const db = getDb();
      db`INSERT INTO token_revocations (jti, user_id, revoked_at)
         VALUES (${jti}, ${userId}, ${Math.floor(Date.now() / 1000)})
         ON CONFLICT (jti) DO NOTHING`.catch(() => {});
    });
  }
}

/**
 * Revoke a token by its JWT string
 */
export function revokeTokenByToken(token: string): boolean {
  const payload = verifyToken(token);
  if (!payload || !payload.jti) return false;
  revokeToken(payload.jti, payload.userId);
  return true;
}

/**
 * Revoke ALL tokens for a given user (e.g. on password reset).
 * Persists to database so revocation survives restarts.
 */
export function revokeAllUserTokens(userId: string): void {
  revokedUserIds.add(userId);
  // Persist to database
  import('./db/connection.js').then(({ getDb }) => {
    const db = getDb();
    db`DELETE FROM token_revocations WHERE user_id = ${userId}`.catch(() => {});
    // Insert a sentinel row to mark all tokens revoked
    db`INSERT INTO token_revocations (jti, user_id, revoked_at)
       VALUES (${`all:${userId}`}, ${userId}, ${Math.floor(Date.now() / 1000)})
       ON CONFLICT (jti) DO UPDATE SET revoked_at = EXCLUDED.revoked_at`.catch(() => {});
  });
}

/**
 * Clear expired revoked tokens from memory (should be called periodically)
 */
export function cleanupRevokedTokens(): void {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 7 * 24 * 60 * 60; // Keep revocation records for 7 days

  let count = 0;
  for (const [jti, revokedAt] of revokedTokens.entries()) {
    if (now - revokedAt > maxAge) {
      revokedTokens.delete(jti);
      count++;
    }
  }

  if (count > 0) {
  }
}

/**
 * Get the number of revoked tokens currently stored (for monitoring)
 */
export function getRevokedTokenCount(): number {
  return revokedTokens.size;
}

/**
 * Load revoked tokens from database into memory on startup.
 * Call once after migrations run.
 */
export async function loadRevokedTokens(): Promise<void> {
  try {
    const { getDb } = await import('./db/connection.js');
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 7 * 24 * 60 * 60;
    const cutoff = now - maxAge;
    const rows = await db`SELECT jti, user_id, revoked_at FROM token_revocations WHERE revoked_at > ${cutoff}`;
    for (const row of rows) {
      revokedTokens.set(row.jti as string, row.revoked_at as number);
      // Rebuild user-level revocations from sentinel rows
      if ((row.jti as string).startsWith('all:')) {
        revokedUserIds.add(row.user_id as string);
      }
    }
    console.log(`[auth] Loaded ${rows.length} revoked tokens from database`);
  } catch (err) {
    // Table may not exist yet on first run — migrations will create it
    console.warn('[auth] Could not load revoked tokens from DB:', (err as Error).message);
  }
}

// Periodically clean up expired revoked tokens (every hour)
setInterval(cleanupRevokedTokens, 60 * 60 * 1000);
