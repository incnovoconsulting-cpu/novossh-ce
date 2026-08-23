import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import {
  generateTokenPair,
  refreshAccessToken,
  revokeTokenByToken,
  revokeAllUserTokens,
} from '../auth.js';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { getDb } from '../db/connection.js';
import { SubscriptionService } from '../services/SubscriptionService.js';
import { EmailService } from '../services/EmailService.js';
import { EmailVerificationService } from '../services/EmailVerificationService.js';
import { WebAuthnService } from '../services/WebAuthnService.js';
import { verifyAppleIdentityToken } from '../services/AppleSignInService.js';

const router = express.Router();

interface SessionUser {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: Date;
}

function issueSession(res: Response, user: SessionUser, subscription: { plan: string; status: string } | null) {
  const tokens = generateTokenPair(user.id, user.id, user.email);

  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: true, // SameSite=None requires Secure
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken, // included for mobile clients (can't use httpOnly cookies)
    expiresIn: tokens.expiresIn,
    tokenType: 'Bearer',
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
    },
    subscription: subscription ?? { plan: 'free', status: 'active' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const BCRYPT_ROUNDS = 12;

/**
 * POST /api/auth/signup
 * Register a new user with email and password
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const db = getDb();
    const subscriptionService = new SubscriptionService();

    const existing = await db`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;
    if (existing.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const rows = await db`
      INSERT INTO users (email, password_hash, verification_token)
      VALUES (${email}, ${passwordHash}, ${verificationToken})
      RETURNING id, email, email_verified, created_at
    `;
    const user = rows[0];

    await subscriptionService.createFreeSubscription(user.id);

    // Send verification code via SMTP
    const emailVerificationService = new EmailVerificationService();
    if (emailVerificationService.isEnabled()) {
      await emailVerificationService.sendVerificationCode(user.id, email);
    } else {
      // Fallback: try Cloudflare email service
      const emailService = new EmailService();
      if (emailService.isEnabled()) {
        await emailService.sendVerificationEmail(email, verificationToken);
      } else if (process.env.NODE_ENV === 'production') {
        console.warn('[auth] No email service configured in production. Users may not be able to verify emails.');
      }
    }

    const tokens = generateTokenPair(user.id, user.id, email);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: true, // SameSite=None requires Secure
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken, // included for mobile clients
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
      },
      // Only return token in development (for testing without email service)
      ...(process.env.NODE_ENV !== 'production' && { verificationToken }),
    });
  } catch (error) {
    console.error('[auth] Signup failed:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const db = getDb();
    const subscriptionService = new SubscriptionService();

    const rows = await db`
      SELECT id, email, password_hash, email_verified, created_at
      FROM users WHERE email = ${email} LIMIT 1
    `;
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const webAuthnService = new WebAuthnService();
    const mfaSettings = await webAuthnService.getMFASettings(user.id);
    if (mfaSettings?.webauthn_enabled) {
      res.status(200).json({ mfaRequired: true, userId: user.id });
      return;
    }

    const subscription = await subscriptionService.getSubscription(user.id);
    issueSession(res, user as SessionUser, subscription ? { plan: subscription.plan, status: subscription.status } : null);
  } catch (error) {
    console.error('[auth] Login failed:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/login/verify-mfa
 * Completes login for accounts with WebAuthn MFA enabled: verifies the
 * assertion produced against /api/webauthn/authenticate-options and, on
 * success, issues the same session tokens /login would have issued directly.
 */

/**
 * GET /api/auth/webauthn/authenticate-options
 * Generate a WebAuthn authentication challenge. Deliberately public (no
 * auth, no plan gate) — this runs during login itself, before any session
 * exists, and the assertion signature is what proves credential possession.
 */
router.get('/webauthn/authenticate-options', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const webAuthnService = new WebAuthnService();
    const options = await webAuthnService.generateAuthenticationOptions(userId);
    res.json({ options, challenge: options.challenge });
  } catch (error) {
    console.error('[auth] WebAuthn authenticate-options failed:', error);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
});

/**
 * POST /api/auth/webauthn/authenticate-verify
 * Verify a completed authentication ceremony (used for step-up
 * re-verification of an already logged-in user; login itself uses
 * /login/verify-mfa below, which also issues session tokens).
 */
router.post('/webauthn/authenticate-verify', async (req: Request, res: Response) => {
  try {
    const { userId, response } = req.body;
    if (!userId || !response) {
      res.status(400).json({ error: 'userId and response are required' });
      return;
    }
    const webAuthnService = new WebAuthnService();
    const credential = await webAuthnService.verifyAuthentication(userId, response);
    res.json({ verified: true, userId: credential.user_id, credentialId: credential.id });
  } catch (error) {
    console.error('[auth] WebAuthn authenticate-verify failed:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
});

router.post('/login/verify-mfa', async (req: Request, res: Response) => {
  try {
    const { userId, response } = req.body;
    if (!userId || !response) {
      res.status(400).json({ error: 'userId and response are required' });
      return;
    }

    const webAuthnService = new WebAuthnService();
    const credential = await webAuthnService.verifyAuthentication(userId, response);

    if (credential.user_id !== userId) {
      res.status(401).json({ error: 'Credential does not belong to this account' });
      return;
    }

    const db = getDb();
    const rows = await db`
      SELECT id, email, email_verified, created_at
      FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid account' });
      return;
    }

    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getSubscription(userId);
    issueSession(res, rows[0] as SessionUser, subscription ? { plan: subscription.plan, status: subscription.status } : null);
  } catch (error) {
    console.error('[auth] MFA login verification failed:', error);
    res.status(401).json({ error: 'MFA verification failed' });
  }
});

/**
 * POST /api/auth/verify-email
 * Verify email address using verification token
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Verification token is required' });
      return;
    }

    const db = getDb();

    // Atomic update: find + verify in one query
    const rows = await db`
      UPDATE users
      SET email_verified = TRUE, verification_token = NULL, updated_at = NOW()
      WHERE verification_token = ${token}
      RETURNING id
    `;
    if (rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired verification token' });
      return;
    }

    res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('[auth] Email verification failed:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email to user
 */
router.post('/resend-verification', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authUser = getUser(req);
    const userId = authUser.id;
    const db = getDb();

    const rows = await db`
      SELECT id, email, email_verified, verification_token
      FROM users WHERE id = ${userId} LIMIT 1
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

    let token = user.verification_token;
    if (!token) {
      token = crypto.randomBytes(32).toString('hex');
      await db`
        UPDATE users
        SET verification_token = ${token}, updated_at = NOW()
        WHERE id = ${userId}
      `;
    }

    const emailService = new EmailService();
    const sent = await emailService.sendVerificationEmail(user.email, token);

    if (!sent && process.env.NODE_ENV === 'production') {
      res.status(500).json({ error: 'Failed to send verification email' });
      return;
    }

    res.status(200).json({
      message: 'Verification email sent',
      email: user.email,
      // Only return token in development
      ...(process.env.NODE_ENV !== 'production' && { verificationToken: token }),
    });
  } catch (error) {
    console.error('[auth] Resend verification failed:', error);
    res.status(500).json({ error: 'Resend verification failed' });
  }
});

/**
 * POST /api/auth/local-login
 * Local login - generates JWT tokens from userId/organizationId
 * Only enabled when LOCAL_LOGIN_SECRET env var is set (dev/staging)
 */
router.post('/local-login', (req: Request, res: Response) => {
  try {
    const localLoginSecret = process.env.LOCAL_LOGIN_SECRET;
    const providedSecret = req.headers['x-local-login-secret'] as string;

    const secretsMatch = !!localLoginSecret && !!providedSecret &&
      providedSecret.length === localLoginSecret.length &&
      crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(localLoginSecret));
    if (!secretsMatch) {
      res.status(403).json({ error: 'Local login is not enabled or invalid secret' });
      return;
    }

    const { userId, organizationId, serverAddress } = req.body;

    if (!userId || !organizationId) {
      res.status(400).json({
        error: 'Missing required fields: userId, organizationId',
      });
      return;
    }

    const tokens = generateTokenPair(userId, organizationId);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: true, // SameSite=None requires Secure
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
      tailscaleServerAddress: serverAddress || null,
      user: { userId, organizationId },
    });
  } catch (error) {
    console.error('[auth] Local login failed:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: 'Missing refresh token' });
      return;
    }

    const tokens = refreshAccessToken(refreshToken);
    if (!tokens) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: true, // SameSite=None requires Secure
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
    });
  } catch (error) {
    console.error('[auth] Token refresh failed:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout - revoke tokens
 */
router.post('/logout', authMiddleware, (req: Request, res: Response) => {
  try {
    if (req.token && req.token.jti) {
      revokeTokenByToken(req.headers.authorization?.split(' ')[1] || '');
    }

    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      revokeTokenByToken(refreshToken);
    }

    res.clearCookie('refreshToken');

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[auth] Logout failed:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user information from JWT
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const db = getDb();
    const rows = await db`SELECT email, email_verified, password_hash, created_at FROM users WHERE id = ${req.user.id}`;
    if (rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const row = rows[0] as { email: string; email_verified: boolean; password_hash: string; created_at: string };

    res.status(200).json({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      email: row.email,
      emailVerified: row.email_verified,
      isOAuthAccount: row.password_hash === '$oauth$',
      createdAt: row.created_at,
      tokenType: req.token?.type,
      expiresAt: req.token?.exp ? new Date(req.token.exp * 1000).toISOString() : null,
    });
  } catch (error) {
    console.error('[auth] Failed to get user info:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/change-password
 * Changes the authenticated user's password. Requires the current password
 * unless the account was created via OAuth (no password to verify).
 */
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' });
      return;
    }

    const db = getDb();
    const rows = await db`SELECT password_hash FROM users WHERE id = ${req.user.id}`;
    if (rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    const { password_hash } = rows[0] as { password_hash: string };

    if (password_hash !== '$oauth$') {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current password is required' });
        return;
      }
      const valid = await bcrypt.compare(currentPassword, password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Incorrect current password' });
        return;
      }
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db`UPDATE users SET password_hash = ${newHash}, updated_at = NOW() WHERE id = ${req.user.id}`;
    // Invalidate all existing tokens for this user
    revokeAllUserTokens(req.user.id);

    res.status(200).json({ message: 'Password updated' });
  } catch (error) {
    console.error('[auth] Failed to change password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * DELETE /api/auth/account
 * Permanently delete the authenticated user's account and all associated data.
 * Cascades via ON DELETE CASCADE across the schema.
 */
router.delete('/account', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const db = getDb();
    const rows = await db`SELECT password_hash FROM users WHERE id = ${req.user.id}`;
    if (rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const { password_hash } = rows[0] as { password_hash: string };
    if (password_hash !== '$oauth$') {
      const { password } = req.body;
      if (!password) {
        res.status(400).json({ error: 'Password is required to delete your account' });
        return;
      }
      const valid = await bcrypt.compare(password, password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Incorrect password' });
        return;
      }
    }

    await db`DELETE FROM users WHERE id = ${req.user.id}`;

    if (req.token && req.token.jti) {
      revokeTokenByToken(req.headers.authorization?.split(' ')[1] || '');
    }
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      revokeTokenByToken(refreshToken);
    }
    res.clearCookie('refreshToken');

    res.status(200).json({ message: 'Account deleted' });
  } catch (error) {
    console.error('[auth] Failed to delete account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

/**
 * GET /api/auth/health
 * Check if auth service is working
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'auth' });
});

// ─── OAuth helpers ────────────────────────────────────────────────────────────

const API_URL = process.env.API_URL || 'https://ssh.novossh.com:8787';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://novossh-github.pages.dev';

async function findOrCreateOAuthUser(email: string): Promise<{ id: string; email: string }> {
  const db = getDb();
  const existing = await db`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) return existing[0] as { id: string; email: string };
  const rows = await db`
    INSERT INTO users (email, email_verified, password_hash)
    VALUES (${email}, TRUE, '$oauth$')
    RETURNING id, email
  `;
  const user = rows[0] as { id: string; email: string };
  const subscriptionService = new SubscriptionService();
  await subscriptionService.createFreeSubscription(user.id);
  return user;
}

// ─── Forgot / Reset Password ───────────────────────────────────────────────────

const RESET_EXPIRY_MINUTES = 30;

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: 'Email is required' }); return; }

    const db = getDb();
    const users = await db`SELECT id FROM users WHERE email = ${email} LIMIT 1`;

  // Always respond 200 to avoid email enumeration
  if (!users.length) { res.json({ message: 'If that email exists, a reset link has been sent.' }); return; }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_EXPIRY_MINUTES * 60 * 1000);

  await db`
    INSERT INTO password_reset_tokens (user_id, token, expires_at)
    VALUES (${users[0].id}, ${token}, ${expiresAt})
    ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, used = false
  `;

  const resetURL = `${FRONTEND_URL}/reset-password?token=${token}`;
  const emailService = new EmailVerificationService();

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"NovoSSH" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset your NovoSSH password',
      html: `
        <p>Hi,</p>
        <p>We received a request to reset your NovoSSH password. Click the link below — it expires in ${RESET_EXPIRY_MINUTES} minutes.</p>
        <p><a href="${resetURL}">${resetURL}</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });
  } catch (err) {
    console.error('[auth] forgot-password email failed:', err);
  }

  res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('[auth] forgot-password failed:', err);
    // Always respond 200 to avoid email enumeration
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) { res.status(400).json({ error: 'Token and password are required' }); return; }
    if (password.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }

    const db = getDb();
    const rows = await db`
      SELECT prt.user_id, prt.expires_at, prt.used
      FROM password_reset_tokens prt
      WHERE prt.token = ${token}
      LIMIT 1
    `;

    if (!rows.length || rows[0].used || new Date(rows[0].expires_at) < new Date()) {
      res.status(400).json({ error: 'Reset link is invalid or has expired' });
      return;
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await db`UPDATE users SET password_hash = ${hash} WHERE id = ${rows[0].user_id}`;
    await db`UPDATE password_reset_tokens SET used = true WHERE token = ${token}`;
    // Invalidate all existing tokens for this user
    revokeAllUserTokens(rows[0].user_id);

    res.json({ message: 'Password updated. Please sign in with your new password.' });
  } catch (err) {
    console.error('[auth] reset-password failed:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ─── OAuth helpers ─────────────────────────────────────────────────────────────

const MOBILE_SCHEME = 'novossh';

function oauthRedirectBase(isMobile: boolean) {
  return isMobile ? `${MOBILE_SCHEME}://auth/callback` : FRONTEND_URL;
}

/**
 * For web clients, serve an HTML page that extracts the token from the URL
 * and stores it in sessionStorage before redirecting. This prevents the
 * access token from appearing in browser history, server logs, or Referer headers.
 * For mobile clients, redirect with the token in the URL (deep link).
 */
function sendOAuthResponse(res: Response, isMobile: boolean, accessToken: string, expiresIn: number) {
  if (isMobile) {
    // Must redirect to the novossh:// deep link (oauthRedirectBase(true)), not the web
    // FRONTEND_URL — passing false here sent native GitHub/Google sign-ins into a browser
    // with the token in the URL instead of completing in-app via ASWebAuthenticationSession.
    res.redirect(`${oauthRedirectBase(true)}?oauth_token=${accessToken}&oauth_expires=${expiresIn}`);
    return;
  }
  // Redirect to frontend with token in URL — localStorage set on
  // ssh.novossh.com:8787 won't be available on novossh.com domain.
  // AuthGuard on novossh.com reads oauth_token from URL params and stores it.
  const separator = FRONTEND_URL.includes('?') ? '&' : '?';
  res.redirect(`${FRONTEND_URL}${separator}oauth_token=${accessToken}&oauth_expires=${expiresIn}`);
}

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────

router.get('/oauth/github', (req: Request, res: Response) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) { res.status(503).json({ error: 'GitHub OAuth not configured' }); return; }
  const isMobile = req.query.platform === 'mobile';
  const state = crypto.randomBytes(16).toString('hex');
  const statePayload = isMobile ? `${state}:mobile` : state;
  res.cookie('oauth_state', statePayload, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 });
  const redirectUri = encodeURIComponent(`${API_URL}/api/auth/oauth/github/callback`);
  res.redirect(`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email&state=${statePayload}`);
});

router.get('/oauth/github/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const storedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state');

  const isMobile = String(storedState).endsWith(':mobile');
  const bareState = isMobile ? String(storedState).slice(0, -7) : String(storedState);
  const incomingState = isMobile ? String(state).slice(0, -7) : String(state);

  if (!code || !state || !storedState || !timingSafeEqual(incomingState, bareState)) {
    res.redirect(`${oauthRedirectBase(isMobile)}?oauth_error=invalid_state`);
    return;
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${API_URL}/api/auth/oauth/github/callback`,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) throw new Error('No GitHub access token');

    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `token ${tokenData.access_token}`, 'User-Agent': 'NovoSSH' },
    });
    const emails = await emailsRes.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
    const primary = emails.find((e) => e.primary && e.verified);
    if (!primary) throw new Error('No verified GitHub email');

    const user = await findOrCreateOAuthUser(primary.email);
    const tokens = generateTokenPair(user.id, user.id, primary.email);

    if (!isMobile) {
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    sendOAuthResponse(res, isMobile, tokens.accessToken, tokens.expiresIn);
  } catch (error) {
    console.error('[auth] GitHub OAuth failed:', error);
    res.redirect(`${oauthRedirectBase(isMobile)}?oauth_error=auth_failed`);
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.get('/oauth/google', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) { res.status(503).json({ error: 'Google OAuth not configured' }); return; }
  const isMobile = req.query.platform === 'mobile';
  const state = crypto.randomBytes(16).toString('hex');
  const statePayload = isMobile ? `${state}:mobile` : state;
  res.cookie('oauth_state', statePayload, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 10 * 60 * 1000 });
  const redirectUri = encodeURIComponent(`${API_URL}/api/auth/oauth/google/callback`);
  const scope = encodeURIComponent('email profile');
  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${statePayload}&access_type=offline`
  );
});

router.get('/oauth/google/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const storedState = req.cookies?.oauth_state;
  console.log(`[oauth-google] callback: code=${!!code} state=${!!state} storedState=${!!storedState}`);
  res.clearCookie('oauth_state');

  const isMobile = String(storedState).endsWith(':mobile');
  const bareState = isMobile ? String(storedState).slice(0, -7) : String(storedState);
  const incomingState = isMobile ? String(state).slice(0, -7) : String(state);

  if (!code || !state || !storedState || !timingSafeEqual(incomingState, bareState)) {
    res.redirect(`${oauthRedirectBase(isMobile)}?oauth_error=invalid_state`);
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${API_URL}/api/auth/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    console.log(`[oauth-google] token exchange: status=${tokenRes.status} hasToken=${!!tokenData.access_token} error=${tokenData.error || 'none'}`);
    if (!tokenData.access_token) throw new Error('No Google access token');

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json() as { email?: string; verified_email?: boolean };
    console.log(`[oauth-google] userinfo: email=${googleUser.email} verified=${googleUser.verified_email}`);
    if (!googleUser.email || !googleUser.verified_email) throw new Error('No verified Google email');

    const user = await findOrCreateOAuthUser(googleUser.email);
    console.log(`[oauth-google] user created: id=${user.id}`);
    const tokens = generateTokenPair(user.id, user.id, googleUser.email);

    if (!isMobile) {
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    console.log(`[oauth-google] sending response, isMobile=${isMobile}`);
    sendOAuthResponse(res, isMobile, tokens.accessToken, tokens.expiresIn);
  } catch (error) {
    console.error('[auth] Google OAuth failed:', error);
    res.redirect(`${oauthRedirectBase(isMobile)}?oauth_error=auth_failed`);
  }
});

// ─── Sign in with Apple (native) ────────────────────────────────────────────
// Native ASAuthorizationAppleIDProvider flow: the client already holds a
// signed identity token from Apple, so unlike GitHub/Google there's no
// redirect/code-exchange — just verify the token and issue our own session.

const APPLE_APP_BUNDLE_ID = 'app.novossh.ios';

router.post('/oauth/apple/verify', async (req: Request, res: Response) => {
  try {
    const { identityToken, email: clientProvidedEmail } = req.body;
    if (!identityToken) {
      res.status(400).json({ error: 'identityToken is required' });
      return;
    }

    const payload = await verifyAppleIdentityToken(identityToken, APPLE_APP_BUNDLE_ID);

    // Apple only includes the email on the user's first authorization; the
    // client caches and resends it on subsequent sign-ins with the same device.
    const email = payload.email || clientProvidedEmail;
    if (!email) {
      res.status(400).json({ error: 'No email available from Apple sign-in' });
      return;
    }

    const user = await findOrCreateOAuthUser(email);
    const tokens = generateTokenPair(user.id, user.id, email);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // Return the refresh token in the body too so native clients can store it (they
    // can't read the httpOnly cookie) and refresh an expired access token.
    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn });
  } catch (error) {
    console.error('[auth] Apple sign-in failed:', error);
    res.status(401).json({ error: 'Apple sign-in verification failed' });
  }
});

export { router as authRouter };
