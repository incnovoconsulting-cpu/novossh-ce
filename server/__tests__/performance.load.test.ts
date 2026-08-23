/**
 * Load Testing Suite for Security Features
 * Phase 3 Week 12: High-concurrency performance verification
 *
 * Tests:
 * 1. 100+ Concurrent Users
 * 2. Sustained Load Test
 * 3. Spike Test
 * 4. Stress Test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import * as auth from '../auth.js';
import { createRateLimitMiddleware, getRateLimitStore, resetRateLimitStore, destroyRateLimitStore } from '../middleware/rateLimit.js';
import { escapeForBash } from '../lib/bashEscaping.js';

/**
 * Helper: Run async operations concurrently and measure
 */
async function runConcurrentOperations<T>(
  operation: () => Promise<T>,
  concurrency: number,
  iterations: number
): Promise<{
  totalOperations: number;
  successCount: number;
  errorCount: number;
  totalTimeMs: number;
  opsPerSecond: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: string;
}> {
  const latencies: number[] = [];
  let successCount = 0;
  let errorCount = 0;

  const startTime = Date.now();

  // Run in batches to control concurrency
  for (let batch = 0; batch < iterations; batch += concurrency) {
    const batchSize = Math.min(concurrency, iterations - batch);
    const promises: Promise<void>[] = [];

    for (let i = 0; i < batchSize; i++) {
      promises.push(
        (async () => {
          const opStart = Date.now();
          try {
            await operation();
            latencies.push(Date.now() - opStart);
            successCount++;
          } catch (error) {
            latencies.push(Date.now() - opStart);
            errorCount++;
          }
        })()
      );
    }

    await Promise.all(promises);
  }

  const totalTimeMs = Date.now() - startTime;
  latencies.sort((a, b) => a - b);

  return {
    totalOperations: iterations,
    successCount,
    errorCount,
    totalTimeMs,
    opsPerSecond: (iterations / (totalTimeMs / 1000)),
    avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)],
    p99LatencyMs: latencies[Math.floor(latencies.length * 0.99)],
    successRate: `${((successCount / iterations) * 100).toFixed(2)}%`,
  };
}

describe.skip('Load Testing - Security Features', () => {
  let testUsers: Array<{ userId: string; organizationId: string }>;

  beforeAll(() => {
    resetRateLimitStore();
    // Create test users
    testUsers = Array.from({ length: 100 }, (_, i) => ({
      userId: `load-test-user-${i}`,
      organizationId: `load-test-org-${Math.floor(i / 10)}`,
    }));
  });

  afterAll(() => {
    destroyRateLimitStore();
  });

  describe('1. 100+ Concurrent Users', () => {
    it('should handle 100 concurrent token verification requests', async () => {
      const tokens = testUsers.slice(0, 100).map((user) =>
        auth.createToken(user.userId, user.organizationId, 'access')
      );

      let tokenIndex = 0;
      const results = await runConcurrentOperations(
        async () => {
          const token = tokens[tokenIndex % tokens.length];
          tokenIndex++;
          const payload = auth.verifyToken(token);
          if (!payload) throw new Error('Verification failed');
        },
        100,
        1000
      );

      console.log('100 Concurrent Users - Token Verification:', {
        opsPerSec: results.opsPerSecond.toFixed(0),
        avgLatency: `${results.avgLatencyMs.toFixed(3)}ms`,
        p95Latency: `${results.p95LatencyMs.toFixed(3)}ms`,
        p99Latency: `${results.p99LatencyMs.toFixed(3)}ms`,
        errorRate: `${((results.errorCount / results.totalOperations) * 100).toFixed(2)}%`,
      });

      expect(results.errorCount).toBe(0);
      expect(results.p99LatencyMs).toBeLessThan(5);
    });

    it('should handle 100 concurrent rate limit checks', async () => {
      const store = getRateLimitStore();

      let userIndex = 0;
      const results = await runConcurrentOperations(
        async () => {
          const user = testUsers[userIndex % testUsers.length];
          userIndex++;
          const status = store.getStatus(`user:${user.userId}`);
          if (!status) throw new Error('Rate limit check failed');
        },
        100,
        1000
      );

      console.log('100 Concurrent Users - Rate Limit Checks:', {
        opsPerSec: results.opsPerSecond.toFixed(0),
        avgLatency: `${results.avgLatencyMs.toFixed(3)}ms`,
        p95Latency: `${results.p95LatencyMs.toFixed(3)}ms`,
        p99Latency: `${results.p99LatencyMs.toFixed(3)}ms`,
      });

      expect(results.p99LatencyMs).toBeLessThan(1);
    });

    it('should handle 100 concurrent bash escaping operations', async () => {
      const commands = [
        'ls -la',
        'echo "hello world"',
        'grep -r "pattern" /',
        'cat /etc/passwd',
        'ps aux | head -20',
      ];

      let cmdIndex = 0;
      const results = await runConcurrentOperations(
        async () => {
          const cmd = commands[cmdIndex % commands.length];
          cmdIndex++;
          const escaped = escapeForBash(cmd);
          if (!escaped) throw new Error('Escaping failed');
        },
        100,
        1000
      );

      console.log('100 Concurrent Users - Bash Escaping:', {
        opsPerSec: results.opsPerSecond.toFixed(0),
        avgLatency: `${results.avgLatencyMs.toFixed(3)}ms`,
        p95Latency: `${results.p95LatencyMs.toFixed(3)}ms`,
      });

      expect(results.errorCount).toBe(0);
    });

    it('should handle 100+ concurrent mixed operations', async () => {
      const store = getRateLimitStore();
      const commands = ['ls', 'echo test', 'pwd', 'whoami'];

      let opCount = 0;
      const results = await runConcurrentOperations(
        async () => {
          const user = testUsers[opCount % testUsers.length];
          opCount++;

          // Mix of operations
          const token = auth.createToken(user.userId, user.organizationId, 'access');
          auth.verifyToken(token);

          store.increment(`user:${user.userId}`, 60000);

          const cmd = commands[opCount % commands.length];
          escapeForBash(cmd);
        },
        100,
        2000
      );

      console.log('100+ Concurrent Users - Mixed Operations:', {
        opsPerSec: results.opsPerSecond.toFixed(0),
        avgLatency: `${results.avgLatencyMs.toFixed(3)}ms`,
        p95Latency: `${results.p95LatencyMs.toFixed(3)}ms`,
        p99Latency: `${results.p99LatencyMs.toFixed(3)}ms`,
        successRate: `${((results.successCount / results.totalOperations) * 100).toFixed(2)}%`,
      });

      expect(results.errorCount).toBe(0);
      expect(results.opsPerSecond).toBeGreaterThan(1000);
    });
  });

  describe('2. Sustained Load Test', () => {
    it('should maintain performance under sustained load for 30s', async () => {
      const store = getRateLimitStore();
      resetRateLimitStore();

      const startTime = Date.now();
      const durationMs = 30000; // 30 seconds
      let operationCount = 0;
      const latencies: number[] = [];

      const runOperation = () => {
        const user = testUsers[operationCount % testUsers.length];
        operationCount++;

        const opStart = Date.now();

        // Token verification
        const token = auth.createToken(user.userId, user.organizationId, 'access');
        auth.verifyToken(token);

        // Rate limit check
        store.increment(`user:${user.userId}`, 60000);

        // Bash escaping
        escapeForBash(`echo operation-${operationCount}`);

        latencies.push(Date.now() - opStart);
      };

      // Run operations in batches
      while (Date.now() - startTime < durationMs) {
        const batchSize = 50;
        for (let i = 0; i < batchSize; i++) {
          runOperation();
        }
      }

      latencies.sort((a, b) => a - b);
      const totalTimeMs = Date.now() - startTime;

      console.log('Sustained Load Test (30 seconds):', {
        totalOperations: operationCount,
        opsPerSec: (operationCount / (totalTimeMs / 1000)).toFixed(0),
        avgLatency: `${(latencies.reduce((a, b) => a + b) / latencies.length).toFixed(3)}ms`,
        p95Latency: `${latencies[Math.floor(latencies.length * 0.95)].toFixed(3)}ms`,
        p99Latency: `${latencies[Math.floor(latencies.length * 0.99)].toFixed(3)}ms`,
        maxLatency: `${latencies[latencies.length - 1].toFixed(3)}ms`,
      });

      expect(operationCount).toBeGreaterThan(500); // At least ~16 ops/sec
    });
  });

  describe('3. Spike Test', () => {
    it('should handle sudden spike from 10 to 200 concurrent users', async () => {
      const store = getRateLimitStore();
      resetRateLimitStore();

      // Warm up with 10 users
      const warmupResults = await runConcurrentOperations(
        async () => {
          const user = testUsers[Math.floor(Math.random() * 10)];
          const token = auth.createToken(user.userId, user.organizationId, 'access');
          auth.verifyToken(token);
          store.increment(`user:${user.userId}`, 60000);
        },
        10,
        100
      );

      console.log('Spike Test - Warmup (10 users):', {
        opsPerSec: warmupResults.opsPerSecond.toFixed(0),
        p99Latency: `${warmupResults.p99LatencyMs.toFixed(3)}ms`,
      });

      // Spike to 200 concurrent users
      const spikeResults = await runConcurrentOperations(
        async () => {
          const user = testUsers[Math.floor(Math.random() * testUsers.length)];
          const token = auth.createToken(user.userId, user.organizationId, 'access');
          auth.verifyToken(token);
          store.increment(`user:${user.userId}`, 60000);
        },
        200,
        1000
      );

      console.log('Spike Test - Spike (200 users):', {
        opsPerSec: spikeResults.opsPerSecond.toFixed(0),
        avgLatency: `${spikeResults.avgLatencyMs.toFixed(3)}ms`,
        p99Latency: `${spikeResults.p99LatencyMs.toFixed(3)}ms`,
        degradation: `${(((spikeResults.p99LatencyMs - warmupResults.p99LatencyMs) / warmupResults.p99LatencyMs) * 100).toFixed(1)}%`,
      });

      // Performance shouldn't degrade too much (allow 100% increase in p99)
      expect(spikeResults.p99LatencyMs).toBeLessThan(warmupResults.p99LatencyMs * 2);
    });
  });

  describe('4. Stress Test', () => {
    it('should handle 500 concurrent operations without crashes', async () => {
      const store = getRateLimitStore();
      resetRateLimitStore();

      let operationCount = 0;
      const results = await runConcurrentOperations(
        async () => {
          const user = testUsers[operationCount % testUsers.length];
          operationCount++;

          try {
            // Token operations
            const token = auth.createToken(user.userId, user.organizationId, 'access');
            auth.verifyToken(token);

            // Rate limiting
            store.increment(`user:${user.userId}`, 60000);

            // Bash escaping with random commands
            const commands = [
              'ls',
              'echo test',
              'grep pattern',
              'cat file',
              'find . -name "*.js"',
            ];
            const cmd = commands[operationCount % commands.length];
            escapeForBash(cmd);
          } catch (error) {
            throw error;
          }
        },
        500,
        5000
      );

      console.log('Stress Test (500 concurrent operations):', {
        totalOps: results.totalOperations,
        successCount: results.successCount,
        errorCount: results.errorCount,
        opsPerSec: results.opsPerSecond.toFixed(0),
        avgLatency: `${results.avgLatencyMs.toFixed(3)}ms`,
        p99Latency: `${results.p99LatencyMs.toFixed(3)}ms`,
        successRate: `${((results.successCount / results.totalOperations) * 100).toFixed(2)}%`,
      });

      expect(results.errorCount).toBe(0);
      expect(results.successCount / results.totalOperations).toBe(1);
    });

    it('should recover from stress gracefully', async () => {
      const store = getRateLimitStore();

      // Stress phase
      const stressResults = await runConcurrentOperations(
        async () => {
          const user = testUsers[Math.floor(Math.random() * testUsers.length)];
          const token = auth.createToken(user.userId, user.organizationId, 'access');
          auth.verifyToken(token);
          store.increment(`user:${user.userId}`, 60000);
        },
        500,
        2000
      );

      // Recovery phase - back to normal load
      const recoveryResults = await runConcurrentOperations(
        async () => {
          const user = testUsers[Math.floor(Math.random() * testUsers.length)];
          const token = auth.createToken(user.userId, user.organizationId, 'access');
          auth.verifyToken(token);
        },
        10,
        100
      );

      console.log('Stress Test - Recovery:', {
        stressOpsPerSec: stressResults.opsPerSecond.toFixed(0),
        recoveryOpsPerSec: recoveryResults.opsPerSecond.toFixed(0),
        stressP99: `${stressResults.p99LatencyMs.toFixed(3)}ms`,
        recoveryP99: `${recoveryResults.p99LatencyMs.toFixed(3)}ms`,
        improvement: `${(((stressResults.p99LatencyMs - recoveryResults.p99LatencyMs) / stressResults.p99LatencyMs) * 100).toFixed(1)}%`,
      });

      // Recovery should be significantly better
      expect(recoveryResults.p99LatencyMs).toBeLessThan(stressResults.p99LatencyMs);
    });
  });

  describe('5. Latency Distribution Analysis', () => {
    it('should provide latency percentile breakdown', async () => {
      const store = getRateLimitStore();
      resetRateLimitStore();

      let opCount = 0;
      const latencies: number[] = [];

      for (let i = 0; i < 10000; i++) {
        const user = testUsers[opCount % testUsers.length];
        opCount++;

        const start = Date.now();

        const token = auth.createToken(user.userId, user.organizationId, 'access');
        auth.verifyToken(token);
        store.increment(`user:${user.userId}`, 60000);

        latencies.push(Date.now() - start);
      }

      latencies.sort((a, b) => a - b);

      const percentiles = {
        p50: latencies[Math.floor(latencies.length * 0.5)],
        p75: latencies[Math.floor(latencies.length * 0.75)],
        p90: latencies[Math.floor(latencies.length * 0.9)],
        p95: latencies[Math.floor(latencies.length * 0.95)],
        p99: latencies[Math.floor(latencies.length * 0.99)],
        p99_9: latencies[Math.floor(latencies.length * 0.999)],
      };

      console.log('Latency Distribution (10,000 mixed operations):', {
        p50: `${percentiles.p50}ms`,
        p75: `${percentiles.p75}ms`,
        p90: `${percentiles.p90}ms`,
        p95: `${percentiles.p95}ms`,
        p99: `${percentiles.p99}ms`,
        p99_9: `${percentiles.p99_9}ms`,
        min: `${latencies[0]}ms`,
        max: `${latencies[latencies.length - 1]}ms`,
      });

      // Verify latency targets
      expect(percentiles.p99).toBeLessThan(5);
    });
  });

  describe('6. Resource Monitoring', () => {
    it('should log memory usage under load', async () => {
      const initialMem = process.memoryUsage();

      const store = getRateLimitStore();
      resetRateLimitStore();

      // Create heavy load
      await runConcurrentOperations(
        async () => {
          const user = testUsers[Math.floor(Math.random() * testUsers.length)];
          const token = auth.createToken(user.userId, user.organizationId, 'access');
          auth.verifyToken(token);
          store.increment(`user:${user.userId}`, 60000);
        },
        100,
        1000
      );

      const finalMem = process.memoryUsage();

      console.log('Memory Usage Under Load:', {
        heapUsedDeltaMB: ((finalMem.heapUsed - initialMem.heapUsed) / 1024 / 1024).toFixed(2),
        externalDeltaMB: ((finalMem.external - initialMem.external) / 1024 / 1024).toFixed(2),
        rssUsedMB: (finalMem.rss / 1024 / 1024).toFixed(2),
      });

      // Memory delta should be reasonable
      expect((finalMem.heapUsed - initialMem.heapUsed) / 1024 / 1024).toBeLessThan(100);
    });
  });
});
