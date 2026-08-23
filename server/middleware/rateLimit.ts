import express from 'express';

/**
 * Rate Limit Configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string; // Custom message
  keyGenerator?: (req: express.Request) => string; // Custom key generator
}

/**
 * Rate Limit Store - tracks request counts per key
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
  requestTimes: number[];
}

/**
 * In-Memory Rate Limit Store with cleanup
 */
class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private cleanupIntervalMs: number = 60000) {
    this.startCleanup();
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.store.entries()) {
        if (now > entry.resetTime) {
          this.store.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
      }
    }, this.cleanupIntervalMs);
  }

  /**
   * Get current request count and reset time for a key
   */
  getStatus(key: string, now: number = Date.now()): { count: number; resetTime: number } {
    const entry = this.store.get(key);

    if (!entry) {
      return { count: 0, resetTime: now };
    }

    // Entry has expired, reset it
    if (now > entry.resetTime) {
      this.store.delete(key);
      return { count: 0, resetTime: now };
    }

    return { count: entry.count, resetTime: entry.resetTime };
  }

  /**
   * Increment request count for a key
   */
  increment(
    key: string,
    windowMs: number,
    now: number = Date.now()
  ): { count: number; resetTime: number; requestTimes: number[] } {
    let entry = this.store.get(key);

    // Create new entry or reset if expired
    if (!entry || now > entry.resetTime) {
      const resetTime = now + windowMs;
      entry = {
        count: 1,
        resetTime,
        requestTimes: [now],
      };
      this.store.set(key, entry);
      return { count: 1, resetTime, requestTimes: [now] };
    }

    // Increment existing entry and prune expired timestamps
    entry.count++;
    entry.requestTimes.push(now);
    // Prune timestamps older than the window to prevent unbounded growth
    const cutoff = now - windowMs;
    entry.requestTimes = entry.requestTimes.filter(t => t > cutoff);
    entry.count = entry.requestTimes.length;

    return {
      count: entry.count,
      resetTime: entry.resetTime,
      requestTimes: entry.requestTimes,
    };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get store size (for monitoring)
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Create a rate limit middleware with custom configuration
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    keyGenerator = defaultKeyGenerator,
  } = config;

  // Each middleware gets its own store so limits are fully isolated
  const store = new RateLimitStore();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    const { count, resetTime } = store.increment(key, windowMs, now);

    // Set rate limit headers
    const secondsRemaining = Math.ceil((resetTime - now) / 1000);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - count));
    res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString());

    // Check if rate limit exceeded
    if (count > maxRequests) {
      console.warn(
        `[rateLimit] Rate limit exceeded for key: ${key} (${count}/${maxRequests} requests)`
      );

      res.setHeader('Retry-After', secondsRemaining);
      res.status(429).json({
        error: message,
        retryAfter: secondsRemaining,
        resetTime: new Date(resetTime).toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Default key generator - uses authenticated user ID or IP address.
 * Reads from req.user (set by auth middleware) to prevent bypass via
 * spoofed x-user-id headers.
 */
export function defaultKeyGenerator(req: express.Request): string {
  const userId = (req as any).user?.id;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  return userId ? `user:${userId}` : `ip:${ip}`;
}

export const exportRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Export rate limit exceeded. Maximum 10 exports per minute.',
});

export const playbackRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Playback rate limit exceeded. Maximum 30 requests per minute.',
});

export const syncRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Sync rate limit exceeded. Maximum 20 syncs per minute.',
});

/**
 * Middleware for authentication endpoints (5 requests per 15 minutes)
 */
export const authRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
});

/**
 * Middleware for billing endpoints (60 requests per minute)
 * Shared by the read-heavy GET /subscription endpoint (polled by every
 * PaywallGate-wrapped view and the trial banner) as well as the rarer
 * write endpoints (checkout/portal session creation), so it needs to be
 * generous enough for several tabs/views to poll concurrently.
 */
export const billingRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Billing rate limit exceeded. Maximum 60 requests per minute.',
});

/**
 * Middleware for general API read endpoints (60 requests per minute)
 */
export const apiReadRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Rate limit exceeded. Maximum 60 requests per minute.',
});

/**
 * Middleware for API write/mutation endpoints (30 requests per minute)
 */
export const apiWriteRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Rate limit exceeded. Maximum 30 requests per minute.',
});

/**
 * Middleware for SSH connection endpoints (10 requests per minute)
 */
export const connectionRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Connection rate limit exceeded. Maximum 10 connections per minute.',
});

/**
 * Middleware for SFTP endpoints (30 requests per minute)
 */
export const sftpRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'SFTP rate limit exceeded. Maximum 30 requests per minute.',
});

/**
 * Middleware for P2P endpoints (120 requests per minute)
 * Higher than most endpoints since device heartbeats and WebRTC signaling
 * polling both run frequently and can come from several devices/tabs at once.
 */
export const p2pRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 120,
  message: 'P2P rate limit exceeded. Maximum 120 requests per minute.',
});

/**
 * Middleware for notification endpoints (30 requests per minute)
 */
export const notificationRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Notification rate limit exceeded. Maximum 30 requests per minute.',
});

/**
 * Middleware for analytics endpoints (30 requests per minute)
 */
export const analyticsRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: 'Analytics rate limit exceeded. Maximum 30 requests per minute.',
});

/**
 * Middleware for team/organization endpoints (20 requests per minute)
 */
export const teamRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Team rate limit exceeded. Maximum 20 requests per minute.',
});

// Kept for backwards-compatibility with tests and graceful-shutdown callers.
// Each middleware now owns its own store, so these are no-ops.
export function getRateLimitStore(): RateLimitStore { return new RateLimitStore(); }
export function resetRateLimitStore(): void {}
export function destroyRateLimitStore(): void {}

export { RateLimitStore };
