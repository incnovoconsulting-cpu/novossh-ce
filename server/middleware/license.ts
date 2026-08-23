import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Verify license key format and HMAC signature.
 * License key format: NOVO-XXXX-XXXX-XXXX-XXXX-SIGNATURE
 * The last segment is an HMAC-SHA256 of the first four segments, keyed with LICENSE_HMAC_SECRET.
 */
function verifyLicenseKey(key: string): boolean {
  if (!key || !key.startsWith('NOVO-')) return false;

  const parts = key.split('-');
  // Accept legacy 5-part format (format-only) OR new 6-part format (signed)
  if (parts.length === 5) {
    // Legacy format-only check — only valid in non-production
    if (process.env.NODE_ENV === 'production') return false;
    for (let i = 1; i < 5; i++) {
      if (!/^[A-Z0-9]{4}$/.test(parts[i])) return false;
    }
    return true;
  }

  if (parts.length !== 6) return false;
  if (parts[0] !== 'NOVO') return false;

  // Each of the first 4 segments should be 4 alphanumeric characters
  for (let i = 1; i < 5; i++) {
    if (!/^[A-Z0-9]{4}$/.test(parts[i])) return false;
  }

  // Verify HMAC signature
  const secret = process.env.LICENSE_HMAC_SECRET;
  if (!secret) {
    // No secret configured — cannot verify signature
    return false;
  }

  const payload = parts.slice(0, 5).join('-');
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  return parts[5] === expectedSig;
}

/**
 * License middleware - requires valid license key in env or request
 * Skips check for health endpoint and local development
 */
export function requireLicense(req: Request, res: Response, next: NextFunction): void {
  // Skip for health checks
  if (req.path === '/api/health' || req.path === '/api/auth/health') {
    next();
    return;
  }

  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  // Check server license key from env
  const serverLicense = process.env.NOVOSSH_LICENSE_KEY;
  if (serverLicense && verifyLicenseKey(serverLicense)) {
    next();
    return;
  }

  // Check license from request header (for customers)
  const requestLicense = req.headers['x-license-key'] as string;
  if (requestLicense && verifyLicenseKey(requestLicense)) {
    next();
    return;
  }

  res.status(403).json({
    error: 'License required',
    message: 'This NovoSSH Terminal instance requires a valid license key. Contact sales@novoconsultinginc.org',
  });
}
