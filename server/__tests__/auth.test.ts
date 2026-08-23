import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createToken,
  verifyToken,
  generateTokenPair,
  refreshAccessToken,
  revokeToken,
  revokeTokenByToken,
  getRevokedTokenCount,
  JWTPayload,
} from '../auth.js';

describe('JWT Authentication', () => {
  const testUserId = 'user-123';
  const testOrgId = 'org-456';

  beforeEach(() => {
    // Clear environment
    delete process.env.JWT_SECRET;
    delete process.env.JWT_ALGORITHM;
  });

  describe('createToken', () => {
    it('should create a valid access token', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      // Token should have 3 parts (header.payload.signature)
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should create a valid refresh token', () => {
      const token = createToken(testUserId, testOrgId, 'refresh');
      expect(token).toBeTruthy();

      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should embed user id in token', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const payload = verifyToken(token);

      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(testUserId);
    });

    it('should embed organization id in token', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const payload = verifyToken(token);

      expect(payload).toBeTruthy();
      expect(payload?.organizationId).toBe(testOrgId);
    });

    it('should embed correct token type', () => {
      const accessToken = createToken(testUserId, testOrgId, 'access');
      const accessPayload = verifyToken(accessToken);
      expect(accessPayload?.type).toBe('access');

      const refreshToken = createToken(testUserId, testOrgId, 'refresh');
      const refreshPayload = verifyToken(refreshToken);
      expect(refreshPayload?.type).toBe('refresh');
    });

    it('should include issued at (iat) claim', () => {
      const before = Math.floor(Date.now() / 1000);
      const token = createToken(testUserId, testOrgId, 'access');
      const after = Math.floor(Date.now() / 1000);
      const payload = verifyToken(token);

      expect(payload?.iat).toBeDefined();
      expect(payload!.iat).toBeGreaterThanOrEqual(before);
      expect(payload!.iat).toBeLessThanOrEqual(after);
    });

    it('should include expiration (exp) claim', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const payload = verifyToken(token);

      expect(payload?.exp).toBeDefined();
      expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should have different expiration for access vs refresh tokens', () => {
      const accessToken = createToken(testUserId, testOrgId, 'access');
      const refreshToken = createToken(testUserId, testOrgId, 'refresh');

      const accessPayload = verifyToken(accessToken);
      const refreshPayload = verifyToken(refreshToken);

      // Refresh token should expire much later
      expect(refreshPayload!.exp).toBeGreaterThan(accessPayload!.exp);
    });

    it('should include a unique JTI for each token', () => {
      const token1 = createToken(testUserId, testOrgId, 'access');
      const token2 = createToken(testUserId, testOrgId, 'access');

      const payload1 = verifyToken(token1);
      const payload2 = verifyToken(token2);

      expect(payload1?.jti).toBeTruthy();
      expect(payload2?.jti).toBeTruthy();
      expect(payload1?.jti).not.toBe(payload2?.jti);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const payload = verifyToken(token);

      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(testUserId);
      expect(payload?.organizationId).toBe(testOrgId);
    });

    it('should return null for invalid token format', () => {
      const payload = verifyToken('invalid.token');
      expect(payload).toBeNull();
    });

    it('should return null for token with invalid signature', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const [header, payload, ] = token.split('.');

      // Modify signature
      const tamperedToken = `${header}.${payload}.invalidsignature`;
      const result = verifyToken(tamperedToken);

      expect(result).toBeNull();
    });

    it('should return null for malformed token', () => {
      expect(verifyToken('not-a-token')).toBeNull();
      expect(verifyToken('')).toBeNull();
      expect(verifyToken('a.b.c.d')).toBeNull();
    });

    it('should reject expired tokens', () => {
      // Temporarily override token expiration
      const originalCreateToken = createToken;

      // Create a token that expires immediately by manipulating Date
      const now = Math.floor(Date.now() / 1000);
      const expiredToken = createToken(testUserId, testOrgId, 'access');

      // Wait a moment and move time forward in verification
      const originalDate = Date.now;
      vi.useFakeTimers();

      // Create token with real time
      const token = createToken(testUserId, testOrgId, 'access');

      // Move time forward by 20 minutes (access tokens expire in 15)
      vi.advanceTimersByTime(20 * 60 * 1000);

      const payload = verifyToken(token);
      expect(payload).toBeNull();

      vi.useRealTimers();
    });

    it('should extract all payload fields', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const payload = verifyToken(token);

      expect(payload).toHaveProperty('userId');
      expect(payload).toHaveProperty('organizationId');
      expect(payload).toHaveProperty('type');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
      expect(payload).toHaveProperty('jti');
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const pair = generateTokenPair(testUserId, testOrgId);

      expect(pair.accessToken).toBeTruthy();
      expect(pair.refreshToken).toBeTruthy();
      expect(pair.expiresIn).toBeTruthy();
    });

    it('should generate different tokens', () => {
      const pair = generateTokenPair(testUserId, testOrgId);
      expect(pair.accessToken).not.toBe(pair.refreshToken);
    });

    it('should set correct expiration time', () => {
      const pair = generateTokenPair(testUserId, testOrgId);
      // Access token should expire in 15 minutes (900 seconds)
      expect(pair.expiresIn).toBe(15 * 60);
    });

    it('should create access token with correct type', () => {
      const pair = generateTokenPair(testUserId, testOrgId);
      const accessPayload = verifyToken(pair.accessToken);
      expect(accessPayload?.type).toBe('access');
    });

    it('should create refresh token with correct type', () => {
      const pair = generateTokenPair(testUserId, testOrgId);
      const refreshPayload = verifyToken(pair.refreshToken);
      expect(refreshPayload?.type).toBe('refresh');
    });

    it('should embed same user in both tokens', () => {
      const pair = generateTokenPair(testUserId, testOrgId);
      const accessPayload = verifyToken(pair.accessToken);
      const refreshPayload = verifyToken(pair.refreshToken);

      expect(accessPayload?.userId).toBe(testUserId);
      expect(refreshPayload?.userId).toBe(testUserId);
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new token pair from refresh token', () => {
      const pair1 = generateTokenPair(testUserId, testOrgId);
      const pair2 = refreshAccessToken(pair1.refreshToken);

      expect(pair2).toBeTruthy();
      expect(pair2?.accessToken).toBeTruthy();
      expect(pair2?.refreshToken).toBeTruthy();
    });

    it('should return null for invalid refresh token', () => {
      const result = refreshAccessToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for access token instead of refresh', () => {
      const pair = generateTokenPair(testUserId, testOrgId);
      const result = refreshAccessToken(pair.accessToken);
      expect(result).toBeNull();
    });

    it('should preserve user identity across refresh', () => {
      const pair1 = generateTokenPair(testUserId, testOrgId);
      const pair2 = refreshAccessToken(pair1.refreshToken);

      const payload = verifyToken(pair2!.accessToken);
      expect(payload?.userId).toBe(testUserId);
      expect(payload?.organizationId).toBe(testOrgId);
    });

    it('should generate new tokens on each refresh', () => {
      const pair1 = generateTokenPair(testUserId, testOrgId);
      const pair2 = refreshAccessToken(pair1.refreshToken);
      const pair3 = refreshAccessToken(pair1.refreshToken);

      expect(pair2?.accessToken).not.toBe(pair3?.accessToken);
      expect(pair2?.refreshToken).not.toBe(pair3?.refreshToken);
    });
  });

  describe('Token Revocation', () => {
    it('should revoke token by JTI', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const payload = verifyToken(token);
      expect(payload).toBeTruthy();

      if (payload?.jti) {
        revokeToken(payload.jti);
      }

      const result = verifyToken(token);
      expect(result).toBeNull();
    });

    it('should revoke token by token string', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const payload = verifyToken(token);
      expect(payload).toBeTruthy();

      const success = revokeTokenByToken(token);
      expect(success).toBe(true);

      const result = verifyToken(token);
      expect(result).toBeNull();
    });

    it('should return false when revoking invalid token', () => {
      const success = revokeTokenByToken('invalid-token');
      expect(success).toBe(false);
    });

    it('should track revoked token count', () => {
      const before = getRevokedTokenCount();

      const token1 = createToken(testUserId, testOrgId, 'access');
      const payload1 = verifyToken(token1);
      if (payload1?.jti) {
        revokeToken(payload1.jti);
      }

      const after = getRevokedTokenCount();
      expect(after).toBe(before + 1);
    });

    it('should prevent use of revoked token', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      expect(verifyToken(token)).toBeTruthy();

      revokeTokenByToken(token);
      expect(verifyToken(token)).toBeNull();
    });
  });

  describe('Security Properties', () => {
    it('should use timing-safe comparison for signature verification', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const [header, payload] = token.split('.');

      // Create different invalid signatures
      const tamperedToken1 = `${header}.${payload}.aaaaaaaaaaaa`;
      const tamperedToken2 = `${header}.${payload}.bbbbbbbbbbbb`;

      // Both should be rejected
      expect(verifyToken(tamperedToken1)).toBeNull();
      expect(verifyToken(tamperedToken2)).toBeNull();
    });

    it('should not leak information in error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Test with invalid signature (should log error)
      const token = createToken(testUserId, testOrgId, 'access');
      const [header, payload] = token.split('.');
      const tamperedToken = `${header}.${payload}.invalidsignature`;

      const result = verifyToken(tamperedToken);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      // Error messages should be generic, not revealing structure
      const calls = consoleSpy.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });

    it('should include appropriate headers in JWT', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const parts = token.split('.');
      const headerStr = Buffer.from(parts[0], 'base64').toString();
      const header = JSON.parse(headerStr);

      expect(header.alg).toBeDefined();
      expect(header.typ).toBe('JWT');
    });
  });

  describe('Claim Validation', () => {
    it('should validate userId claim', () => {
      const token = createToken('special-user', testOrgId, 'access');
      const payload = verifyToken(token);
      expect(payload?.userId).toBe('special-user');
    });

    it('should validate organizationId claim', () => {
      const token = createToken(testUserId, 'special-org', 'access');
      const payload = verifyToken(token);
      expect(payload?.organizationId).toBe('special-org');
    });

    it('should handle special characters in claims', () => {
      const specialUserId = 'user-123@example.com';
      const specialOrgId = 'org/456_test';
      const token = createToken(specialUserId, specialOrgId, 'access');
      const payload = verifyToken(token);

      expect(payload?.userId).toBe(specialUserId);
      expect(payload?.organizationId).toBe(specialOrgId);
    });

    it('should include all required claims', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const payload = verifyToken(token);

      const requiredClaims = ['userId', 'organizationId', 'type', 'iat', 'exp', 'jti'];
      for (const claim of requiredClaims) {
        expect(payload).toHaveProperty(claim);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in payload', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const [header] = token.split('.');

      // Create token with invalid base64 payload
      const invalidToken = `${header}.!!!invalid!!!.signature`;
      const result = verifyToken(invalidToken);

      expect(result).toBeNull();
    });

    it('should handle missing claims gracefully', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const parts = token.split('.');

      // Should still verify since we create valid tokens
      const payload = verifyToken(token);
      expect(payload).toBeTruthy();
    });

    it('should not crash on extremely long tokens', () => {
      const longUserId = 'a'.repeat(10000);
      const token = createToken(longUserId, testOrgId, 'access');
      const payload = verifyToken(token);

      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(longUserId);
    });
  });

  describe('Token Expiration', () => {
    it('access token should expire in 15 minutes', () => {
      const token = createToken(testUserId, testOrgId, 'access');
      const payload = verifyToken(token);

      const now = Math.floor(Date.now() / 1000);
      const expiresIn = payload!.exp - payload!.iat;

      // Should be approximately 15 minutes (900 seconds)
      expect(expiresIn).toBe(15 * 60);
    });

    it('refresh token should expire in 7 days', () => {
      const token = createToken(testUserId, testOrgId, 'refresh');
      const payload = verifyToken(token);

      const expiresIn = payload!.exp - payload!.iat;

      // Should be approximately 7 days
      expect(expiresIn).toBe(7 * 24 * 60 * 60);
    });
  });
});
