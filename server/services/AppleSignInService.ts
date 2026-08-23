import crypto from 'node:crypto';

const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';

interface AppleJWK {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface ApplePayload {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  email_verified?: boolean | string;
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

let cachedKeys: { keys: AppleJWK[]; fetchedAt: number } | null = null;
const KEYS_CACHE_MS = 60 * 60 * 1000; // 1 hour

async function getApplePublicKeys(): Promise<AppleJWK[]> {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < KEYS_CACHE_MS) {
    return cachedKeys.keys;
  }
  const res = await fetch(APPLE_KEYS_URL);
  if (!res.ok) throw new Error('Failed to fetch Apple public keys');
  const data = (await res.json()) as { keys: AppleJWK[] };
  cachedKeys = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

/**
 * Verifies a "Sign in with Apple" identity token (JWT, RS256) against Apple's
 * published JWKS, validating signature, issuer, audience, and expiry.
 * Returns the decoded payload (sub = Apple's stable per-app user id, email).
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  expectedAudience: string
): Promise<ApplePayload> {
  const parts = identityToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed identity token');
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = JSON.parse(base64UrlDecode(headerB64).toString('utf8')) as { kid: string; alg: string };
  const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as ApplePayload;

  const keys = await getApplePublicKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('No matching Apple public key found');

  const publicKey = crypto.createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' });
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  const signatureValid = verifier.verify(publicKey, base64UrlDecode(signatureB64));
  if (!signatureValid) throw new Error('Invalid identity token signature');

  if (payload.iss !== APPLE_ISSUER) throw new Error('Invalid token issuer');
  if (payload.aud !== expectedAudience) throw new Error('Invalid token audience');
  if (payload.exp * 1000 < Date.now()) throw new Error('Identity token expired');

  return payload;
}
