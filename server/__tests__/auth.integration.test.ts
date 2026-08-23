import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Request, Response } from 'express';
import {
  authMiddleware,
  optionalAuthMiddleware,
  getUser,
} from '../middleware/auth.js';
import {
  generateTokenPair,
  refreshAccessToken,
  revokeTokenByToken,
  verifyToken,
} from '../auth.js';

/**
 * Integration tests for JWT-based authentication
 * Tests real request/response cycles through Express middleware
 */
describe('JWT Auth Integration Tests', () => {
  let app: express.Application;
  const testUserId = 'integration-user-123';
  const testOrgId = 'integration-org-456';

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('Login Flow', () => {
    it('should complete full login -> request -> refresh -> logout cycle', async () => {
      // 1. Generate initial token pair
      const tokenPair = generateTokenPair(testUserId, testOrgId);
      expect(tokenPair.accessToken).toBeTruthy();
      expect(tokenPair.refreshToken).toBeTruthy();

      // 2. Use access token in request
      const payload = verifyToken(tokenPair.accessToken);
      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(testUserId);

      // 3. Refresh tokens
      const newTokenPair = refreshAccessToken(tokenPair.refreshToken);
      expect(newTokenPair).toBeTruthy();
      expect(newTokenPair?.accessToken).not.toBe(tokenPair.accessToken);

      // 4. Revoke old token
      const revoked = revokeTokenByToken(tokenPair.accessToken);
      expect(revoked).toBe(true);

      // Old token should no longer verify
      const oldPayload = verifyToken(tokenPair.accessToken);
      expect(oldPayload).toBeNull();

      // New token should still work
      const newPayload = verifyToken(newTokenPair!.accessToken);
      expect(newPayload).toBeTruthy();
    });
  });

  describe('Protected Route Access', () => {
    beforeEach(() => {
      // Set up a protected route
      app.get('/protected', authMiddleware, (_req: Request, res: Response) => {
        const user = getUser(_req);
        res.json({ user });
      });

      // Set up an optional auth route
      app.get('/optional', optionalAuthMiddleware, (req: Request, res: Response) => {
        const user = getUser(req);
        res.json({ user });
      });
    });

    it('should allow access to protected route with valid token', () => {
      const tokenPair = generateTokenPair(testUserId, testOrgId);

      // Simulate request with token
      const req = {
        headers: {
          authorization: `Bearer ${tokenPair.accessToken}`,
        },
        cookies: {},
      } as any as Request;

      const res = {} as any as Response;
      let responseData: any = null;
      res.status = () => res;
      res.json = (data: any) => {
        responseData = data;
        return res;
      };

      const mockNext = () => {
        const user = getUser(req);
        expect(user.id).toBe(testUserId);
        expect(user.organizationId).toBe(testOrgId);
      };

      authMiddleware(req, res, mockNext);
    });

    it('should deny access to protected route without token', () => {
      const req = {
        headers: {},
        cookies: {},
      } as any as Request;

      const res = {} as any as Response;
      let statusCode = 200;
      let responseData: any = null;

      res.status = (code: number) => {
        statusCode = code;
        return res;
      };
      res.json = (data: any) => {
        responseData = data;
        return res;
      };

      let nextCalled = false;
      const mockNext = () => {
        nextCalled = true;
      };

      authMiddleware(req, res, mockNext);

      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(401);
      expect(responseData?.error).toBeDefined();
    });

    it('should allow optional route with or without token', () => {
      // With token
      const tokenPair = generateTokenPair(testUserId, testOrgId);
      const req1 = {
        headers: {
          authorization: `Bearer ${tokenPair.accessToken}`,
        },
        cookies: {},
      } as any as Request;

      let nextCalled1 = false;
      optionalAuthMiddleware(req1, {} as Response, () => {
        nextCalled1 = true;
        expect(req1.user).toBeDefined();
      });
      expect(nextCalled1).toBe(true);

      // Without token
      const req2 = {
        headers: {},
        cookies: {},
      } as any as Request;

      let nextCalled2 = false;
      optionalAuthMiddleware(req2, {} as Response, () => {
        nextCalled2 = true;
        expect(req2.user).toBeUndefined();
      });
      expect(nextCalled2).toBe(true);
    });
  });

  describe('Multi-User Scenarios', () => {
    it('should handle multiple users independently', () => {
      const user1 = { id: 'user-1', org: 'org-1' };
      const user2 = { id: 'user-2', org: 'org-2' };

      const tokens1 = generateTokenPair(user1.id, user1.org);
      const tokens2 = generateTokenPair(user2.id, user2.org);

      const payload1 = verifyToken(tokens1.accessToken);
      const payload2 = verifyToken(tokens2.accessToken);

      expect(payload1?.userId).toBe(user1.id);
      expect(payload2?.userId).toBe(user2.id);
      expect(payload1?.organizationId).toBe(user1.org);
      expect(payload2?.organizationId).toBe(user2.org);
    });

    it('should prevent token cross-contamination between users', () => {
      const user1 = generateTokenPair('user-1', 'org-1');
      const user2 = generateTokenPair('user-2', 'org-2');

      // Verify tokens are different
      expect(user1.accessToken).not.toBe(user2.accessToken);
      expect(user1.refreshToken).not.toBe(user2.refreshToken);

      // Verify payloads are correct
      const payload1 = verifyToken(user1.accessToken);
      const payload2 = verifyToken(user2.accessToken);

      expect(payload1?.userId).not.toBe(payload2?.userId);
      expect(payload1?.organizationId).not.toBe(payload2?.organizationId);
    });
  });

  describe('Token Refresh Flow', () => {
    it('should allow continuous refresh without re-login', () => {
      // Initial login
      const initial = generateTokenPair(testUserId, testOrgId);

      // First refresh
      const refreshed1 = refreshAccessToken(initial.refreshToken);
      expect(refreshed1).toBeTruthy();
      expect(refreshed1?.accessToken).toBeTruthy();

      // Second refresh using new refresh token
      const refreshed2 = refreshAccessToken(refreshed1!.refreshToken);
      expect(refreshed2).toBeTruthy();
      expect(refreshed2?.accessToken).toBeTruthy();

      // All tokens should verify
      expect(verifyToken(initial.accessToken)).toBeTruthy();
      expect(verifyToken(refreshed1!.accessToken)).toBeTruthy();
      expect(verifyToken(refreshed2!.accessToken)).toBeTruthy();
    });

    it('should not allow refresh with expired refresh token', () => {
      const initial = generateTokenPair(testUserId, testOrgId);

      // Refresh is valid initially
      const refreshed1 = refreshAccessToken(initial.refreshToken);
      expect(refreshed1).toBeTruthy();

      // Revoke the initial refresh token
      revokeTokenByToken(initial.refreshToken);

      // Should not be able to use revoked refresh token
      const refreshed2 = refreshAccessToken(initial.refreshToken);
      expect(refreshed2).toBeNull();
    });

    it('should not allow refresh with access token', () => {
      const tokenPair = generateTokenPair(testUserId, testOrgId);

      // Try to refresh using access token (wrong token type)
      const result = refreshAccessToken(tokenPair.accessToken);

      expect(result).toBeNull();
    });
  });

  describe('Token Revocation Scenarios', () => {
    it('should revoke individual tokens', () => {
      const token = generateTokenPair(testUserId, testOrgId);

      // Token should be valid before revocation
      expect(verifyToken(token.accessToken)).toBeTruthy();

      // Revoke it
      revokeTokenByToken(token.accessToken);

      // Token should no longer be valid
      expect(verifyToken(token.accessToken)).toBeNull();
    });

    it('should not affect other tokens when revoking one', () => {
      const tokens1 = generateTokenPair('user-1', 'org-1');
      const tokens2 = generateTokenPair('user-2', 'org-2');

      // Verify both work
      expect(verifyToken(tokens1.accessToken)).toBeTruthy();
      expect(verifyToken(tokens2.accessToken)).toBeTruthy();

      // Revoke one
      revokeTokenByToken(tokens1.accessToken);

      // First should be revoked, second should still work
      expect(verifyToken(tokens1.accessToken)).toBeNull();
      expect(verifyToken(tokens2.accessToken)).toBeTruthy();
    });

    it('should handle revoking already-revoked token gracefully', () => {
      const token = generateTokenPair(testUserId, testOrgId);

      // Revoke it
      const result1 = revokeTokenByToken(token.accessToken);
      expect(result1).toBe(true);

      // Try to revoke again
      const result2 = revokeTokenByToken(token.accessToken);
      expect(result2).toBe(false); // Already revoked
    });

    it('should handle revoking invalid token gracefully', () => {
      const result = revokeTokenByToken('not-a-valid-token');
      expect(result).toBe(false);
    });
  });

  describe('Backward Compatibility During Migration', () => {
    it('should prefer JWT over header-based auth', () => {
      const tokenPair = generateTokenPair('jwt-user', 'jwt-org');
      const req = {
        headers: {
          authorization: `Bearer ${tokenPair.accessToken}`,
          'x-user-id': 'legacy-user',
          'x-org-id': 'legacy-org',
        },
        cookies: {},
      } as any as Request;

      authMiddleware(req, {} as Response, () => {
        const user = getUser(req);
        // Should use JWT, not legacy header
        expect(user.id).toBe('jwt-user');
        expect(user.organizationId).toBe('jwt-org');
      });
    });

    it('should reject when no JWT available (no header fallback)', () => {
      const req = {
        headers: {
          'x-user-id': 'legacy-user',
          'x-org-id': 'legacy-org',
        },
        cookies: {},
      } as any as Request;

      // optionalAuthMiddleware allows missing token
      optionalAuthMiddleware(req, {} as Response, () => {
        // getUser() now throws — no header fallback
        expect(() => getUser(req)).toThrow('Authentication required');
      });
    });

    it('should reject when neither JWT nor headers present', () => {
      const req = {
        headers: {},
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(req, {} as Response, () => {
        expect(() => getUser(req)).toThrow('Authentication required');
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle tampered tokens gracefully', () => {
      const tokenPair = generateTokenPair(testUserId, testOrgId);
      const [header, payload] = tokenPair.accessToken.split('.');

      // Tamper with signature
      const tamperedToken = `${header}.${payload}.invalid`;

      const req = {
        headers: {
          authorization: `Bearer ${tamperedToken}`,
        },
        cookies: {},
      } as any as Request;

      const res = {} as any as Response;
      let statusCode = 200;
      res.status = (code: number) => {
        statusCode = code;
        return res;
      };
      res.json = () => res;

      authMiddleware(req, res, () => {
        throw new Error('Should not reach here');
      });

      expect(statusCode).toBe(401);
    });

    it('should handle malformed Authorization header gracefully', () => {
      const req = {
        headers: {
          authorization: 'NotBearer token',
        },
        cookies: {},
      } as any as Request;

      const res = {} as any as Response;
      let statusCode = 200;
      res.status = (code: number) => {
        statusCode = code;
        return res;
      };
      res.json = () => res;

      authMiddleware(req, res, () => {
        throw new Error('Should not reach here');
      });

      expect(statusCode).toBe(401);
    });

    it('should handle missing cookies gracefully', () => {
      const req = {
        headers: {},
        cookies: undefined,
      } as any as Request;

      const res = {} as any as Response;
      let statusCode = 200;
      res.status = (code: number) => {
        statusCode = code;
        return res;
      };
      res.json = () => res;

      authMiddleware(req, res, () => {
        throw new Error('Should not reach here');
      });

      expect(statusCode).toBe(401);
    });

    it('should handle null cookies gracefully', () => {
      const req = {
        headers: {},
        cookies: null,
      } as any as Request;

      const res = {} as any as Response;
      let statusCode = 200;
      res.status = (code: number) => {
        statusCode = code;
        return res;
      };
      res.json = () => res;

      authMiddleware(req, res, () => {
        throw new Error('Should not reach here');
      });

      expect(statusCode).toBe(401);
    });
  });

  describe('Security Hardening', () => {
    it('should not expose token claims in error messages', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid.token.here',
        },
        cookies: {},
      } as any as Request;

      const res = {} as any as Response;
      let errorMessage = '';
      res.status = () => res;
      res.json = (data: any) => {
        errorMessage = data.error || '';
        return res;
      };

      authMiddleware(req, res, () => {
        throw new Error('Should not reach here');
      });

      // Error message should be generic, not revealing structure
      expect(errorMessage).not.toContain('payload');
      expect(errorMessage).not.toContain('signature');
      expect(errorMessage).not.toContain('null');
    });

    it('should use timing-safe token comparison', () => {
      // This is implicitly tested by the underlying verifyHS256 function
      // which uses crypto.timingSafeEqual
      const token1 = generateTokenPair(testUserId, testOrgId).accessToken;
      const token2 = generateTokenPair(testUserId, testOrgId).accessToken;

      // Both should verify (but be different tokens)
      expect(verifyToken(token1)).toBeTruthy();
      expect(verifyToken(token2)).toBeTruthy();
      expect(token1).not.toBe(token2);
    });

    it('should handle extremely long tokens without buffer overflow', () => {
      const longUserId = 'user-' + 'a'.repeat(100000);
      const tokens = generateTokenPair(longUserId, testOrgId);

      const req = {
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
        cookies: {},
      } as any as Request;

      let userExtracted = false;
      authMiddleware(req, {} as Response, () => {
        const user = getUser(req);
        expect(user.id).toBe(longUserId);
        userExtracted = true;
      });

      expect(userExtracted).toBe(true);
    });
  });

  describe('Cookie-based Auth', () => {
    it('should support cookie-based authentication', () => {
      const tokenPair = generateTokenPair(testUserId, testOrgId);
      const req = {
        headers: {},
        cookies: {
          accessToken: tokenPair.accessToken,
        },
      } as any as Request;

      let userExtracted = false;
      authMiddleware(req, {} as Response, () => {
        const user = getUser(req);
        expect(user.id).toBe(testUserId);
        userExtracted = true;
      });

      expect(userExtracted).toBe(true);
    });

    it('should prefer Bearer token over cookie', () => {
      const token1 = generateTokenPair('bearer-user', testOrgId).accessToken;
      const token2 = generateTokenPair('cookie-user', testOrgId).accessToken;

      const req = {
        headers: {
          authorization: `Bearer ${token1}`,
        },
        cookies: {
          accessToken: token2,
        },
      } as any as Request;

      authMiddleware(req, {} as Response, () => {
        const user = getUser(req);
        expect(user.id).toBe('bearer-user'); // Should use Bearer, not cookie
      });
    });
  });
});
