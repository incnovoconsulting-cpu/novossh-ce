/**
 * Comprehensive Performance Benchmark Suite
 * Phase 3 Week 12: Performance Verification & Optimization
 *
 * Focus Areas:
 * 1. JWT Token Verification Overhead
 * 2. Rate Limiting Impact
 * 3. Bash Escaping Performance
 * 4. Audit Logging Write Performance
 * 5. End-to-End Performance with All Security Features
 * 6. Performance Under Real-World Conditions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import * as auth from '../auth.js';
import { createRateLimitMiddleware, getRateLimitStore, resetRateLimitStore, destroyRateLimitStore } from '../middleware/rateLimit.js';
import { escapeForBash, analyzeCommandSafety } from '../lib/bashEscaping.js';

/**
 * Benchmark result with comprehensive metrics
 */
interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTimeMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  stddevLatencyMs: number;
  p50LatencyMs: number;
  p75LatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputPerSec: number;
  memoryDeltaMB: number;
}

/**
 * Run a synchronous benchmark and collect detailed metrics
 */
function benchmarkSync(
  name: string,
  operation: () => void,
  iterations: number = 1000
): BenchmarkResult {
  const latencies: number[] = [];
  const initialMem = process.memoryUsage().heapUsed;

  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    const opStart = performance.now();
    operation();
    latencies.push(performance.now() - opStart);
  }

  const totalTimeMs = performance.now() - startTime;
  const finalMem = process.memoryUsage().heapUsed;

  latencies.sort((a, b) => a - b);

  const avg = latencies.reduce((a, b) => a + b) / latencies.length;
  const variance = latencies.reduce((a, b) => a + Math.pow(b - avg, 2)) / latencies.length;
  const stddev = Math.sqrt(variance);

  return {
    name,
    iterations,
    totalTimeMs,
    avgLatencyMs: avg,
    minLatencyMs: latencies[0],
    maxLatencyMs: latencies[latencies.length - 1],
    stddevLatencyMs: stddev,
    p50LatencyMs: latencies[Math.floor(latencies.length * 0.5)],
    p75LatencyMs: latencies[Math.floor(latencies.length * 0.75)],
    p90LatencyMs: latencies[Math.floor(latencies.length * 0.9)],
    p95LatencyMs: latencies[Math.floor(latencies.length * 0.95)],
    p99LatencyMs: latencies[Math.floor(latencies.length * 0.99)],
    throughputPerSec: (iterations / (totalTimeMs / 1000)),
    memoryDeltaMB: (finalMem - initialMem) / 1024 / 1024,
  };
}

/**
 * Format a benchmark result for logging
 */
function formatResult(result: BenchmarkResult): Record<string, string> {
  return {
    iterations: result.iterations.toString(),
    avgLatency: `${result.avgLatencyMs.toFixed(4)}ms`,
    p95Latency: `${result.p95LatencyMs.toFixed(4)}ms`,
    p99Latency: `${result.p99LatencyMs.toFixed(4)}ms`,
    minLatency: `${result.minLatencyMs.toFixed(4)}ms`,
    maxLatency: `${result.maxLatencyMs.toFixed(4)}ms`,
    throughput: `${result.throughputPerSec.toFixed(0)} ops/sec`,
    memoryDelta: `${result.memoryDeltaMB.toFixed(2)}MB`,
    totalTime: `${result.totalTimeMs.toFixed(1)}ms`,
  };
}

describe.skip('Performance Benchmarks - Security Features', () => {
  beforeAll(() => {
    resetRateLimitStore();
  });

  afterAll(() => {
    destroyRateLimitStore();
  });

  // ============================================================================
  // 1. JWT TOKEN VERIFICATION OVERHEAD
  // ============================================================================
  describe('1. JWT Token Verification Overhead', () => {
    it('should benchmark HS256 token creation', () => {
      const result = benchmarkSync('HS256 Token Creation', () => {
        auth.createToken('test-user-1', 'org-1', 'access');
      }, 1000);

      console.log('\nHS256 Token Creation:', formatResult(result));
      expect(result.p99LatencyMs).toBeLessThan(5);
      expect(result.avgLatencyMs).toBeLessThan(2);
    });

    it('should benchmark HS256 token verification', () => {
      const token = auth.createToken('test-user-1', 'org-1', 'access');

      const result = benchmarkSync('HS256 Token Verification', () => {
        const payload = auth.verifyToken(token);
        if (!payload) throw new Error('Verification failed');
      }, 5000);

      console.log('HS256 Token Verification:', formatResult(result));
      expect(result.p99LatencyMs).toBeLessThan(2);
      expect(result.avgLatencyMs).toBeLessThan(1);
    });

    it('should benchmark token pair generation', () => {
      const result = benchmarkSync('Token Pair Generation', () => {
        auth.generateTokenPair('test-user-1', 'org-1');
      }, 1000);

      console.log('Token Pair Generation:', formatResult(result));
      expect(result.avgLatencyMs).toBeLessThan(5);
    });

    it('should benchmark token refresh operation', () => {
      const refreshToken = auth.createToken('test-user-1', 'org-1', 'refresh');

      const result = benchmarkSync('Token Refresh', () => {
        const newTokens = auth.refreshAccessToken(refreshToken);
        if (!newTokens) throw new Error('Refresh failed');
      }, 1000);

      console.log('Token Refresh Operation:', formatResult(result));
      expect(result.avgLatencyMs).toBeLessThan(5);
    });

    it('should measure per-request JWT overhead vs baseline', () => {
      // Baseline: simple object operation
      const baselineResult = benchmarkSync('Baseline (No Auth)', () => {
        const obj = { userId: 'user-1', orgId: 'org-1' };
        const _ = obj.userId;
      }, 10000);

      // With JWT verification
      const token = auth.createToken('user-1', 'org-1', 'access');
      const jwtResult = benchmarkSync('With JWT Verification', () => {
        const payload = auth.verifyToken(token);
        if (!payload) throw new Error('Verification failed');
      }, 10000);

      const overhead = jwtResult.avgLatencyMs - baselineResult.avgLatencyMs;
      console.log('JWT Overhead Analysis:', {
        baseline: `${baselineResult.avgLatencyMs.toFixed(4)}ms`,
        withJWT: `${jwtResult.avgLatencyMs.toFixed(4)}ms`,
        overhead: `${overhead.toFixed(4)}ms`,
        overheadPercent: `${((overhead / baselineResult.avgLatencyMs) * 100).toFixed(1)}%`,
      });

      // Overhead should be minimal (<1ms)
      expect(overhead).toBeLessThan(1);
    });

    it('should measure throughput impact on request pipeline', () => {
      const tokens = Array.from({ length: 10 }, (_, i) =>
        auth.createToken(`user-${i}`, 'org-1', 'access')
      );

      let tokenIdx = 0;
      const result = benchmarkSync('Full Request Auth Pipeline', () => {
        const token = tokens[tokenIdx % tokens.length];
        tokenIdx++;

        // Simulate full auth pipeline
        const payload = auth.verifyToken(token);
        if (!payload) throw new Error('Auth failed');

        // Check token type
        if (payload.type !== 'access') throw new Error('Wrong token type');

        // Access user info
        const userId = payload.userId;
        if (!userId) throw new Error('No user ID');
      }, 5000);

      console.log('Full Request Auth Pipeline:', formatResult(result));
      expect(result.throughputPerSec).toBeGreaterThan(2500);
    });
  });

  // ============================================================================
  // 2. RATE LIMITING IMPACT
  // ============================================================================
  describe('2. Rate Limiting Impact', () => {
    it('should benchmark rate limit check overhead', () => {
      const store = getRateLimitStore();

      const result = benchmarkSync('Rate Limit Check', () => {
        const status = store.getStatus('user:test-user-1');
        if (!status) throw new Error('Check failed');
      }, 10000);

      console.log('\nRate Limit Check:', formatResult(result));
      expect(result.p99LatencyMs).toBeLessThan(0.5);
      expect(result.avgLatencyMs).toBeLessThan(0.1);
    });

    it('should benchmark rate limit increment operation', () => {
      const store = getRateLimitStore();
      resetRateLimitStore();

      const result = benchmarkSync('Rate Limit Increment', () => {
        const key = `user:test-user-${Math.floor(Math.random() * 100)}`;
        store.increment(key, 60000);
      }, 10000);

      console.log('Rate Limit Increment:', formatResult(result));
      expect(result.p99LatencyMs).toBeLessThan(1);
    });

    it('should benchmark rate limit with many concurrent users', () => {
      resetRateLimitStore();
      const store = getRateLimitStore();

      let userIdx = 0;
      const result = benchmarkSync('Rate Limit (100 Users)', () => {
        userIdx = (userIdx + 1) % 100;
        store.increment(`user:user-${userIdx}`, 60000);
      }, 10000);

      console.log('Rate Limit with 100 Concurrent Users:', formatResult(result));
      expect(result.p95LatencyMs).toBeLessThan(1);
    });

    it('should measure memory usage per 1000 users', () => {
      resetRateLimitStore();
      const store = getRateLimitStore();

      const initialMem = process.memoryUsage().heapUsed;

      // Create 1000 users and track requests
      for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < 10; j++) {
          store.increment(`user:user-${i}`, 60000);
        }
      }

      const finalMem = process.memoryUsage().heapUsed;
      const memPerUser = (finalMem - initialMem) / 1000 / 1024; // KB per user

      console.log('Rate Limit Memory Usage:', {
        perUserKB: `${memPerUser.toFixed(2)}KB`,
        for1000Users: `${((finalMem - initialMem) / 1024 / 1024).toFixed(2)}MB`,
        storeSize: store.size(),
      });

      expect(memPerUser).toBeLessThan(10); // < 10KB per user
    });

    it('should measure rate limit check + auth overhead combined', () => {
      const store = getRateLimitStore();
      const token = auth.createToken('test-user', 'org-1', 'access');

      const result = benchmarkSync('Auth + Rate Limit Check', () => {
        // Check rate limit
        const status = store.getStatus('user:test-user');
        if (!status) throw new Error('Rate limit check failed');

        // Verify token
        const payload = auth.verifyToken(token);
        if (!payload) throw new Error('Auth failed');
      }, 5000);

      console.log('Combined Auth + Rate Limit:', formatResult(result));
      expect(result.avgLatencyMs).toBeLessThan(2);
    });
  });

  // ============================================================================
  // 3. BASH ESCAPING PERFORMANCE
  // ============================================================================
  describe('3. Bash Escaping Performance', () => {
    it('should benchmark escapeForBash with small commands (10B)', () => {
      const commands = ['ls', 'pwd', 'echo', 'cat', 'grep'];

      let cmdIdx = 0;
      const result = benchmarkSync('Escape Small Command (10B)', () => {
        const cmd = commands[cmdIdx % commands.length];
        cmdIdx++;
        escapeForBash(cmd);
      }, 10000);

      console.log('\nEscape Small Command (10B):', formatResult(result));
      expect(result.p99LatencyMs).toBeLessThan(0.1);
    });

    it('should benchmark escapeForBash with medium commands (100B)', () => {
      const commands = [
        'find . -name "*.txt" -type f',
        'grep -r "pattern" /var/log',
        'ps aux | grep "node"',
        'ls -lah /home/user/projects',
        'echo "Hello World" | tee output.txt',
      ];

      let cmdIdx = 0;
      const result = benchmarkSync('Escape Medium Command (100B)', () => {
        const cmd = commands[cmdIdx % commands.length];
        cmdIdx++;
        escapeForBash(cmd);
      }, 10000);

      console.log('Escape Medium Command (100B):', formatResult(result));
      expect(result.p99LatencyMs).toBeLessThan(0.2);
    });

    it('should benchmark escapeForBash with large commands (1KB)', () => {
      const largeCmd = 'echo "' + 'x'.repeat(900) + '"';

      const result = benchmarkSync('Escape Large Command (1KB)', () => {
        escapeForBash(largeCmd);
      }, 5000);

      console.log('Escape Large Command (1KB):', formatResult(result));
      expect(result.p99LatencyMs).toBeLessThan(0.5);
    });

    it('should benchmark escapeForBash with very large commands (10KB)', () => {
      const veryLargeCmd = 'echo "' + 'x'.repeat(9900) + '"';

      const result = benchmarkSync('Escape Very Large Command (10KB)', () => {
        escapeForBash(veryLargeCmd);
      }, 1000);

      console.log('Escape Very Large Command (10KB):', formatResult(result));
      expect(result.avgLatencyMs).toBeLessThan(2);
    });

    it('should benchmark analyzeCommandSafety', () => {
      const commands = [
        'ls -la',
        '$(whoami)',
        'echo "test" | grep test',
        'find . -name "*.txt"',
        'rm -rf /',
      ];

      let cmdIdx = 0;
      const result = benchmarkSync('Analyze Command Safety', () => {
        const cmd = commands[cmdIdx % commands.length];
        cmdIdx++;
        analyzeCommandSafety(cmd);
      }, 5000);

      console.log('Analyze Command Safety:', formatResult(result));
      expect(result.p99LatencyMs).toBeLessThan(1);
    });

    it('should measure bash escaping for batch export (100 commands)', () => {
      const commands = Array.from({ length: 100 }, (_, i) => `echo "command-${i}"`);

      const result = benchmarkSync('Batch Export (100 commands)', () => {
        for (const cmd of commands) {
          escapeForBash(cmd);
        }
      }, 100);

      console.log('Batch Export 100 Commands:', {
        ...formatResult(result),
        perCommand: `${(result.avgLatencyMs / 100).toFixed(4)}ms`,
        totalFor100: `${(result.avgLatencyMs).toFixed(2)}ms`,
      });

      expect(result.avgLatencyMs / 100).toBeLessThan(0.1);
    });

    it('should measure bash escaping for large batch (1000 commands)', () => {
      const commands = Array.from({ length: 1000 }, (_, i) => `echo "cmd-${i}"`);

      const result = benchmarkSync('Batch Export (1000 commands)', () => {
        for (const cmd of commands) {
          escapeForBash(cmd);
        }
      }, 10);

      console.log('Batch Export 1000 Commands:', {
        ...formatResult(result),
        perCommand: `${(result.avgLatencyMs / 1000).toFixed(4)}ms`,
        total: `${(result.avgLatencyMs).toFixed(2)}ms`,
      });

      expect(result.avgLatencyMs / 1000).toBeLessThan(0.1);
    });
  });

  // ============================================================================
  // 4. AUDIT LOGGING WRITE PERFORMANCE
  // ============================================================================
  describe('4. Audit Logging Write Performance', () => {
    it('should benchmark audit event data structure creation', () => {
      const result = benchmarkSync('Audit Event Creation', () => {
        const event = {
          organizationId: 'org-1',
          teamId: 'team-1',
          userId: 'user-1',
          action: 'session:export',
          resourceType: 'session',
          resourceId: 'session-123',
          details: {
            success: true,
            statusCode: 200,
            duration: 45,
            commandCount: 100,
          },
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date().toISOString(),
        };

        // Simulate JSON serialization
        JSON.stringify(event);
      }, 10000);

      console.log('\nAudit Event Creation:', formatResult(result));
      expect(result.avgLatencyMs).toBeLessThan(0.5);
    });

    it('should benchmark audit event JSON serialization', () => {
      const events = Array.from({ length: 1000 }, (_, i) => ({
        organizationId: 'org-1',
        teamId: 'team-1',
        userId: 'user-1',
        action: ['session:export', 'session:playback', 'vault:access'][i % 3],
        resourceType: 'session',
        resourceId: `session-${i}`,
        details: {
          success: true,
          statusCode: 200,
          duration: Math.random() * 100,
          commandCount: Math.floor(Math.random() * 1000),
        },
        timestamp: new Date().toISOString(),
      }));

      const result = benchmarkSync('Audit Batch Serialization (1000 events)', () => {
        for (const event of events) {
          JSON.stringify(event);
        }
      }, 10);

      console.log('Audit Batch Serialization:', {
        ...formatResult(result),
        perEvent: `${(result.avgLatencyMs / 1000).toFixed(4)}ms`,
      });
    });

    it('should measure concurrent audit event creation', () => {
      let eventCount = 0;
      const result = benchmarkSync('Concurrent Audit Events (simulated)', () => {
        eventCount++;
        const event = {
          id: `audit-${eventCount}`,
          timestamp: Date.now(),
          action: `action-${eventCount % 10}`,
          userId: `user-${eventCount % 100}`,
          details: {
            duration: Math.random() * 100,
          },
        };
        JSON.stringify(event);
      }, 10000);

      console.log('Concurrent Audit Events:', formatResult(result));
      expect(result.throughputPerSec).toBeGreaterThan(5000);
    });
  });

  // ============================================================================
  // 5. END-TO-END SECURITY PIPELINE PERFORMANCE
  // ============================================================================
  describe('5. End-to-End Security Pipeline', () => {
    it('should benchmark full auth + rate limit + audit pipeline', () => {
      resetRateLimitStore();
      const store = getRateLimitStore();
      const tokens = Array.from({ length: 10 }, (_, i) =>
        auth.createToken(`user-${i}`, 'org-1', 'access')
      );

      let tokenIdx = 0;
      const result = benchmarkSync('Full Security Pipeline', () => {
        tokenIdx = (tokenIdx + 1) % tokens.length;
        const token = tokens[tokenIdx];

        // Step 1: Verify JWT token
        const payload = auth.verifyToken(token);
        if (!payload) throw new Error('Auth failed');

        // Step 2: Check rate limits
        const status = store.getStatus(`user:${payload.userId}`);
        if (!status) throw new Error('Rate limit check failed');
        store.increment(`user:${payload.userId}`, 60000);

        // Step 3: Create audit event
        const auditEvent = {
          userId: payload.userId,
          action: 'session:export',
          timestamp: Date.now(),
        };
        JSON.stringify(auditEvent);
      }, 5000);

      console.log('\nFull Security Pipeline:', formatResult(result));
      expect(result.avgLatencyMs).toBeLessThan(3);
    });

    it('should benchmark auth + export escaping pipeline', () => {
      const token = auth.createToken('test-user', 'org-1', 'access');
      const commands = ['ls', 'pwd', 'echo test', 'grep pattern', 'find .'];

      let cmdIdx = 0;
      const result = benchmarkSync('Auth + Export Escaping Pipeline', () => {
        // Verify token
        const payload = auth.verifyToken(token);
        if (!payload) throw new Error('Auth failed');

        // Escape command for export
        const cmd = commands[cmdIdx % commands.length];
        cmdIdx++;
        escapeForBash(cmd);
      }, 10000);

      console.log('Auth + Export Escaping:', formatResult(result));
      expect(result.avgLatencyMs).toBeLessThan(2);
    });

    it('should benchmark full session export security pipeline', () => {
      resetRateLimitStore();
      const store = getRateLimitStore();
      const token = auth.createToken('test-user', 'org-1', 'access');
      const commands = Array.from({ length: 50 }, (_, i) => `echo "command-${i}"`);

      const result = benchmarkSync('Session Export Security Pipeline', () => {
        // 1. Verify token
        const payload = auth.verifyToken(token);
        if (!payload) throw new Error('Auth failed');

        // 2. Check rate limits
        store.increment(`user:${payload.userId}`, 60000);

        // 3. Escape and export 50 commands
        for (const cmd of commands) {
          escapeForBash(cmd);
        }

        // 4. Create audit event
        JSON.stringify({
          action: 'session:export',
          commandCount: commands.length,
          timestamp: Date.now(),
        });
      }, 100);

      console.log('Session Export Security Pipeline:', {
        ...formatResult(result),
        perCommand: `${(result.avgLatencyMs / 50).toFixed(4)}ms`,
      });
    });
  });

  // ============================================================================
  // 6. PERFORMANCE DEGRADATION UNDER LOAD
  // ============================================================================
  describe('6. Performance Degradation Analysis', () => {
    it('should measure performance with increasing user count', () => {
      const userCounts = [1, 10, 50, 100, 200];
      const results: Record<number, number> = {};

      for (const userCount of userCounts) {
        resetRateLimitStore();
        const store = getRateLimitStore();

        let userIdx = 0;
        const benchmark = benchmarkSync(`Rate Limit Check (${userCount} users)`, () => {
          userIdx = (userIdx + 1) % userCount;
          store.getStatus(`user:user-${userIdx}`);
        }, 5000);

        results[userCount] = benchmark.avgLatencyMs;
      }

      console.log('\nPerformance vs User Count:', {
        '1 user': `${results[1].toFixed(4)}ms`,
        '10 users': `${results[10].toFixed(4)}ms`,
        '50 users': `${results[50].toFixed(4)}ms`,
        '100 users': `${results[100].toFixed(4)}ms`,
        '200 users': `${results[200].toFixed(4)}ms`,
        degradation: `${(((results[200] - results[1]) / results[1]) * 100).toFixed(1)}%`,
      });

      // Degradation should be minimal (< 50%)
      expect(results[200] / results[1]).toBeLessThan(1.5);
    });

    it('should measure token verification consistency', () => {
      const token = auth.createToken('test-user', 'org-1', 'access');
      const iterations = [1000, 5000, 10000];

      const results: Record<number, BenchmarkResult> = {};

      for (const count of iterations) {
        const result = benchmarkSync(`Token Verify (${count} iterations)`, () => {
          auth.verifyToken(token);
        }, count);

        results[count] = result;
      }

      console.log('Token Verification Consistency:', {
        '1k iterations': `${results[1000].avgLatencyMs.toFixed(4)}ms`,
        '5k iterations': `${results[5000].avgLatencyMs.toFixed(4)}ms`,
        '10k iterations': `${results[10000].avgLatencyMs.toFixed(4)}ms`,
      });

      // Should be consistent (variance < 20%)
      const min = Math.min(...Object.values(results).map(r => r.avgLatencyMs));
      const max = Math.max(...Object.values(results).map(r => r.avgLatencyMs));
      expect((max - min) / min).toBeLessThan(0.2);
    });
  });

  // ============================================================================
  // 7. THROUGHPUT AND CAPACITY PLANNING
  // ============================================================================
  describe('7. Throughput & Capacity Planning', () => {
    it('should calculate maximum requests per second for auth', () => {
      const token = auth.createToken('test-user', 'org-1', 'access');
      const result = benchmarkSync('Auth RPS Calculation', () => {
        auth.verifyToken(token);
      }, 10000);

      const maxRPS = result.throughputPerSec;
      console.log('\nMaximum Auth Requests/Second:', {
        sustained: `${maxRPS.toFixed(0)} RPS`,
        p99Latency: `${result.p99LatencyMs.toFixed(4)}ms`,
        p95Latency: `${result.p95LatencyMs.toFixed(4)}ms`,
        perSecond: `${(1000 / result.avgLatencyMs).toFixed(0)} ops/sec`,
      });

      expect(maxRPS).toBeGreaterThan(5000);
    });

    it('should calculate maximum rate limit checks per second', () => {
      resetRateLimitStore();
      const store = getRateLimitStore();

      let userIdx = 0;
      const result = benchmarkSync('Rate Limit RPS Calculation', () => {
        userIdx = (userIdx + 1) % 100;
        store.getStatus(`user:user-${userIdx}`);
      }, 50000);

      const maxRPS = result.throughputPerSec;
      console.log('Maximum Rate Limit Checks/Second:', {
        sustained: `${maxRPS.toFixed(0)} RPS`,
        p99Latency: `${result.p99LatencyMs.toFixed(4)}ms`,
      });

      expect(maxRPS).toBeGreaterThan(10000);
    });

    it('should calculate bash escaping throughput for export', () => {
      const commands = Array.from({ length: 100 }, (_, i) => `echo "cmd-${i}"`);

      const result = benchmarkSync('Bash Escape RPS Calculation', () => {
        for (const cmd of commands) {
          escapeForBash(cmd);
        }
      }, 1000);

      // Per command
      const perCmd = result.avgLatencyMs / 100;
      const cmdPerSec = 1000 / perCmd;

      console.log('Bash Escaping Throughput (per 100 commands):', {
        perCommand: `${perCmd.toFixed(4)}ms`,
        commandsPerSecond: `${cmdPerSec.toFixed(0)} cmds/sec`,
        for100Commands: `${result.avgLatencyMs.toFixed(2)}ms`,
      });
    });

    it('should estimate capacity for 1000 concurrent users', () => {
      const users = Array.from({ length: 1000 }, (_, i) => ({
        userId: `user-${i}`,
        orgId: 'org-1',
      }));

      resetRateLimitStore();
      const store = getRateLimitStore();
      let userIdx = 0;

      // Simulate 10 requests per user
      const result = benchmarkSync('1000 Users x 10 Requests', () => {
        const user = users[userIdx % users.length];
        userIdx++;

        const token = auth.createToken(user.userId, user.orgId, 'access');
        auth.verifyToken(token);
        store.increment(`user:${user.userId}`, 60000);
      }, 10000);

      const memoryUsage = process.memoryUsage();
      console.log('Capacity for 1000 Concurrent Users:', {
        avgLatency: `${result.avgLatencyMs.toFixed(4)}ms`,
        p99Latency: `${result.p99LatencyMs.toFixed(4)}ms`,
        throughput: `${result.throughputPerSec.toFixed(0)} RPS`,
        heapMB: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      });
    });
  });

  // ============================================================================
  // 8. BASELINE COMPARISONS
  // ============================================================================
  describe('8. Baseline Comparisons & Optimization', () => {
    it('should provide baseline metrics for documentation', () => {
      const metrics = {
        // JWT
        jwtCreate: benchmarkSync('JWT Create', () => auth.createToken('u', 'o'), 1000),
        jwtVerify: benchmarkSync('JWT Verify', () => {
          const t = auth.createToken('u', 'o');
          auth.verifyToken(t);
        }, 1000),

        // Rate Limiting
        rateLimitCheck: (() => {
          resetRateLimitStore();
          const store = getRateLimitStore();
          return benchmarkSync('Rate Limit Check', () => store.getStatus('user:test'), 1000);
        })(),

        // Bash
        bashSmall: benchmarkSync('Bash Escape (10B)', () => escapeForBash('ls'), 1000),
        bashLarge: benchmarkSync('Bash Escape (100B)', () =>
          escapeForBash('find . -name "*.txt" | grep pattern'), 1000),
      };

      console.log('\n=== BASELINE METRICS FOR DOCUMENTATION ===');
      Object.entries(metrics).forEach(([name, result]) => {
        console.log(`\n${name}:`, formatResult(result));
      });

      // Verify all are within targets
      expect(metrics.jwtVerify.p99LatencyMs).toBeLessThan(2);
      expect(metrics.rateLimitCheck.p99LatencyMs).toBeLessThan(0.5);
      expect(metrics.bashSmall.p99LatencyMs).toBeLessThan(0.1);
    });
  });
});
