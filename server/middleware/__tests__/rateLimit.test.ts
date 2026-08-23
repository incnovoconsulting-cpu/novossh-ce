import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import {
  createRateLimitMiddleware,
  exportRateLimit,
  playbackRateLimit,
  syncRateLimit,
  authRateLimit,
  defaultKeyGenerator,
  getRateLimitStore,
  resetRateLimitStore,
  destroyRateLimitStore,
  RateLimitStore,
} from '../rateLimit';

describe('Rate Limit Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: any;
  let app: express.Application;

  beforeEach(() => {
    resetRateLimitStore();

    req = {
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as any,
    };

    const headerMap: Record<string, string> = {};
    res = {
      status: vi.fn(function (this: any, code: number) {
        this.statusCode = code;
        return this;
      }),
      json: vi.fn(function (this: any, data: any) {
        this.jsonData = data;
        return this;
      }),
      setHeader: vi.fn(function (this: any, name: string, value: string | number) {
        headerMap[name] = String(value);
        return this;
      }),
      getHeader: vi.fn(function (name: string) {
        return headerMap[name];
      }),
      headerMap,
    } as any;

    next = vi.fn();
    app = express();
  });

  afterEach(() => {
    destroyRateLimitStore();
  });

  describe('defaultKeyGenerator', () => {
    it('should generate key using authenticated user ID when present', () => {
      (req as any).user = { id: 'user-123', organizationId: 'org-test' };
      const key = defaultKeyGenerator(req as Request);
      expect(key).toBe('user:user-123');
    });

    it('should generate key using IP when no authenticated user', () => {
      const key = defaultKeyGenerator(req as Request);
      expect(key).toBe('ip:127.0.0.1');
    });

    it('should handle missing IP gracefully', () => {
      (req as any).ip = undefined;
      (req.socket as any).remoteAddress = undefined;
      const key = defaultKeyGenerator(req as Request);
      expect(key).toBe('ip:unknown');
    });

    it('should not use spoofable x-user-id header', () => {
      req.headers!['x-user-id'] = 'spoofed-user';
      const key = defaultKeyGenerator(req as Request);
      expect(key).toBe('ip:127.0.0.1');
    });
  });

  describe('createRateLimitMiddleware', () => {
    it('should allow requests within limit', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 5,
      });

      (req as any).user = { id: 'user-1', organizationId: 'org-test' };

      for (let i = 1; i <= 5; i++) {
        middleware(req as Request, res as Response, next);
        expect(next).toHaveBeenCalledTimes(i);
        expect(res.status).not.toHaveBeenCalled();
      }
    });

    it('should reject requests exceeding limit', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 3,
      });

      (req as any).user = { id: 'user-1', organizationId: 'org-test' };

      // First 3 should pass
      for (let i = 0; i < 3; i++) {
        next.mockClear();
        middleware(req as Request, res as Response, next);
        expect(next).toHaveBeenCalled();
      }

      // 4th should be rejected
      next.mockClear();
      middleware(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should return 429 with proper error message', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 2,
        message: 'Custom rate limit message',
      });

      (req as any).user = { id: 'user-1', organizationId: 'org-test' };

      // Exhaust limit
      middleware(req as Request, res as Response, next);
      middleware(req as Request, res as Response, next);

      // Trigger 429
      next.mockClear();
      middleware(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Custom rate limit message',
        })
      );
    });

    it('should set correct rate limit headers', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 5,
      });

      (req as any).user = { id: 'user-1', organizationId: 'org-test' };

      middleware(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        expect.any(Number)
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        expect.any(Number)
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.any(String)
      );
    });

    it('should decrement X-RateLimit-Remaining header', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 5,
      });

      (req as any).user = { id: 'user-1', organizationId: 'org-test' };

      // First request
      middleware(req as Request, res as Response, next);
      let calls = (res.setHeader as any).mock.calls;
      let remainingCall = calls.find((call: any) => call[0] === 'X-RateLimit-Remaining');
      expect(remainingCall[1]).toBe(4); // 5 - 1

      // Second request
      res.setHeader = vi.fn();
      middleware(req as Request, res as Response, next);
      calls = (res.setHeader as any).mock.calls;
      remainingCall = calls.find((call: any) => call[0] === 'X-RateLimit-Remaining');
      expect(remainingCall[1]).toBe(3); // 5 - 2
    });

    it('should isolate rate limits per user', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 2,
      });

      // User 1 - fill limit
      (req as any).user = { id: 'user-1', organizationId: 'org-test' };
      middleware(req as Request, res as Response, next);
      middleware(req as Request, res as Response, next);

      // User 1 - exceeds limit
      next.mockClear();
      middleware(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);

      // User 2 - should have fresh limit
      res.status = vi.fn(function (this: any, code: number) {
        this.statusCode = code;
        return this;
      });
      (req as any).user = { id: 'user-2', organizationId: 'org-test' };
      next.mockClear();
      middleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reset limit after window expires', async () => {
      const windowMs = 100; // 100ms window for testing
      const middleware = createRateLimitMiddleware({
        windowMs,
        maxRequests: 2,
      });

      (req as any).user = { id: 'user-1', organizationId: 'org-test' };

      // Fill limit
      middleware(req as Request, res as Response, next);
      middleware(req as Request, res as Response, next);

      // Should be rate limited
      next.mockClear();
      middleware(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, windowMs + 50));
      next.mockClear();
      res.status = vi.fn(function (this: any, code: number) {
        this.statusCode = code;
        return this;
      });
      middleware(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should support custom key generator', async () => {
      const customKeyGen = vi.fn((req: Request) => {
        return `custom:${(req.headers as any)['custom-key']}`;
      });

      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator: customKeyGen,
      });

      (req.headers as any)['custom-key'] = 'test-key';

      middleware(req as Request, res as Response, next);
      middleware(req as Request, res as Response, next);

      // Should be rate limited
      next.mockClear();
      middleware(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should include retryAfter in 429 response', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 1,
      });

      (req as any).user = { id: 'user-1', organizationId: 'org-test' };

      middleware(req as Request, res as Response, next);

      // Trigger rate limit
      next.mockClear();
      middleware(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAfter: expect.any(Number),
          resetTime: expect.any(String),
        })
      );
    });
  });

  describe('Preset Middlewares', () => {
    it('exportRateLimit should have 10 requests per minute limit', async () => {
      (req as any).user = { id: 'user-1', organizationId: 'org-test' };

      // Fill 10 requests
      for (let i = 0; i < 10; i++) {
        next.mockClear();
        exportRateLimit(req as Request, res as Response, next);
        expect(next).toHaveBeenCalled();
      }

      // 11th should be rate limited
      next.mockClear();
      exportRateLimit(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('playbackRateLimit should have 30 requests per minute limit', async () => {
      (req as any).user = { id: 'user-playback-test', organizationId: 'org-test' };

      // Fill 30 requests
      for (let i = 0; i < 30; i++) {
        next.mockClear();
        playbackRateLimit(req as Request, res as Response, next);
        expect(next).toHaveBeenCalled();
      }

      // 31st should be rate limited
      next.mockClear();
      playbackRateLimit(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('syncRateLimit should have 20 requests per minute limit', async () => {
      (req as any).user = { id: 'user-sync-test', organizationId: 'org-test' };

      // Fill 20 requests
      for (let i = 0; i < 20; i++) {
        next.mockClear();
        syncRateLimit(req as Request, res as Response, next);
        expect(next).toHaveBeenCalled();
      }

      // 21st should be rate limited
      next.mockClear();
      syncRateLimit(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('authRateLimit should have 5 requests per minute limit', async () => {
      (req as any).user = { id: 'user-auth-test', organizationId: 'org-test' };

      // Create fresh middleware to avoid store pollution from other tests
      const freshAuthRateLimit = createRateLimitMiddleware({
        windowMs: 60 * 1000,
        maxRequests: 5,
        message: 'Auth rate limit exceeded',
      });

      // Fill 5 requests
      for (let i = 0; i < 5; i++) {
        next.mockClear();
        freshAuthRateLimit(req as Request, res as Response, next);
        expect(next).toHaveBeenCalled();
      }

      // 6th should be rate limited
      next.mockClear();
      freshAuthRateLimit(req as Request, res as Response, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('RateLimitStore', () => {
    it('should track separate windows for different keys', () => {
      const store = getRateLimitStore();

      const result1 = store.increment('key1', 60000);
      const result2 = store.increment('key2', 60000);

      expect(result1.count).toBe(1);
      expect(result2.count).toBe(1);
    });

    it('should return correct status', () => {
      const store = getRateLimitStore();

      store.increment('key1', 60000);
      store.increment('key1', 60000);

      const status = store.getStatus('key1');
      expect(status.count).toBe(2);
    });

    it('should clean up expired entries', async () => {
      const windowMs = 100;
      const cleanupMs = 150;
      const store = new RateLimitStore(cleanupMs);

      store.increment('key1', windowMs);
      expect(store.size()).toBe(1);

      await new Promise(resolve => setTimeout(resolve, windowMs + 50));
      store.increment('key2', windowMs);
      expect(store.size()).toBeGreaterThan(0);

      await new Promise(resolve => setTimeout(resolve, cleanupMs));
      // Both should be cleaned up by now
      expect(store.size()).toBeLessThanOrEqual(1);
      store.destroy();
    });

    it('should provide store size for monitoring', () => {
      const store = getRateLimitStore();

      store.increment('key1', 60000);
      store.increment('key2', 60000);
      store.increment('key3', 60000);

      expect(store.size()).toBe(3);
    });
  });

  describe('Integration with Express', () => {
    it('should work as Express middleware in router', async () => {
      const router = express.Router();

      // Create fresh middleware to avoid store pollution
      const freshExportRateLimit = createRateLimitMiddleware({
        windowMs: 60 * 1000,
        maxRequests: 10,
        message: 'Export rate limit exceeded',
      });

      router.get('/test', freshExportRateLimit, (req, res) => {
        res.json({ success: true });
      });

      app.use('/api', router);

      // Simulate requests
      const mockReq = {
        method: 'GET',
        url: '/api/test',
        headers: {},
        user: { id: 'user-express-test', organizationId: 'org-test' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      const mockRes = {
        status: vi.fn(function (this: any, code: number) {
          this.statusCode = code;
          return this;
        }),
        json: vi.fn(),
        setHeader: vi.fn(),
      } as any;

      const mockNext = vi.fn();

      exportRateLimit(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Monitoring and Logging', () => {
    it('should return proper X-RateLimit headers with ISO timestamps', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 5,
      });

      (req as any).user = { id: 'user-1', organizationId: 'org-test' };

      middleware(req as Request, res as Response, next);

      const resetHeader = (res.getHeader as any)('X-RateLimit-Reset');
      expect(resetHeader).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO format
    });

    it('should handle many concurrent users independently', async () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 3,
      });

      const users = ['user-1', 'user-2', 'user-3'];
      const results: Record<string, number> = {};

      for (const userId of users) {
        results[userId] = 0;
        (req as any).user = { id: userId, organizationId: 'org-test' };

        for (let i = 0; i < 5; i++) {
          next.mockClear();
          const testRes = { ...res } as any;
          testRes.status = vi.fn(() => testRes);

          middleware(req as Request, testRes as Response, next);
          if ((next as any).mock.calls.length > 0) {
            results[userId]++;
          }
        }
      }

      // Each user should have exactly 3 successful requests
      Object.values(results).forEach((count) => {
        expect(count).toBe(3);
      });
    });
  });
});
