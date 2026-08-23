import express from 'express';
import { AuditService } from '../services/AuditService.js';

/**
 * Audit tracking helper for route handlers
 * Provides utilities to log sensitive operations from within route handlers
 */
export class AuditTracker {
  constructor(private auditService: AuditService) {}

  /**
   * Extract user info from request
   */
  getUser(req: express.Request) {
    if (req.user) {
      return { id: req.user.id, organizationId: req.user.organizationId };
    }
    // Fail closed — no spoofable header fallback
    throw new Error('Authentication required');
  }

  /**
   * Get client IP from request
   */
  getClientIp(req: express.Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0]).trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Log session export operation
   */
  async logSessionExport(
    req: express.Request,
    sessionId: string,
    teamId: string,
    format: 'bash' | 'json',
    commandCount: number,
    _success: boolean = true
  ) {
    const user = this.getUser(req);
    try {
      await this.auditService.logSessionExport(
        user.organizationId,
        teamId,
        user.id,
        sessionId,
        format,
        commandCount,
        this.getClientIp(req),
        req.headers['user-agent'] as string
      );
    } catch (error) {
      console.error('Failed to log session export:', error);
    }
  }

  /**
   * Log session playback access
   */
  async logPlaybackAccess(
    req: express.Request,
    sessionId: string,
    teamId: string,
    commandsViewed?: number
  ) {
    const user = this.getUser(req);
    try {
      await this.auditService.logPlaybackAccess(
        user.organizationId,
        teamId,
        user.id,
        sessionId,
        commandsViewed,
        this.getClientIp(req),
        req.headers['user-agent'] as string
      );
    } catch (error) {
      console.error('Failed to log playback access:', error);
    }
  }

  /**
   * Log permission change
   */
  async logPermissionChange(
    req: express.Request,
    teamId: string,
    targetUserId: string,
    changeType:
      | 'role_updated'
      | 'member_added'
      | 'member_removed'
      | 'permission_granted'
      | 'permission_revoked',
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>,
    details?: Record<string, unknown>
  ) {
    const user = this.getUser(req);
    try {
      await this.auditService.logPermissionChange(
        user.organizationId,
        teamId,
        user.id,
        targetUserId,
        changeType,
        beforeState,
        afterState,
        this.getClientIp(req),
        req.headers['user-agent'] as string,
        details
      );
    } catch (error) {
      console.error('Failed to log permission change:', error);
    }
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(
    req: express.Request,
    userId: string,
    organizationId: string,
    eventType: 'login' | 'logout' | 'token_refresh' | 'failed_login',
    success: boolean,
    details?: Record<string, unknown>
  ) {
    try {
      await this.auditService.logAuthenticationEvent(
        organizationId,
        userId,
        eventType,
        success,
        this.getClientIp(req),
        req.headers['user-agent'] as string,
        details
      );
    } catch (error) {
      console.error('Failed to log auth event:', error);
    }
  }

  /**
   * Log sensitive data access
   */
  async logDataAccess(
    req: express.Request,
    teamId: string,
    resourceType: 'vault' | 'entry' | 'encryption_key',
    resourceId: string,
    accessType: 'read' | 'export' | 'decrypt',
    details?: Record<string, unknown>
  ) {
    const user = this.getUser(req);
    try {
      await this.auditService.logSensitiveDataAccess(
        user.organizationId,
        teamId,
        user.id,
        resourceType,
        resourceId,
        accessType,
        this.getClientIp(req),
        req.headers['user-agent'] as string,
        details
      );
    } catch (error) {
      console.error('Failed to log data access:', error);
    }
  }

  /**
   * Log generic audit event
   */
  async logEvent(
    req: express.Request,
    teamId: string | undefined,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: Record<string, unknown>
  ) {
    const user = this.getUser(req);
    try {
      await this.auditService.logEvent(
        user.organizationId,
        teamId,
        user.id,
        action,
        resourceType,
        resourceId,
        details,
        this.getClientIp(req),
        req.headers['user-agent'] as string
      );
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

/**
 * Create audit tracker instance
 */
export function createAuditTracker(auditService: AuditService): AuditTracker {
  return new AuditTracker(auditService);
}
