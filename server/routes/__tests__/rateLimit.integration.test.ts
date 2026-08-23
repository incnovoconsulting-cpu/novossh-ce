import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import {
  exportRateLimit,
  playbackRateLimit,
  syncRateLimit,
  resetRateLimitStore,
  destroyRateLimitStore,
  createRateLimitMiddleware,
} from '../../middleware/rateLimit';

describe('Rate Limiting Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    resetRateLimitStore();
    app = express();
    app.use(express.json());
    // Mock auth middleware: reads x-user-id header and sets req.user
    // so the rate limit key generator can use authenticated user IDs.
    app.use((req: any, _res, next) => {
      const userId = req.headers['x-user-id'];
      if (userId) {
        req.user = { id: userId, organizationId: 'org-test' };
      }
      next();
    });
  });

  afterEach(() => {
    destroyRateLimitStore();
  });

  describe('Export Endpoint Rate Limiting', () => {
    beforeEach(() => {
      app.get('/api/sessions/:id/export', exportRateLimit, (req, res) => {
        res.json({ success: true, data: 'export-data' });
      });
    });

    it('should allow requests within export limit (10 per minute)', async () => {
      const userId = 'user-export-test-1';

      for (let i = 1; i <= 10; i++) {
        const response = await request(app)
          .get('/api/sessions/session-1/export')
          .set('x-user-id', userId);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true, data: 'export-data' });
      }
    });

    it('should reject requests exceeding export limit', async () => {
      const userId = 'user-export-test-2';

      // Make 10 successful requests
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/sessions/session-1/export')
          .set('x-user-id', userId);
        expect(response.status).toBe(200);
      }

      // 11th request should fail
      const response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', userId);

      expect(response.status).toBe(429);
      expect(response.body).toEqual(
        expect.objectContaining({
          error: expect.stringContaining('Export rate limit exceeded'),
        })
      );
    });

    it('should include proper rate limit headers for export', async () => {
      const userId = 'user-export-test-3';

      const response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', userId);

      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBe('9');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });

    it('should isolate export limits per user', async () => {
      // Fill limit for user 1
      const user1 = 'user-export-isolated-1';
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/sessions/session-1/export')
          .set('x-user-id', user1);
        expect(response.status).toBe(200);
      }

      // User 1 is rate limited
      let response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', user1);
      expect(response.status).toBe(429);

      // User 2 should have fresh limit
      const user2 = 'user-export-isolated-2';
      response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', user2);
      expect(response.status).toBe(200);
    });

    it('should include retry information in 429 response', async () => {
      const userId = 'user-export-retry';

      // Exhaust limit
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/sessions/session-1/export')
          .set('x-user-id', userId);
      }

      // Trigger rate limit
      const response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', userId);

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('retryAfter');
      expect(response.body).toHaveProperty('resetTime');
      expect(typeof response.body.retryAfter).toBe('number');
      expect(response.body.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Playback Endpoint Rate Limiting', () => {
    beforeEach(() => {
      app.get('/api/sessions/:id/playback', playbackRateLimit, (req, res) => {
        res.json({ success: true, data: 'playback-data' });
      });
    });

    it('should allow requests within playback limit (30 per minute)', async () => {
      const userId = 'user-playback-test-1';

      for (let i = 1; i <= 30; i++) {
        const response = await request(app)
          .get('/api/sessions/session-1/playback')
          .set('x-user-id', userId);

        expect(response.status).toBe(200);
      }
    });

    it('should reject requests exceeding playback limit', async () => {
      const userId = 'user-playback-test-2';

      // Make 30 successful requests
      for (let i = 0; i < 30; i++) {
        const response = await request(app)
          .get('/api/sessions/session-1/playback')
          .set('x-user-id', userId);
        expect(response.status).toBe(200);
      }

      // 31st request should fail
      const response = await request(app)
        .get('/api/sessions/session-1/playback')
        .set('x-user-id', userId);

      expect(response.status).toBe(429);
      expect(response.body).toEqual(
        expect.objectContaining({
          error: expect.stringContaining('Playback rate limit exceeded'),
        })
      );
    });

    it('should have higher limit than export', async () => {
      const userId = 'user-playback-higher-limit';

      // Playback should allow 30, export only 10
      for (let i = 0; i < 30; i++) {
        const response = await request(app)
          .get('/api/sessions/session-1/playback')
          .set('x-user-id', userId);
        expect(response.status).toBe(200);
      }

      // 31st should fail
      const response = await request(app)
        .get('/api/sessions/session-1/playback')
        .set('x-user-id', userId);
      expect(response.status).toBe(429);
    });
  });

  describe('Sync Endpoint Rate Limiting', () => {
    beforeEach(() => {
      app.post('/api/vaults/:vaultId/sync', syncRateLimit, (req, res) => {
        res.json({ success: true, appliedChanges: [] });
      });
    });

    it('should allow requests within sync limit (20 per minute)', async () => {
      const userId = 'user-sync-test-1';

      for (let i = 1; i <= 20; i++) {
        const response = await request(app)
          .post('/api/vaults/vault-1/sync')
          .set('x-user-id', userId)
          .send({ changes: [] });

        expect(response.status).toBe(200);
      }
    });

    it('should reject requests exceeding sync limit', async () => {
      const userId = 'user-sync-test-2';

      // Make 20 successful requests
      for (let i = 0; i < 20; i++) {
        const response = await request(app)
          .post('/api/vaults/vault-1/sync')
          .set('x-user-id', userId)
          .send({ changes: [] });
        expect(response.status).toBe(200);
      }

      // 21st request should fail
      const response = await request(app)
        .post('/api/vaults/vault-1/sync')
        .set('x-user-id', userId)
        .send({ changes: [] });

      expect(response.status).toBe(429);
      expect(response.body).toEqual(
        expect.objectContaining({
          error: expect.stringContaining('Sync rate limit exceeded'),
        })
      );
    });

    it('should include rate limit headers for sync', async () => {
      const userId = 'user-sync-headers';

      const response = await request(app)
        .post('/api/vaults/vault-1/sync')
        .set('x-user-id', userId)
        .send({ changes: [] });

      expect(response.headers['x-ratelimit-limit']).toBe('20');
      expect(response.headers['x-ratelimit-remaining']).toBe('19');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Cross-Endpoint Rate Limit Isolation', () => {
    beforeEach(() => {
      app.get('/api/sessions/:id/export', exportRateLimit, (req, res) => {
        res.json({ type: 'export' });
      });

      app.get('/api/sessions/:id/playback', playbackRateLimit, (req, res) => {
        res.json({ type: 'playback' });
      });

      app.post('/api/vaults/:vaultId/sync', syncRateLimit, (req, res) => {
        res.json({ type: 'sync' });
      });
    });

    it('should track limits independently per endpoint', async () => {
      const userId = 'user-cross-endpoint';

      // Fill export limit (10)
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/sessions/session-1/export')
          .set('x-user-id', userId);
        expect(response.status).toBe(200);
      }

      // Export should be limited
      let response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', userId);
      expect(response.status).toBe(429);

      // But playback should still work
      response = await request(app)
        .get('/api/sessions/session-1/playback')
        .set('x-user-id', userId);
      expect(response.status).toBe(200);

      // And sync should still work
      response = await request(app)
        .post('/api/vaults/vault-1/sync')
        .set('x-user-id', userId)
        .send({ changes: [] });
      expect(response.status).toBe(200);
    });

    it('should count different users independently', async () => {
      // User 1 makes export requests
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/sessions/session-1/export')
          .set('x-user-id', 'user-a');
        expect(response.status).toBe(200);
      }

      // User 1 is rate limited
      let response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', 'user-a');
      expect(response.status).toBe(429);

      // User 2 should have fresh limit
      response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', 'user-b');
      expect(response.status).toBe(200);
    });
  });

  describe('IP-based Rate Limiting (fallback)', () => {
    let freshExportRateLimit: any;

    beforeEach(() => {
      resetRateLimitStore();
      app = express();
      app.use(express.json());
      // Create a fresh rate limit middleware for this test
      freshExportRateLimit = createRateLimitMiddleware({
        windowMs: 60 * 1000,
        maxRequests: 10,
        message: 'Export rate limit exceeded',
      });
      app.get('/api/sessions/:id/export', freshExportRateLimit, (req, res) => {
        res.json({ success: true });
      });
    });

    it('should fall back to IP when no user ID provided', async () => {
      const response = await request(app)
        .get('/api/sessions/session-ip-test/export');

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBe('10');
    });

    it('should track requests per IP when no user ID', async () => {
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/sessions/session-ip-track-test/export');
        expect(response.status).toBe(200);
      }

      // 11th should fail
      const response = await request(app)
        .get('/api/sessions/session-ip-track-test/export');
      expect(response.status).toBe(429);
    });
  });

  describe('Rate Limit Headers Accuracy', () => {
    beforeEach(() => {
      app.get('/api/test', exportRateLimit, (req, res) => {
        res.json({ ok: true });
      });
    });

    it('should decrement remaining header correctly', async () => {
      const userId = 'user-header-test';

      for (let i = 10; i > 0; i--) {
        const response = await request(app)
          .get('/api/test')
          .set('x-user-id', userId);

        const remaining = parseInt(response.headers['x-ratelimit-remaining'] as string);
        expect(remaining).toBe(i - 1);
      }
    });

    it('should show 0 remaining when limit reached', async () => {
      const userId = 'user-zero-remaining';

      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/test')
          .set('x-user-id', userId);
      }

      const response = await request(app)
        .get('/api/test')
        .set('x-user-id', userId);

      expect(response.status).toBe(429);
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('should provide valid ISO timestamp in reset header', async () => {
      const userId = 'user-iso-timestamp';

      const response = await request(app)
        .get('/api/test')
        .set('x-user-id', userId);

      const resetTime = response.headers['x-ratelimit-reset'] as string;
      expect(resetTime).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // Should be parseable as Date
      const date = new Date(resetTime);
      expect(date.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Error Scenarios', () => {
    beforeEach(() => {
      app.get('/api/test', exportRateLimit, (req, res) => {
        res.json({ ok: true });
      });
    });

    it('should handle multiple rapid requests correctly', async () => {
      const userId = 'user-rapid';

      // Make 10 rapid requests
      const requests = Array(10)
        .fill(null)
        .map(() =>
          request(app)
            .get('/api/test')
            .set('x-user-id', userId)
        );

      const responses = await Promise.all(requests);

      expect(responses.every((r) => r.status === 200)).toBe(true);

      // 11th should fail
      const response = await request(app)
        .get('/api/test')
        .set('x-user-id', userId);

      expect(response.status).toBe(429);
    });

    it('should properly handle rate limit after successful request', async () => {
      const userId = 'user-after-success';

      // Make 10 successful requests
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .get('/api/test')
          .set('x-user-id', userId);
        expect(response.status).toBe(200);
      }

      // Verify rate limited
      const response = await request(app)
        .get('/api/test')
        .set('x-user-id', userId);
      expect(response.status).toBe(429);

      // Verify response structure
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('retryAfter');
      expect(response.body).toHaveProperty('resetTime');
    });
  });
});
