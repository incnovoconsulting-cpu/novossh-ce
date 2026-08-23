import express from 'express';
import { MonitoringService } from '../services/MonitoringService.js';

/**
 * Global monitoring service instance
 */
let monitoringService: MonitoringService | null = null;

/**
 * Initialize monitoring service
 */
export function initMonitoring(): MonitoringService {
  if (!monitoringService) {
    monitoringService = new MonitoringService();
  }
  return monitoringService;
}

/**
 * Get monitoring service instance
 */
export function getMonitoringService(): MonitoringService {
  if (!monitoringService) {
    monitoringService = new MonitoringService();
  }
  return monitoringService;
}

/**
 * Monitoring middleware - tracks request metrics and records violations
 */
export function createMonitoringMiddleware() {
  const monitoring = getMonitoringService();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const startTime = Date.now();

    // Store monitoring info on request
    (req as any).monitoringStartTime = startTime;

    // Intercept response
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (body: unknown) {
      recordMetrics(req, res, startTime, monitoring);
      return originalJson(body);
    };

    res.send = function (body?: unknown) {
      recordMetrics(req, res, startTime, monitoring);
      return originalSend(body);
    };

    // Handle errors that might not call json/send
    res.on('finish', () => {
      if (!(req as any).metricsRecorded) {
        recordMetrics(req, res, startTime, monitoring);
      }
    });

    next();
  };
}

/**
 * Record response metrics
 */
function recordMetrics(
  req: express.Request,
  res: express.Response,
  startTime: number,
  monitoring: MonitoringService
): void {
  if ((req as any).metricsRecorded) {
    return;
  }

  (req as any).metricsRecorded = true;

  const responseTime = Date.now() - startTime;
  const endpoint = `${req.method} ${req.path}`;
  const organizationId = (req as any).user?.organizationId;

  // Record performance metric (in-memory)
  monitoring.recordPerformanceMetric(endpoint, req.method, responseTime, res.statusCode);

  // Record API usage stats (database)
  monitoring
    .recordApiUsageStats(endpoint, req.method, responseTime, res.statusCode, organizationId)
    .catch((error) => {
      console.error('[monitoring] Failed to record API usage stats:', error);
    });

  // Alert on slow responses
  if (responseTime > 5000) {
    console.warn(
      `[monitoring] Slow response: ${endpoint} took ${responseTime}ms (status: ${res.statusCode})`
    );
  }

  // Alert on errors
  if (res.statusCode >= 500) {
    console.error(
      `[monitoring] Server error: ${endpoint} returned ${res.statusCode} (${responseTime}ms)`
    );
  }
}

/**
 * Auth failure monitoring middleware
 */
export function createAuthFailureMonitoring() {
  const monitoring = getMonitoringService();

  return {
    /**
     * Record a failed authentication attempt
     */
    recordFailure: async (
      failureType: 'invalid_credentials' | 'invalid_token' | 'expired_token' | 'missing_token',
      endpoint: string,
      req: express.Request
    ) => {
      const userId = (req as any).user?.id;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const organizationId = (req as any).user?.organizationId;

      try {
        const failure = await monitoring.recordAuthFailure(
          failureType,
          endpoint,
          userId,
          ipAddress,
          organizationId
        );

        // Alert if severity escalates
        if (failure.severity === 'critical') {
          console.error(
            `[monitoring] CRITICAL: Brute force attempt detected - ${failure.failure_count} failures from ${ipAddress}`
          );
        }
      } catch (error) {
        console.error('[monitoring] Failed to record auth failure:', error);
      }
    },
  };
}

/**
 * Rate limit violation monitoring middleware
 */
export function createRateLimitMonitoring() {
  const monitoring = getMonitoringService();

  return {
    /**
     * Record a rate limit violation
     */
    recordViolation: async (
      endpoint: string,
      req: express.Request
    ) => {
      const userId = (req as any).user?.id;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const organizationId = (req as any).user?.organizationId;

      try {
        const violation = await monitoring.recordRateLimitViolation(
          endpoint,
          userId,
          ipAddress,
          organizationId
        );

        // Alert on high severity violations
        if (['high', 'critical'].includes(violation.severity)) {
          console.warn(
            `[monitoring] ${violation.severity.toUpperCase()}: Rate limit violation - ${violation.violation_count} violations on ${endpoint}`
          );
        }
      } catch (error) {
        console.error('[monitoring] Failed to record rate limit violation:', error);
      }
    },
  };
}

/**
 * Clean up monitoring resources
 */
export function destroyMonitoring(): void {
  if (monitoringService) {
    monitoringService.destroy();
    monitoringService = null;
  }
}
