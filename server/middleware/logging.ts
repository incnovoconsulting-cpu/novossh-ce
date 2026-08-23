/**
 * Structured Logging Middleware
 * Provides JSON-formatted request/response logging with correlation IDs
 */

import express from 'express';
import { randomUUID } from 'crypto';
import { getConfig } from '../lib/config.js';

export interface RequestLog {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  status: number;
  responseTime: number;
  userAgent?: string;
  userId?: string;
  organizationId?: string;
  ipAddress?: string;
  error?: string;
  errorStack?: string;
  query?: Record<string, unknown>;
  bodySize?: number;
  responseSize?: number;
}

/**
 * Request context stored on Express request object
 */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userId?: string;
      organizationId?: string;
      startTime?: number;
    }
  }
}

/**
 * Generate or extract request ID for tracing
 */
function getOrCreateRequestId(req: express.Request): string {
  const config = getConfig();
  const headerName = config.requestIdHeader.toLowerCase();

  // Check for existing request ID in headers
  const existingId = req.get(headerName);
  if (existingId && typeof existingId === 'string' && existingId.length > 0) {
    return existingId;
  }

  // Generate new request ID
  return randomUUID();
}

/**
 * Extract user and organization info from request
 */
function extractUserInfo(req: express.Request): { userId?: string; organizationId?: string } {
  return {
    userId: req.get('X-User-ID') || undefined,
    organizationId: req.get('X-Organization-ID') || undefined,
  };
}

/**
 * Get client IP address with proxy awareness
 */
function getClientIp(req: express.Request): string {
  const forwarded = req.get('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create structured logging middleware
 * Logs all requests in JSON format with correlation IDs
 */
export function createLoggingMiddleware() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Extract/generate request ID
    const requestId = getOrCreateRequestId(req);
    req.requestId = requestId;

    // Extract user context
    const userContext = extractUserInfo(req);
    req.userId = userContext.userId;
    req.organizationId = userContext.organizationId;

    // Record start time
    const startTime = Date.now();
    req.startTime = startTime;

    // Get client IP
    const ipAddress = getClientIp(req);

    // Capture response
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function (body: unknown) {
      logRequest(req, res, startTime, ipAddress, requestId, userContext, undefined);
      return originalJson(body);
    };

    res.send = function (body?: unknown) {
      logRequest(req, res, startTime, ipAddress, requestId, userContext, undefined);
      return originalSend(body);
    };

    // Handle errors
    res.on('finish', () => {
      if (!res.headersSent || res.statusCode >= 500) {
        logRequest(req, res, startTime, ipAddress, requestId, userContext, undefined);
      }
    });

    next();
  };
}

/**
 * Log request details
 */
function logRequest(
  req: express.Request,
  res: express.Response,
  startTime: number,
  ipAddress: string,
  requestId: string,
  userContext: { userId?: string; organizationId?: string },
  error?: Error
): void {
  const config = getConfig();

  if (!config.logging.requestLogging) {
    return;
  }

  const responseTime = Date.now() - startTime;

  const log: RequestLog = {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    path: req.path,
    status: res.statusCode,
    responseTime,
    userAgent: req.get('User-Agent'),
    userId: userContext.userId,
    organizationId: userContext.organizationId,
    ipAddress,
  };

  // Add error information if present
  if (error) {
    log.error = error.message;
    log.errorStack = config.server.nodeEnv === 'development' ? error.stack : undefined;
  }

  // Log based on configuration format
  if (config.logging.format === 'json') {
  } else {
  }

  // Alert on slow requests
  if (responseTime > 5000) {
    console.warn(
      `[slow-request] ${requestId} ${req.method} ${req.path} took ${responseTime}ms`
    );
  }

  // Alert on server errors
  if (res.statusCode >= 500) {
    console.error(`[server-error] ${requestId} ${req.method} ${req.path} returned ${res.statusCode}`);
  }
}

/**
 * Create error logging middleware
 * Catches and logs errors with structured format
 */
export function createErrorLoggingMiddleware() {
  const config = getConfig();

  return (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const requestId = req.requestId || randomUUID();
    const timestamp = new Date().toISOString();

    const errorLog = {
      timestamp,
      requestId,
      type: 'error',
      method: req.method,
      path: req.path,
      status: res.statusCode || 500,
      error: error.message,
      errorStack: config.server.nodeEnv === 'development' ? error.stack : undefined,
      userId: req.userId,
      organizationId: req.organizationId,
      ipAddress: getClientIp(req),
    };

    if (config.logging.format === 'json') {
      console.error(JSON.stringify(errorLog));
    } else {
      console.error(`[error] ${requestId} ${error.message}`);
      if (config.server.nodeEnv === 'development') {
        console.error(error.stack);
      }
    }

    // Pass to next error handler
    next(error);
  };
}

/**
 * Request ID middleware
 * Ensures all requests have a correlation ID
 */
export function createRequestIdMiddleware() {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const config = getConfig();
    const requestId = getOrCreateRequestId(req);

    req.requestId = requestId;

    // Add request ID to response headers
    res.setHeader(config.requestIdHeader, requestId);

    next();
  };
}
