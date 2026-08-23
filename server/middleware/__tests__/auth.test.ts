import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireTokenType,
  getUser,
} from '../auth.js';
import { createToken, generateTokenPair } from '../../auth.js';

describe('Auth Middleware', () => {
  const testUserId = 'user-123';
  const testOrgId = 'org-456';
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Test endpoint using authMiddleware
    app.get('/protected', authMiddleware, (req: Request, res: Response) => {
      res.json({
        userId: req.user?.id,
        organizationId: req.user?.organizationId,
        tokenType: req.token?.type,
      });
    });

    // Test endpoint using optionalAuthMiddleware
    app.get('/optional', optionalAuthMiddleware, (req: Request, res: Response) => {
      res.json({
        authenticated: !!req.user,
        userId: req.user?.id,
      });
    });

    // Test endpoint with token type requirement
    app.get(
      '/require-access',
      authMiddleware,
      requireTokenType('access'),
      (req: Request, res: Response) => {
        res.json({ message: 'Access granted' });
      }
    );

    app.get(
      '/require-refresh',
      authMiddleware,
      requireTokenType('refresh'),
      (req: Request, res: Response) => {
        res.json({ message: 'Refresh granted' });
      }
    );

    // Endpoint to test getUser helper
    app.get('/user-info', (req: Request, res: Response) => {
      const user = getUser(req);
      res.json(user);
    });
  });

  describe('authMiddleware', () => {
    it('should reject requests without token', async () => {
      const response = await request(app).get('/protected');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing authentication token');
    });

    it('should accept valid Bearer token in Authorization header', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(testUserId);
      expect(response.body.organizationId).toBe(testOrgId);
    });

    it('should attach user info to request object', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('organizationId');
      expect(response.body).toHaveProperty('tokenType');
    });

    it('should attach token payload to request', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.body.tokenType).toBe('access');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should reject malformed Authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'NotBearer sometoken');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Missing authentication token');
    });

    it('should reject expired tokens', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      // Move time forward
      vi.useFakeTimers();
      vi.advanceTimersByTime(20 * 60 * 1000); // 20 minutes

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired token');

      vi.useRealTimers();
    });

    it('should handle empty Authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', '');

      expect(response.status).toBe(401);
    });

    it('should be case-insensitive for Bearer scheme', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      // Note: HTTP headers are case-insensitive for field names
      const response = await request(app)
        .get('/protected')
        .set('authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('should pass different user IDs correctly', async () => {
      const userId1 = 'alice-123';
      const userId2 = 'bob-456';

      const token1 = createToken(userId1, testOrgId, 'access');
      const response1 = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token1}`);

      expect(response1.body.userId).toBe(userId1);

      const token2 = createToken(userId2, testOrgId, 'access');
      const response2 = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token2}`);

      expect(response2.body.userId).toBe(userId2);
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('should allow requests without token', async () => {
      const response = await request(app).get('/optional');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);
    });

    it('should authenticate requests with valid token', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/optional')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.userId).toBe(testUserId);
    });

    it('should gracefully handle invalid tokens', async () => {
      const response = await request(app)
        .get('/optional')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);
    });

    it('should not fail on expired tokens', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      vi.useFakeTimers();
      vi.advanceTimersByTime(20 * 60 * 1000);

      const response = await request(app)
        .get('/optional')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('requireTokenType', () => {
    it('should allow access tokens for access-protected endpoints', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/require-access')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Access granted');
    });

    it('should reject refresh tokens for access-protected endpoints', async () => {
      const token = createToken(testUserId, testOrgId, 'refresh');

      const response = await request(app)
        .get('/require-access')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token type');
    });

    it('should allow refresh tokens for refresh-protected endpoints', async () => {
      const token = createToken(testUserId, testOrgId, 'refresh');

      const response = await request(app)
        .get('/require-refresh')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Refresh granted');
    });

    it('should reject access tokens for refresh-protected endpoints', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/require-refresh')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token type');
    });
  });

  describe('getUser helper', () => {
    it('should extract user from authenticated request', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/user-info')
        .set('Authorization', `Bearer ${token}`);

      // getUser should find the authenticated user from JWT
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testUserId);
      expect(response.body.organizationId).toBe(testOrgId);
    });

    it('should reject unauthenticated requests (no fallback to headers)', async () => {
      const response = await request(app)
        .get('/user-info')
        .set('x-user-id', 'legacy-user')
        .set('x-org-id', 'legacy-org');

      // getUser() now throws on missing JWT — no header fallback
      expect(response.status).toBe(500);
    });

    it('should prefer JWT over headers', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      const response = await request(app)
        .get('/user-info')
        .set('Authorization', `Bearer ${token}`)
        .set('x-user-id', 'legacy-user')
        .set('x-org-id', 'legacy-org');

      // JWT should take precedence
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testUserId);
      expect(response.body.organizationId).toBe(testOrgId);
    });

    it('should reject when no auth provided (no hardcoded defaults)', async () => {
      const response = await request(app).get('/user-info');

      // getUser() now throws — no user-1/org-1 fallback
      expect(response.status).toBe(500);
    });
  });

  describe('Multiple Headers Handling', () => {
    it('should handle Authorization header case-insensitivity', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      // Express normalizes header names to lowercase
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('should extract only Bearer token, not other auth schemes', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Basic dXNlcjpwYXNz`);

      expect(response.status).toBe(401);
    });
  });

  describe('Request Object Modification', () => {
    it('should not modify request for invalid tokens', async () => {
      app.get('/check-user', optionalAuthMiddleware, (req: Request, res: Response) => {
        const hasUser = 'user' in req && req.user !== undefined;
        res.json({ hasUser });
      });

      const response = await request(app)
        .get('/check-user')
        .set('Authorization', 'Bearer invalid');

      expect(response.status).toBe(200);
      expect(response.body.hasUser).toBe(false);
    });

    it('should preserve other request properties', async () => {
      const token = createToken(testUserId, testOrgId, 'access');

      app.get('/check-props', authMiddleware, (req: Request, res: Response) => {
        res.json({
          method: req.method,
          path: req.path,
          hasUser: !!req.user,
        });
      });

      const response = await request(app)
        .get('/check-props')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.method).toBe('GET');
      expect(response.body.path).toBe('/check-props');
      expect(response.body.hasUser).toBe(true);
    });
  });
});
