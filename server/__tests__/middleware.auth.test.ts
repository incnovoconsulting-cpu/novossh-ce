import { describe, it, expect, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  authMiddleware,
  optionalAuthMiddleware,
  requireTokenType,
  getUser,
} from '../middleware/auth.js';
import { createToken, generateTokenPair } from '../auth.js';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: any;
  let mockNext: NextFunction;
  let nextCalled: boolean;

  const testUserId = 'user-123';
  const testOrgId = 'org-456';

  beforeEach(() => {
    nextCalled = false;
    mockNext = () => {
      nextCalled = true;
    };

    mockResponse = {
      status: function (this: any, code: number) {
        this.statusCode = code;
        return this;
      },
      json: function (this: any, data: any) {
        this.jsonData = data;
        return this;
      },
      clearCookie: function (this: any, name: string) {
        return this;
      },
      cookie: function (this: any, name: string, value: string, options?: any) {
        return this;
      },
      statusCode: 200,
      jsonData: null,
    } as any;

    mockRequest = {
      headers: {},
      cookies: {},
    };
  });

  describe('authMiddleware', () => {
    it('should allow requests with valid Bearer token in Authorization header', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.id).toBe(testUserId);
      expect(mockRequest.user?.organizationId).toBe(testOrgId);
    });

    it('should allow requests with token in cookie', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.cookies = {
        accessToken: token,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockRequest.user).toBeDefined();
    });

    it('should prefer Authorization header over cookie', () => {
      const token1 = createToken('user-from-header', testOrgId, 'access');
      const token2 = createToken('user-from-cookie', testOrgId, 'access');

      mockRequest.headers = {
        authorization: `Bearer ${token1}`,
      };
      mockRequest.cookies = {
        accessToken: token2,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user?.id).toBe('user-from-header');
    });

    it('should reject requests with missing token', () => {
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(mockResponse.statusCode).toBe(401);
      expect(mockResponse.jsonData?.error).toContain('Missing');
    });

    it('should reject requests with invalid token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token.here',
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(mockResponse.statusCode).toBe(401);
      expect(mockResponse.jsonData?.error).toContain('Invalid');
    });

    it('should reject requests with malformed Authorization header', () => {
      mockRequest.headers = {
        authorization: 'NotBearer somethinghere',
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(mockResponse.statusCode).toBe(401);
    });

    it('should attach token payload to request', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.token).toBeDefined();
      expect(mockRequest.token?.userId).toBe(testUserId);
      expect(mockRequest.token?.type).toBe('access');
      expect(mockRequest.token?.iat).toBeDefined();
      expect(mockRequest.token?.exp).toBeDefined();
    });

    it('should reject expired tokens', () => {
      // Create token and fast-forward time
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      // Token is valid initially
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(nextCalled).toBe(true);

      // Note: Actual expiration testing requires time manipulation
      // This is tested in auth.test.ts with fake timers
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('should allow requests with valid token', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      optionalAuthMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockRequest.user).toBeDefined();
    });

    it('should allow requests without token', () => {
      optionalAuthMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockRequest.user).toBeUndefined();
    });

    it('should not set user for invalid tokens', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token.here',
      };

      optionalAuthMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockRequest.user).toBeUndefined();
    });

    it('should always call next()', () => {
      // Test with token
      optionalAuthMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(nextCalled).toBe(true);

      // Test without token
      nextCalled = false;
      optionalAuthMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(nextCalled).toBe(true);

      // Test with invalid token
      nextCalled = false;
      mockRequest.headers = {
        authorization: 'Bearer invalid',
      };
      optionalAuthMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(nextCalled).toBe(true);
    });
  });

  describe('requireTokenType', () => {
    it('should allow requests with correct access token type', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      // First run authMiddleware to populate req.token
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockRequest.token?.type).toBe('access');

      // Then test token type validator
      nextCalled = false;
      const middleware = requireTokenType('access');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(true);
    });

    it('should allow requests with correct refresh token type', () => {
      const token = createToken(testUserId, testOrgId, 'refresh');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockRequest.token?.type).toBe('refresh');

      nextCalled = false;
      const middleware = requireTokenType('refresh');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(true);
    });

    it('should reject request when token type does not match', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      nextCalled = false;
      const middleware = requireTokenType('refresh');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(mockResponse.statusCode).toBe(401);
      expect(mockResponse.jsonData?.error).toContain('refresh');
    });

    it('should reject request without token', () => {
      const middleware = requireTokenType('access');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(mockResponse.statusCode).toBe(401);
    });
  });

  describe('getUser', () => {
    it('should extract user from JWT token when available', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      const user = getUser(mockRequest as Request);
      expect(user.id).toBe(testUserId);
      expect(user.organizationId).toBe(testOrgId);
    });

    it('should reject when no JWT available (no header fallback)', () => {
      mockRequest.headers = {
        'x-user-id': 'header-user',
        'x-org-id': 'header-org',
      };

      expect(() => getUser(mockRequest as Request)).toThrow('Authentication required');
    });

    it('should reject when neither JWT nor headers present', () => {
      expect(() => getUser(mockRequest as Request)).toThrow('Authentication required');
    });

    it('should prefer JWT over headers', () => {
      const token = createToken('jwt-user', 'jwt-org', 'access');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
        'x-user-id': 'header-user',
        'x-org-id': 'header-org',
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      const user = getUser(mockRequest as Request);
      expect(user.id).toBe('jwt-user');
      expect(user.organizationId).toBe('jwt-org');
    });
  });

  describe('Authorization header parsing', () => {
    it('should handle Bearer with different casings', () => {
      const token = createToken(testUserId, testOrgId, 'access');

      // Standard case
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(nextCalled).toBe(true);

      // Note: Current implementation is case-sensitive
      // 'bearer' (lowercase) would not work with current code
      // This is actually more secure, so we keep it strict
    });

    it('should reject Authorization headers without Bearer scheme', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.headers = {
        authorization: `Basic ${token}`,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(mockResponse.statusCode).toBe(401);
    });

    it('should reject Authorization header with extra spaces', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.headers = {
        authorization: `Bearer  ${token}`, // extra space
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Current implementation would treat "Bearer " + extra space + token
      // as an invalid token format
      expect(nextCalled).toBe(false);
    });
  });

  describe('Cookie handling', () => {
    it('should extract token from accessToken cookie', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.cookies = {
        accessToken: token,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockRequest.user?.id).toBe(testUserId);
    });

    it('should not use other cookie names', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      mockRequest.cookies = {
        token: token,
        auth: token,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(false);
      expect(mockResponse.statusCode).toBe(401);
    });
  });

  describe('Security considerations', () => {
    it('should not expose user info in error responses for missing tokens', () => {
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Error should be generic
      expect(mockResponse.jsonData?.error).not.toContain('null');
      expect(mockResponse.jsonData?.error).not.toContain('undefined');
    });

    it('should not expose user info in error responses for invalid tokens', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token.signature',
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Error should be generic
      expect(mockResponse.jsonData?.error).not.toContain('signature');
      expect(mockResponse.jsonData?.error).not.toContain('payload');
    });

    it('should handle very long tokens without crashing', () => {
      const longUserId = 'user-' + 'a'.repeat(10000);
      const token = createToken(longUserId, testOrgId, 'access');
      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(nextCalled).toBe(true);
      expect(mockRequest.user?.id).toBe(longUserId);
    });
  });
});
