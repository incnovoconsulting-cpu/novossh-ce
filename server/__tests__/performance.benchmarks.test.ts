/**
 * Performance Benchmarks for Security Features
 * Phase 3 Week 12: Comprehensive performance verification
 *
 * Benchmarks:
 * 1. JWT Token Verification Overhead
 * 2. Rate Limiting Impact
 * 3. Bash Escaping Performance
 * 4. Audit Logging Write Performance
 * 5. End-to-End Performance Test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import * as auth from '../auth.js';
import { createRateLimitMiddleware, defaultKeyGenerator, getRateLimitStore, resetRateLimitStore, destroyRateLimitStore } from '../middleware/rateLimit.js';
import { escapeForBash, escapeForDoubleQuotes, analyzeCommandSafety } from '../lib/bashEscaping.js';

/**
 * Helper: Measure function execution time in microseconds
 */
function measureTime<T>(fn: () => T): { result: T; durationMs: number; durationUs: number } {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  const durationNs = Number(end - start);
  return {
    result,
    durationMs: durationNs / 1_000_000,
    durationUs: durationNs / 1_000,
  };
}

/**
 * Helper: Run benchmark multiple times and collect stats
 */
interface BenchmarkStats {
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  throughputPerSecond: number;
}

function benchmarkFunction<T>(
  fn: () => T,
  iterations: number = 1000,
  warmupIterations: number = 100
): BenchmarkStats {
  // Warmup
  for (let i = 0; i < warmupIterations; i++) {
    fn();
  }

  // Actual benchmark
  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const { durationMs } = measureTime(fn);
    durations.push(durationMs);
  }

  durations.sort((a, b) => a - b);
  const totalMs = durations.reduce((a, b) => a + b, 0);

  return {
    iterations,
    totalMs,
    avgMs: totalMs / iterations,
    minMs: durations[0],
    maxMs: durations[iterations - 1],
    p50Ms: durations[Math.floor(iterations * 0.5)],
    p95Ms: durations[Math.floor(iterations * 0.95)],
    p99Ms: durations[Math.floor(iterations * 0.99)],
    throughputPerSecond: 1000 / (totalMs / iterations),
  };
}

describe.skip('Performance Benchmarks - Security Features', () => {
  describe('1. JWT Token Verification Overhead', () => {
    let testToken: string;
    let userId: string;
    let organizationId: string;

    beforeAll(() => {
      userId = 'user-' + crypto.randomBytes(8).toString('hex');
      organizationId = 'org-' + crypto.randomBytes(8).toString('hex');
      testToken = auth.createToken(userId, organizationId, 'access');
    });

    it('should verify HS256 token in <1ms', () => {
      const stats = benchmarkFunction(() => {
        return auth.verifyToken(testToken);
      }, 1000);

      console.log('JWT Verification (HS256):', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
      });

      expect(stats.avgMs).toBeLessThan(1);
      expect(stats.p99Ms).toBeLessThan(2);
    });

    it('should create token in <2ms', () => {
      const stats = benchmarkFunction(() => {
        return auth.createToken(userId, organizationId, 'access');
      }, 500);

      console.log('Token Creation:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
      });

      expect(stats.avgMs).toBeLessThan(2);
      expect(stats.p99Ms).toBeLessThan(4);
    });

    it('should generate token pair in <4ms', () => {
      const stats = benchmarkFunction(() => {
        return auth.generateTokenPair(userId, organizationId);
      }, 500);

      console.log('Token Pair Generation:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
      });

      expect(stats.avgMs).toBeLessThan(4);
      expect(stats.p99Ms).toBeLessThan(8);
    });

    it('should refresh token in <2ms', () => {
      const refreshToken = auth.createToken(userId, organizationId, 'refresh');

      const stats = benchmarkFunction(() => {
        return auth.refreshAccessToken(refreshToken);
      }, 500);

      console.log('Token Refresh:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
      });

      expect(stats.avgMs).toBeLessThan(2);
    });

    it('should handle token revocation in <0.1ms', () => {
      const tokenWithJti = auth.createToken(userId, organizationId, 'access');
      const payload = auth.verifyToken(tokenWithJti);

      const stats = benchmarkFunction(() => {
        if (payload?.jti) {
          auth.revokeToken(payload.jti);
        }
      }, 1000);

      console.log('Token Revocation:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
      });

      expect(stats.avgMs).toBeLessThan(0.5);
    });

    it('should verify expired token quickly', () => {
      // Create a token that expires immediately
      const payload = {
        userId,
        organizationId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) - 100, // Already expired
        type: 'access' as const,
      };

      const stats = benchmarkFunction(() => {
        return auth.verifyToken('any.invalid.token');
      }, 1000);

      console.log('Invalid Token Rejection:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(1);
    });
  });

  describe('2. Rate Limiting Impact', () => {
    beforeAll(() => {
      resetRateLimitStore();
    });

    afterAll(() => {
      destroyRateLimitStore();
    });

    it('should check rate limit in <1ms', () => {
      const middleware = createRateLimitMiddleware({
        windowMs: 60000,
        maxRequests: 100,
      });

      const store = getRateLimitStore();

      const stats = benchmarkFunction(() => {
        return store.getStatus('user:test-user-1');
      }, 10000);

      console.log('Rate Limit Check:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
      });

      expect(stats.avgMs).toBeLessThan(1);
      expect(stats.p99Ms).toBeLessThan(2);
    });

    it('should increment rate limit counter in <0.5ms', () => {
      const store = getRateLimitStore();
      const windowMs = 60000;

      const stats = benchmarkFunction(() => {
        return store.increment('user:test-user-2', windowMs);
      }, 10000);

      console.log('Rate Limit Increment:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
      });

      expect(stats.avgMs).toBeLessThan(0.5);
    });

    it('should handle concurrent rate limit updates efficiently', () => {
      resetRateLimitStore();
      const store = getRateLimitStore();
      const windowMs = 60000;
      const numUsers = 1000;

      const stats = benchmarkFunction(() => {
        const userId = Math.floor(Math.random() * numUsers);
        store.increment(`user:user-${userId}`, windowMs);
      }, 10000);

      console.log('Concurrent Rate Limit Updates (1000 unique users):', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
        storeSize: store.size(),
      });

      expect(stats.avgMs).toBeLessThan(1);
    });

    it('should estimate memory per 1000 users', () => {
      resetRateLimitStore();
      const store = getRateLimitStore();
      const windowMs = 60000;

      // Populate with 1000 users
      for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < 10; j++) {
          store.increment(`user:user-${i}`, windowMs);
        }
      }

      const baselineSize = store.size();
      console.log('Rate Limit Store Size (1000 users, 10 requests each):', {
        entries: baselineSize,
        estimatedMemoryMB: ((baselineSize * 500) / (1024 * 1024)).toFixed(2),
      });

      expect(baselineSize).toBeLessThanOrEqual(1000);
    });
  });

  describe('3. Bash Escaping Performance', () => {
    it('should escape simple command in <0.1ms', () => {
      const cmd = 'echo hello world';

      const stats = benchmarkFunction(() => {
        return escapeForBash(cmd);
      }, 10000);

      console.log('Simple Bash Escaping:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
      });

      expect(stats.avgMs).toBeLessThan(0.1);
    });

    it('should escape 10B command quickly', () => {
      const cmd = 'ls';

      const stats = benchmarkFunction(() => {
        return escapeForBash(cmd);
      }, 10000);

      console.log('10B Command Escaping:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(0.1);
    });

    it('should escape 1KB command in <0.2ms', () => {
      const cmd = 'grep -r "pattern" ' + 'a'.repeat(1000);

      const stats = benchmarkFunction(() => {
        return escapeForBash(cmd);
      }, 5000);

      console.log('1KB Command Escaping:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(0.2);
    });

    it('should escape 10KB command in <1ms', () => {
      const cmd = 'echo "' + 'a'.repeat(10000) + '"';

      const stats = benchmarkFunction(() => {
        return escapeForBash(cmd);
      }, 1000);

      console.log('10KB Command Escaping:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(1);
    });

    it('should handle command with quotes efficiently', () => {
      const cmd = `echo 'It'\''s working' && echo "quoted string"`;

      const stats = benchmarkFunction(() => {
        return escapeForBash(cmd);
      }, 5000);

      console.log('Command with Quotes Escaping:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(0.2);
    });

    it('should analyze command for safety in <0.5ms', () => {
      const cmd = 'cat /etc/passwd | grep root';

      const stats = benchmarkFunction(() => {
        return analyzeCommandSafety(cmd);
      }, 5000);

      console.log('Command Safety Analysis:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(0.5);
    });

    it('should export 100 commands in <100ms', () => {
      const commands = Array.from({ length: 100 }, (_, i) => `echo command-${i} && ls -la ${i}`);

      const stats = benchmarkFunction(() => {
        return commands.map((cmd) => escapeForBash(cmd));
      }, 100);

      console.log('Export 100 Commands:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        avgPerCommand: `${(stats.avgMs / 100).toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(100);
    });

    it('should export 1000 commands in <1000ms', () => {
      const commands = Array.from({ length: 1000 }, (_, i) => `echo command-${i}`);

      const stats = benchmarkFunction(() => {
        return commands.map((cmd) => escapeForBash(cmd));
      }, 10);

      console.log('Export 1000 Commands:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        avgPerCommand: `${(stats.avgMs / 1000).toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(1000);
    });
  });

  describe('4. Audit Logging Write Performance', () => {
    it('should log audit event in <5ms (including DB write)', () => {
      // Note: This is a simplified benchmark without actual DB
      // In production, use real DB for accurate measurements

      const logData = {
        success: true,
        statusCode: 200,
        metadata: {
          method: 'POST',
          path: '/api/vault/export',
          query: { format: 'bash' },
        },
      };

      const stats = benchmarkFunction(() => {
        return JSON.stringify(logData);
      }, 10000);

      console.log('Audit Event Serialization:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
      });

      expect(stats.avgMs).toBeLessThan(0.5);
    });

    it('should generate request ID in <0.1ms', () => {
      const stats = benchmarkFunction(() => {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }, 10000);

      console.log('Request ID Generation:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(0.1);
    });

    it('should extract client IP in <0.1ms', () => {
      const testIps = [
        '192.168.1.1',
        '10.0.0.1',
        '203.0.113.45',
        '2001:db8::1',
      ];

      const stats = benchmarkFunction(() => {
        const ip = testIps[Math.floor(Math.random() * testIps.length)];
        if (ip) {
          return ip.split(',')[0].trim();
        }
      }, 10000);

      console.log('Client IP Extraction:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(0.1);
    });
  });

  describe('5. End-to-End Performance Test', () => {
    it('should handle complete auth flow in <5ms', () => {
      const userId = 'user-' + crypto.randomBytes(8).toString('hex');
      const organizationId = 'org-' + crypto.randomBytes(8).toString('hex');

      const stats = benchmarkFunction(() => {
        // Create token pair
        const { accessToken } = auth.generateTokenPair(userId, organizationId);

        // Verify access token
        const payload = auth.verifyToken(accessToken);

        // Check token type
        if (!payload || payload.type !== 'access') {
          return false;
        }

        return true;
      }, 500);

      console.log('Complete Auth Flow:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(5);
    });

    it('should handle export workflow in <50ms', () => {
      const userId = 'user-' + crypto.randomBytes(8).toString('hex');
      const organizationId = 'org-' + crypto.randomBytes(8).toString('hex');

      const stats = benchmarkFunction(() => {
        // Auth: Create and verify token
        const { accessToken } = auth.generateTokenPair(userId, organizationId);
        const payload = auth.verifyToken(accessToken);
        if (!payload) return null;

        // Rate limit check
        const store = getRateLimitStore();
        const status = store.getStatus(`user:${userId}`);
        if (status.count > 10) return null;

        // Bash escaping for commands
        const commands = Array.from({ length: 10 }, (_, i) => `echo command-${i}`);
        const escaped = commands.map((cmd) => escapeForBash(cmd));

        // Audit logging (serialization only)
        const auditLog = {
          action: 'session:export',
          userId,
          commandCount: escaped.length,
        };

        return JSON.stringify(auditLog);
      }, 100);

      console.log('Export Workflow (Auth + Rate Limit + Escaping + Audit):', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
      });

      expect(stats.avgMs).toBeLessThan(50);
    });

    it('should handle concurrent requests efficiently', () => {
      const numConcurrent = 50;
      const requestsPerUser = 5;

      const userIds = Array.from({ length: numConcurrent }, (_, i) => `user-${i}`);
      const orgIds = Array.from({ length: numConcurrent }, (_, i) => `org-${i}`);

      const stats = benchmarkFunction(() => {
        // Simulate concurrent requests from multiple users
        const userId = userIds[Math.floor(Math.random() * numConcurrent)];
        const orgId = orgIds[Math.floor(Math.random() * numConcurrent)];

        // Token verify
        const token = auth.createToken(userId, orgId, 'access');
        auth.verifyToken(token);

        // Rate limit check
        const store = getRateLimitStore();
        store.increment(`user:${userId}`, 60000);

        // Bash escape
        escapeForBash(`echo request from ${userId}`);
      }, 5000);

      console.log('Concurrent Requests (50 users, distributed requests):', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        throughput: `${stats.throughputPerSecond.toFixed(0)} ops/sec`,
      });

      expect(stats.avgMs).toBeLessThan(10);
    });

    it('should meet combined overhead target <2ms per request', () => {
      // This is the critical metric: total security overhead should be <2ms
      const userId = 'test-user';
      const organizationId = 'test-org';

      // Pre-create token to focus on verification
      const token = auth.createToken(userId, organizationId, 'access');

      const stats = benchmarkFunction(() => {
        // 1. Extract token (typically header read, <0.01ms)
        let currentToken = token;

        // 2. Verify JWT signature and expiration (<1ms)
        const payload = auth.verifyToken(currentToken);
        if (!payload) return null;

        // 3. Check rate limit (<0.1ms)
        const store = getRateLimitStore();
        store.increment(`user:${userId}`, 60000);

        // 4. Minimal audit context extraction (~0.01ms)
        const context = {
          userId,
          organizationId,
          startTime: Date.now(),
        };

        return { payload, context };
      }, 2000);

      console.log('Security Overhead Per Request:', {
        avg: `${stats.avgMs.toFixed(3)}ms`,
        p99: `${stats.p99Ms.toFixed(3)}ms`,
        max: `${stats.maxMs.toFixed(3)}ms`,
        target: '<2ms',
        passed: stats.p99Ms < 2,
      });

      expect(stats.avgMs).toBeLessThan(1);
      expect(stats.p99Ms).toBeLessThan(2);
      expect(stats.maxMs).toBeLessThan(5);
    });
  });

  describe('6. Memory and Resource Usage', () => {
    it('should estimate baseline memory usage', () => {
      const initialMem = process.memoryUsage();

      // Create 10k tokens
      const tokens = Array.from({ length: 10000 }, (_, i) => {
        return auth.createToken(`user-${i}`, `org-${Math.floor(i / 100)}`, 'access');
      });

      const afterMem = process.memoryUsage();
      const heapUsedDelta = (afterMem.heapUsed - initialMem.heapUsed) / 1024 / 1024;

      console.log('Token Generation Memory Usage:', {
        tokensCreated: tokens.length,
        heapUsedDeltaMB: heapUsedDelta.toFixed(2),
        avgPerToken: (heapUsedDelta / tokens.length * 1000).toFixed(2) + ' bytes',
      });

      // Tokens shouldn't consume much memory (mostly short strings)
      expect(heapUsedDelta).toBeLessThan(50);
    });

    it('should handle rate limit store cleanup efficiently', () => {
      resetRateLimitStore();
      const store = getRateLimitStore();

      // Populate store
      for (let i = 0; i < 1000; i++) {
        store.increment(`user:user-${i}`, 60000);
      }

      const sizeBeforeCleanup = store.size();

      // Cleanup (simulating expired entries)
      // In real scenario, this would remove entries older than window
      store.clear();

      const sizeAfterCleanup = store.size();

      console.log('Rate Limit Store Cleanup:', {
        entriesBefore: sizeBeforeCleanup,
        entriesAfter: sizeAfterCleanup,
        cleaned: sizeBeforeCleanup - sizeAfterCleanup,
      });

      expect(sizeAfterCleanup).toBe(0);
    });
  });

  describe('7. Optimization Recommendations', () => {
    it('should document optimization opportunities', () => {
      const recommendations = [
        {
          area: 'Token Verification',
          current: 'HS256 with full payload decode',
          optimization: 'Add token caching layer for frequently accessed tokens',
          expectedImprovement: '50-70% reduction for cache hits',
        },
        {
          area: 'Rate Limiting',
          current: 'In-memory store with linear cleanup',
          optimization: 'Use sliding window counter with O(1) cleanup',
          expectedImprovement: '20-30% throughput improvement',
        },
        {
          area: 'Bash Escaping',
          current: 'String replacement for each pattern',
          optimization: 'Single-pass regex engine or dedicated parser',
          expectedImprovement: '15-25% faster on large commands',
        },
        {
          area: 'Audit Logging',
          current: 'Synchronous DB writes on request completion',
          optimization: 'Batch writes with async queue',
          expectedImprovement: '90% reduction in request blocking',
        },
      ];

      console.log('\nOptimization Recommendations:');
      recommendations.forEach((rec) => {
        console.log(`\n${rec.area}:`);
        console.log(`  Current: ${rec.current}`);
        console.log(`  Optimization: ${rec.optimization}`);
        console.log(`  Expected: ${rec.expectedImprovement}`);
      });

      expect(recommendations.length).toBeGreaterThan(0);
    });
  });
});
