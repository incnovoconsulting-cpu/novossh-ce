import express, { Request, Response } from 'express';
import { WebAuthnService } from '../services/WebAuthnService.js';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/connection.js';

const router = express.Router();
const webAuthnService = new WebAuthnService();

/**
 * GET /api/webauthn/register-options
 * Generate registration options for WebAuthn credential creation
 */
router.get('/register-options', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const db = getDb();
    const rows = await db`SELECT email FROM users WHERE id = ${req.user.id} LIMIT 1`;
    const email = rows[0]?.email ?? req.user.id;

    const options = await webAuthnService.generateRegistrationOptions(req.user.id, email);

    res.json({ options, challenge: options.challenge });
  } catch (error) {
    console.error('[webauthn] Register options failed:', error);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
});

/**
 * POST /api/webauthn/register-verify
 * Verify and store a registered credential
 */
router.post('/register-verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { response, name } = req.body;
    if (!response) {
      res.status(400).json({ error: 'response is required' });
      return;
    }

    const credential = await webAuthnService.verifyAndStoreCredential(
      req.user.id,
      req.user.organizationId,
      response,
      name,
    );

    res.status(201).json({
      id: credential.id,
      name: credential.name,
      created_at: credential.created_at,
    });
  } catch (error) {
    console.error('[webauthn] Register verify failed:', error);
    res.status(500).json({ error: 'Credential registration failed' });
  }
});

/**
 * GET /api/webauthn/credentials
 * List all WebAuthn credentials for user
 */
router.get('/credentials', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const credentials = await webAuthnService.getUserCredentials(req.user.id);

    res.json({
      credentials: credentials.map((c) => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at,
        last_used_at: c.last_used_at,
        transports: c.transports,
      })),
    });
  } catch (error) {
    console.error('[webauthn] Credentials fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

/**
 * DELETE /api/webauthn/credentials/:credentialId
 * Delete a WebAuthn credential
 */
router.delete('/credentials/:credentialId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { credentialId } = req.params;

    await webAuthnService.deleteCredential(credentialId, req.user.id);

    res.json({ message: 'Credential deleted successfully' });
  } catch (error) {
    console.error('[webauthn] Credential delete failed:', error);
    res.status(500).json({ error: 'Failed to delete credential' });
  }
});

/**
 * PUT /api/webauthn/credentials/:credentialId
 * Rename a WebAuthn credential
 */
router.put('/credentials/:credentialId', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { credentialId } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }

    const credential = await webAuthnService.renameCredential(credentialId, req.user.id, name);

    res.json({
      id: credential.id,
      name: credential.name,
    });
  } catch (error) {
    console.error('[webauthn] Credential rename failed:', error);
    res.status(500).json({ error: 'Failed to rename credential' });
  }
});

/**
 * GET /api/webauthn/mfa-settings
 * Get MFA settings for user
 */
router.get('/mfa-settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const settings = await webAuthnService.getMFASettings(req.user.id);

    res.json({
      mfaSettings: settings || {
        webauthn_enabled: false,
        webauthn_required: false,
      },
    });
  } catch (error) {
    console.error('[webauthn] MFA settings fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch MFA settings' });
  }
});

/**
 * PUT /api/webauthn/mfa-settings
 * Update MFA settings
 */
router.put('/mfa-settings', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { webauthn_enabled, webauthn_required } = req.body;

    const settings = await webAuthnService.updateMFASettings(req.user.id, {
      webauthn_enabled,
      webauthn_required,
    });

    res.json({
      webauthn_enabled: settings.webauthn_enabled,
      webauthn_required: settings.webauthn_required,
    });
  } catch (error) {
    console.error('[webauthn] MFA settings update failed:', error);
    res.status(500).json({ error: 'Failed to update MFA settings' });
  }
});

/**
 * POST /api/webauthn/backup-codes
 * Generate backup codes
 */
router.post('/backup-codes', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const codes = webAuthnService.generateBackupCodes();
    await webAuthnService.saveBackupCodes(req.user.id, codes);

    res.json({
      backupCodes: codes,
      message: 'Store these codes in a safe place. Each code can only be used once.',
    });
  } catch (error) {
    console.error('[webauthn] Backup codes generation failed:', error);
    res.status(500).json({ error: 'Failed to generate backup codes' });
  }
});

/**
 * POST /api/webauthn/verify-backup-code
 * Verify and consume a backup code
 */
router.post('/verify-backup-code', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'code is required' });
      return;
    }

    const verified = await webAuthnService.verifyBackupCode(req.user.id, code);

    if (!verified) {
      res.status(401).json({ error: 'Invalid or expired backup code' });
      return;
    }

    res.json({ verified: true });
  } catch (error) {
    console.error('[webauthn] Backup code verification failed:', error);
    res.status(500).json({ error: 'Failed to verify backup code' });
  }
});

export { router as webauthnRouter };
