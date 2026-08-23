import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection.js';

/**
 * MFA Gate Middleware
 * Enforces MFA requirement for protected endpoints
 */
export async function requireMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const db = getDb();

    // Get MFA settings
    const mfaSettings = await db`
      SELECT webauthn_required FROM mfa_settings
      WHERE user_id = ${req.user.id} LIMIT 1
    `;

    // Check if MFA is required
    if (mfaSettings.length > 0 && mfaSettings[0].webauthn_required) {
      // Check if user has proven MFA in this session
      const mfaVerified = (req as any).mfaVerified === true;

      if (!mfaVerified) {
        res.status(403).json({
          error: 'MFA verification required',
          code: 'MFA_REQUIRED',
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error('[mfaGate] Error:', error);
    res.status(500).json({ error: 'MFA verification failed' });
  }
}

/**
 * Optional MFA Check - adds flag to request if user has MFA enabled
 */
export async function optionalMFACheck(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      next();
      return;
    }

    const db = getDb();

    // Get MFA settings
    const mfaSettings = await db`
      SELECT webauthn_enabled, webauthn_required FROM mfa_settings
      WHERE user_id = ${req.user.id} LIMIT 1
    `;

    (req as any).mfaEnabled = mfaSettings.length > 0 && mfaSettings[0].webauthn_enabled;
    (req as any).mfaRequired = mfaSettings.length > 0 && mfaSettings[0].webauthn_required;

    next();
  } catch (error) {
    console.error('[optionalMFACheck] Error:', error);
    next();
  }
}

/**
 * Mark MFA as verified in session
 */
export function markMFAVerified(req: Request, _res: Response, next: NextFunction): void {
  (req as any).mfaVerified = true;
  next();
}

/**
 * Check if user has any WebAuthn credentials
 */
export async function userHasWebAuthnCredentials(userId: string): Promise<boolean> {
  const db = getDb();
  const result = await db`
    SELECT COUNT(*) as count FROM webauthn_credentials
    WHERE user_id = ${userId} AND is_active = true
  `;
  return result[0].count > 0;
}
