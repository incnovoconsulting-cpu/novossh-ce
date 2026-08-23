import express, { Request, Response } from 'express';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { EmailVerificationService } from '../services/EmailVerificationService.js';
import { getDb } from '../db/connection.js';

const router = express.Router();
const emailVerificationService = new EmailVerificationService();

/**
 * POST /api/auth/verify-email
 * Send a 6-digit verification code to the authenticated user's email
 */
router.post('/verify-email', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authUser = getUser(req);
    const userId = authUser.id;
    const db = getDb();

    const rows = await db`
      SELECT id, email, email_verified FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = rows[0];
    if (user.email_verified) {
      res.status(400).json({ error: 'Email is already verified' });
      return;
    }

    if (!emailVerificationService.isEnabled()) {
      res.status(503).json({ error: 'Email service not configured' });
      return;
    }

    const result = await emailVerificationService.sendVerificationCode(userId, user.email);

    if (!result.success) {
      res.status(429).json({
        error: result.error,
        ...(result.retryAfter && { retryAfter: result.retryAfter }),
      });
      return;
    }

    res.status(200).json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('[emailVerification] Send code failed:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

/**
 * POST /api/auth/verify-email/confirm
 * Confirm a verification code
 */
router.post('/verify-email/confirm', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authUser = getUser(req);
    const userId = authUser.id;
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Verification code is required' });
      return;
    }

    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Code must be 6 digits' });
      return;
    }

    const result = await emailVerificationService.confirmCode(userId, code);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('[emailVerification] Confirm code failed:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

/**
 * GET /api/auth/verify-email/status
 * Check verification status for the authenticated user
 */
router.get('/verify-email/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authUser = getUser(req);
    const userId = authUser.id;

    const status = await emailVerificationService.getStatus(userId);

    res.status(200).json(status);
  } catch (error) {
    console.error('[emailVerification] Get status failed:', error);
    res.status(500).json({ error: 'Failed to get verification status' });
  }
});

export { router as emailVerificationRouter };
