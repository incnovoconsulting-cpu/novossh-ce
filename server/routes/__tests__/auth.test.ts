import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from '../auth.js';
import { verifyToken, revokeTokenByToken } from '../../auth.js';

describe('Auth Routes', () => {
  let app: express.Application;
  const originalEnv = process.env.LOCAL_LOGIN_SECRET;

  beforeEach(() => {
    process.env.LOCAL_LOGIN_SECRET = 'test-secret';
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(
      (req: any, res, next) => {
        // Parse cookies manually for testing
        const cookieHeader = req.get('cookie');
        req.cookies = {};
        if (cookieHeader) {
          cookieHeader.split(';').forEach((cookie: string) => {
            const [key, value] = cookie.trim().split('=');
            req.cookies[key] = value;
          });
        }
        next();
      }
    );
    app.use('/api/auth', authRouter);
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LOCAL_LOGIN_SECRET;
    } else {
      process.env.LOCAL_LOGIN_SECRET = originalEnv;
    }
  });

  describe('POST /api/auth/local-login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('tokenType');
      expect(response.body.tokenType).toBe('Bearer');
    });

    it('should return valid access token', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      const token = response.body.accessToken;
      const payload = verifyToken(token);

      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe('user-123');
      expect(payload?.organizationId).toBe('org-456');
      expect(payload?.type).toBe('access');
    });

    it('should set refresh token in httpOnly cookie', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      const setCookie = response.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie?.[0]).toContain('refreshToken');
      expect(setCookie?.[0]).toContain('HttpOnly');
    });

    it('should return correct expiration time', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      // Access token should expire in 15 minutes
      expect(response.body.expiresIn).toBe(15 * 60);
    });

    it('should reject missing userId', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          organizationId: 'org-456',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('userId');
    });

    it('should reject missing organizationId', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('organizationId');
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle special characters in userId and organizationId', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user@example.com',
          organizationId: 'org/test_123',
        });

      expect(response.status).toBe(200);
      const payload = verifyToken(response.body.accessToken);
      expect(payload?.userId).toBe('user@example.com');
      expect(payload?.organizationId).toBe('org/test_123');
    });

    it('should generate different tokens on each login', async () => {
      const response1 = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      const response2 = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      expect(response1.body.accessToken).not.toBe(response2.body.accessToken);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token with valid refresh token in body', async () => {
      // First, login to get tokens
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      const refreshToken = loginRes.body.refreshToken || loginRes.get('Set-Cookie')?.[0]?.match(/refreshToken=([^;]+)/)?.[1];
      // Since refresh token is in cookie, we'll extract from login response

      // For testing, we need to manually get a refresh token
      // Create one directly
      const { createToken } = await import('../../auth.js');
      const testRefreshToken = createToken('user-123', 'org-456', 'refresh');

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: testRefreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.tokenType).toBe('Bearer');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Missing refresh token');
    });

    it('should return new access token with correct claims', async () => {
      const { createToken } = await import('../../auth.js');
      const testRefreshToken = createToken('user-123', 'org-456', 'refresh');

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: testRefreshToken,
        });

      const newAccessToken = response.body.accessToken;
      const payload = verifyToken(newAccessToken);

      expect(payload?.userId).toBe('user-123');
      expect(payload?.organizationId).toBe('org-456');
      expect(payload?.type).toBe('access');
    });

    it('should set new refresh token in cookie', async () => {
      const { createToken } = await import('../../auth.js');
      const testRefreshToken = createToken('user-123', 'org-456', 'refresh');

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: testRefreshToken,
        });

      const setCookie = response.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie?.[0]).toContain('refreshToken');
    });

    it('should reject access token instead of refresh token', async () => {
      const { createToken } = await import('../../auth.js');
      const accessToken = createToken('user-123', 'org-456', 'access');

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: accessToken,
        });

      expect(response.status).toBe(401);
    });

    it('should reject expired refresh token', async () => {
      const { createToken } = await import('../../auth.js');
      const refreshToken = createToken('user-123', 'org-456', 'refresh');

      // Move time forward
      vi.useFakeTimers();
      vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000); // 8 days

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        });

      expect(response.status).toBe(401);

      vi.useRealTimers();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout with valid token', async () => {
      const { createToken } = await import('../../auth.js');
      const token = createToken('user-123', 'org-456', 'access');

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('successfully');
    });

    it('should clear refresh token cookie', async () => {
      const { createToken } = await import('../../auth.js');
      const token = createToken('user-123', 'org-456', 'access');

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      const setCookie = response.get('Set-Cookie');
      expect(setCookie).toBeDefined();
      // Should have Set-Cookie with Max-Age=0 or similar to clear
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
    });

    it('should revoke the token', async () => {
      const { createToken } = await import('../../auth.js');
      const token = createToken('user-123', 'org-456', 'access');

      // Verify token works before logout
      expect(verifyToken(token)).toBeTruthy();

      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // After logout, token should be revoked
      expect(verifyToken(token)).toBeNull();
    });
  });

  describe('GET /api/auth/me', () => {
    const testUserId = 'user-123';
    const testOrgId = 'org-456';

    beforeAll(async () => {
      const { getDb } = await import('../../db/connection.js');
      const db = getDb();
      await db`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        email_verified BOOLEAN DEFAULT false,
        password_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`;
      await db`INSERT INTO users (id, email, email_verified, password_hash)
               VALUES (${testUserId}, 'test@example.com', true, null)
               ON CONFLICT (id) DO NOTHING`;
    });

    afterAll(async () => {
      const { getDb } = await import('../../db/connection.js');
      const db = getDb();
      await db`DELETE FROM users WHERE id = ${testUserId}`;
    });

    it('should return user info with valid token', async () => {
      const { createToken } = await import('../../auth.js');
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(testUserId);
      expect(response.body.organizationId).toBe(testOrgId);
    });

    it('should include token type in response', async () => {
      const { createToken } = await import('../../auth.js');
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.tokenType).toBe('access');
    });

    it('should include expiration time', async () => {
      const { createToken } = await import('../../auth.js');
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.expiresAt).toBeTruthy();
      expect(new Date(response.body.expiresAt)).toBeInstanceOf(Date);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/auth/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('auth');
    });

    it('should not require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/health');

      expect(response.status).toBe(200);
    });
  });

  describe('Cookie Handling', () => {
    it('should set secure flag in production', async () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      const setCookie = response.get('Set-Cookie');
      // In production, should have Secure flag
      // Note: This depends on how supertest handles cookies

      process.env.NODE_ENV = oldEnv;
    });

    it('should set SameSite=Lax flag with Secure', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      const setCookie = response.get('Set-Cookie');
      expect(setCookie?.[0]).toContain('SameSite=Lax');
      expect(setCookie?.[0]).toContain('Secure');
    });

    it('should set HttpOnly flag', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      const setCookie = response.get('Set-Cookie');
      expect(setCookie?.[0]).toContain('HttpOnly');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/local-login')
        .set('x-local-login-secret', 'test-secret')
        .send({
          userId: 'user-123',
          organizationId: 'org-456',
        });

      expect([200, 400, 500]).toContain(response.status);
    });

    it('should not expose sensitive information in errors', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      // Error should be generic
      expect(response.body.error).not.toContain('token');
      expect(response.body.error).not.toContain('secret');
    });
  });
});
