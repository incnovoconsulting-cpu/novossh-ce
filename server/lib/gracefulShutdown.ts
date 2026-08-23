/**
 * Graceful Shutdown Handler
 * Manages orderly shutdown of the application with request draining
 */

import http from 'node:http';
import { closeDatabase, forceCloseDatabase } from './database.js';
import { getConfig } from './config.js';

/**
 * Graceful shutdown state tracking
 */
export interface ShutdownState {
  isShuttingDown: boolean;
  inFlightRequests: number;
  maxInFlightRequests: number;
  startTime: number;
  gracePeriodMs: number;
  forceTimeoutMs: number;
}

/**
 * Active shutdown state
 */
let shutdownState: ShutdownState | null = null;

/**
 * Set to track in-flight requests
 */
const inFlightRequests = new Set<http.ServerResponse>();

/**
 * Initialize graceful shutdown handling
 * Should be called before starting the server
 */
export function initializeGracefulShutdown(server: http.Server): void {
  const config = getConfig();


  shutdownState = {
    isShuttingDown: false,
    inFlightRequests: 0,
    maxInFlightRequests: config.gracefulShutdown.maxInFlightRequests,
    startTime: 0,
    gracePeriodMs: config.gracefulShutdown.gracePeriodMs,
    forceTimeoutMs: config.gracefulShutdown.forceTimeoutMs,
  };

  server.on('connection', (socket) => {
    if (shutdownState?.isShuttingDown) {
      socket.destroy();
    }
  });

  process.on('SIGTERM', () => {
    gracefulShutdown(server);
  });

  process.on('SIGINT', () => {
    gracefulShutdown(server);
  });

  process.on('uncaughtException', (error) => {
    console.error('[shutdown] Uncaught exception:', error);
    gracefulShutdown(server, true);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[shutdown] Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown(server, true);
  });
}

/**
 * Track request start
 * Should be called at the beginning of request processing
 */
export function trackRequestStart(res: http.ServerResponse): void {
  if (!shutdownState) {
    return;
  }

  inFlightRequests.add(res);
  shutdownState.inFlightRequests = inFlightRequests.size;
}

/**
 * Track request end
 * Should be called when request completes
 */
export function trackRequestEnd(res: http.ServerResponse): void {
  if (!shutdownState) {
    return;
  }

  inFlightRequests.delete(res);
  shutdownState.inFlightRequests = inFlightRequests.size;
}

/**
 * Get current shutdown state
 */
export function getShutdownState(): ShutdownState | null {
  return shutdownState;
}

/**
 * Check if server is shutting down
 */
export function isShuttingDown(): boolean {
  return shutdownState?.isShuttingDown || false;
}

/**
 * Request rejection middleware
 * Prevents new requests when shutting down
 */
export function createShutdownMiddleware() {
  return (_req: any, res: any, next: any) => {
    if (!shutdownState?.isShuttingDown) {
      trackRequestStart(res);

      res.on('finish', () => {
        trackRequestEnd(res);
      });

      res.on('error', () => {
        trackRequestEnd(res);
      });

      return next();
    }

    res.status(503).json({
      error: 'Service is shutting down',
      message: 'Please retry your request in a moment',
    });
  };
}

/**
 * Perform graceful shutdown
 * Waits for in-flight requests to complete before exiting
 */
export async function gracefulShutdown(server: http.Server, isError = false): Promise<void> {
  if (!shutdownState) {
    console.error('[shutdown] Graceful shutdown not initialized');
    process.exit(isError ? 1 : 0);
    return;
  }

  if (shutdownState.isShuttingDown) {
    return;
  }

  shutdownState.isShuttingDown = true;
  shutdownState.startTime = Date.now();


  server.close(async () => {

    await waitForInFlightRequests();

    try {
      await closeDatabase(5000);
    } catch (error) {
      console.error('[shutdown] Error closing database:', error);
      forceCloseDatabase();
    }

    process.exit(isError ? 1 : 0);
  });

  setTimeout(() => {
    if (inFlightRequests.size > 0) {
      console.warn(
        `[shutdown] Grace period exceeded with ${inFlightRequests.size} in-flight requests, ` +
          'forcing shutdown'
      );

      inFlightRequests.forEach((res) => {
        try {
          res.end();
        } catch (error) {
          console.error('[shutdown] Error closing response:', error);
        }
      });

      inFlightRequests.clear();
    }

    forceCloseDatabase();

    process.exit(isError ? 1 : 0);
  }, shutdownState.forceTimeoutMs);
}

/**
 * Wait for all in-flight requests to complete
 */
async function waitForInFlightRequests(): Promise<void> {
  const config = getConfig();
  const maxWaitTime = config.gracefulShutdown.gracePeriodMs;
  const checkInterval = 100;

  const startTime = Date.now();

  while (inFlightRequests.size > 0) {
    const elapsedTime = Date.now() - startTime;

    if (elapsedTime > maxWaitTime) {
      console.warn(
        `[shutdown] Grace period (${maxWaitTime}ms) exceeded, ` +
          `${inFlightRequests.size} requests still in-flight`
      );
      break;
    }


    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

}

/**
 * Get shutdown metrics for monitoring
 */
export function getShutdownMetrics() {
  if (!shutdownState) {
    return null;
  }

  const elapsedMs = Date.now() - shutdownState.startTime;

  return {
    isShuttingDown: shutdownState.isShuttingDown,
    inFlightRequests: shutdownState.inFlightRequests,
    elapsedMs,
    gracePeriodRemainingMs: Math.max(0, shutdownState.gracePeriodMs - elapsedMs),
    forceTimeoutRemainingMs: Math.max(0, shutdownState.forceTimeoutMs - elapsedMs),
  };
}

/**
 * Create a health check endpoint for monitoring shutdown status
 */
export function createShutdownStatusEndpoint() {
  return (_req: any, res: any) => {
    if (isShuttingDown()) {
      return res.status(503).json({
        shutting_down: true,
        metrics: getShutdownMetrics(),
      });
    }

    res.status(200).json({
      shutting_down: false,
    });
  };
}
