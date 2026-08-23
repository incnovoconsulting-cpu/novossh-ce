import express from 'express';
import { AuditService } from '../services/AuditService.js';

/**
 * Audit context for tracking request metadata and changes
 */
export interface AuditContext {
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  startTime?: number;
}

/**
 * Audit event details with before/after state
 */
export interface AuditEventDetails {
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  changes?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
}

/**
 * Sensitive operation tracking
 */
export const SENSITIVE_OPERATIONS = {
  // Session operations
  'session:export': { category: 'session_export', requiresLog: true },
  'session:playback:access': { category: 'session_playback_access', requiresLog: true },
  'session:create': { category: 'session_management', requiresLog: true },
  'session:delete': { category: 'session_management', requiresLog: true },
  'session:record:command': { category: 'session_recording', requiresLog: true },

  // Permission/Role operations
  'team:member:add': { category: 'permission_change', requiresLog: true },
  'team:member:remove': { category: 'permission_change', requiresLog: true },
  'team:member:role:update': { category: 'permission_change', requiresLog: true },
  'vault:share': { category: 'permission_change', requiresLog: true },
  'vault:unshare': { category: 'permission_change', requiresLog: true },
  'vault:permission:update': { category: 'permission_change', requiresLog: true },

  // Vault/Entry operations
  'vault:create': { category: 'vault_access', requiresLog: true },
  'vault:delete': { category: 'vault_access', requiresLog: true },
  'vault:entry:read': { category: 'vault_access', requiresLog: true },
  'vault:entry:create': { category: 'vault_access', requiresLog: true },
  'vault:entry:delete': { category: 'vault_access', requiresLog: true },
  'vault:encryption:key:access': { category: 'encryption_key_operation', requiresLog: true },

  // Authentication events
  'auth:login': { category: 'authentication', requiresLog: true },
  'auth:logout': { category: 'authentication', requiresLog: true },
  'auth:token:refresh': { category: 'authentication', requiresLog: true },
  'auth:failed_attempt': { category: 'authentication', requiresLog: true },

  // Team operations
  'team:create': { category: 'team_management', requiresLog: true },
  'team:delete': { category: 'team_management', requiresLog: true },
  'team:update': { category: 'team_management', requiresLog: true },
};

class AuditLogger {
  private auditService: AuditService;

  constructor(auditService: AuditService) {
    this.auditService = auditService;
  }

  /**
   * Extract audit context from Express request
   */
  extractContext(req: express.Request): AuditContext {
    const user = (req as any).user;
    return {
      userId: user?.id || 'system',
      organizationId: user?.organizationId || 'org-default',
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'] as string,
      requestId: (req.headers['x-request-id'] as string) || this.generateRequestId(),
      startTime: Date.now(),
    };
  }

  /**
   * Extract client IP from request (accounting for proxies)
   */
  private getClientIp(req: express.Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0]).trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log sensitive operation
   */
  async log(
    context: AuditContext,
    teamId: string | undefined,
    action: string,
    resourceType: string,
    resourceId: string | undefined,
    details: AuditEventDetails
  ): Promise<void> {
    try {
      const enrichedDetails = {
        ...details,
        requestId: context.requestId,
        duration: context.startTime ? Date.now() - context.startTime : undefined,
      };

      await this.auditService.logEvent(
        context.organizationId,
        teamId,
        context.userId,
        action,
        resourceType,
        resourceId,
        enrichedDetails,
        context.ipAddress,
        context.userAgent
      );
    } catch (error) {
      // Log errors but don't fail the request
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Middleware factory for automatic audit logging of sensitive endpoints
   */
  middleware(
    action: string,
    resourceType: string,
    getResourceId?: (req: express.Request) => string | undefined,
    getTeamId?: (req: express.Request) => string | undefined
  ) {
    return async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      const context = this.extractContext(req);
      const resourceId = getResourceId?.(req);
      const teamId = getTeamId?.(req);

      // Store context on request for logging in route handler
      (req as any).auditContext = context;
      (req as any).auditLogger = this;

      // Intercept response
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      let responseBody: unknown;

      res.json = function (body: unknown) {
        responseBody = body;
        return originalJson(body);
      };

      res.send = function (body?: unknown) {
        responseBody = body;
        return originalSend(body);
      };

      // Hook response to capture success/failure
      res.on('finish', async () => {
        const success = res.statusCode < 400;

        await this.log(
          context,
          teamId,
          action,
          resourceType,
          resourceId,
          {
            success,
            statusCode: res.statusCode,
            errorMessage: success ? undefined : (responseBody as any)?.error,
            metadata: {
              method: req.method,
              path: req.path,
              query: req.query,
            },
          }
        );
      });

      next();
    };
  }

  /**
   * Manually log from within a route handler
   */
  static getLogger(req: express.Request): AuditLogger | undefined {
    return (req as any).auditLogger;
  }

  static getContext(req: express.Request): AuditContext | undefined {
    return (req as any).auditContext;
  }
}

export { AuditLogger };

/**
 * Factory to create audit logger instance
 */
export function createAuditLogger(auditService: AuditService): AuditLogger {
  return new AuditLogger(auditService);
}
