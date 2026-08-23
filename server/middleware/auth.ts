import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../auth.js';

/**
 * Extend Express Request to include authenticated user info
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        organizationId: string;
      };
      token?: JWTPayload;
    }
  }
}

/**
 * Extract token from Authorization header (Bearer scheme) or cookies
 */
function extractToken(req: Request): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Fall back to cookie (for browser sessions)
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  return null;
}

/**
 * Verify JWT token and extract user information
 * This is the main auth middleware
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Missing authentication token' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Attach user info to request
  req.user = {
    id: payload.userId,
    organizationId: payload.organizationId,
  };
  req.token = payload;

  next();
}

/**
 * Optional auth middleware - doesn't fail if token is missing
 * Useful for endpoints that work with or without auth
 */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = {
        id: payload.userId,
        organizationId: payload.organizationId,
      };
      req.token = payload;
    }
  }

  next();
}

/**
 * Verify token type (access vs refresh)
 */
export function requireTokenType(type: 'access' | 'refresh') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.token || req.token.type !== type) {
      res.status(401).json({ error: `Invalid token type, expected ${type}` });
      return;
    }
    next();
  };
}

/**
 * Extract user from request (requires valid JWT)
 * Throws if no valid authentication is found
 */
export function getUser(req: Request): { id: string; organizationId: string } {
  // If JWT auth middleware already ran, use that
  if (req.user) {
    return {
      id: req.user.id,
      organizationId: req.user.organizationId,
    };
  }

  // Try to decode JWT directly from request
  const token = extractToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      return {
        id: payload.userId,
        organizationId: payload.organizationId,
      };
    }
  }

  // No valid authentication found — fail closed instead of spoofing identity
  throw new Error('Authentication required');
}

export const authenticateToken = authMiddleware;
