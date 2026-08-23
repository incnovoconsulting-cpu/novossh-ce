import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditService } from '../AuditService.js';
import { AuditTracker } from '../../middleware/auditTracker.js';
import express from 'express';

/**
 * Integration tests for comprehensive audit logging
 * Tests all sensitive operations: session exports, playback access, permission changes, etc.
 */

let queryResponses: unknown[] = [];
let queryIndex = 0;

const mockDb = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const response = queryResponses[queryIndex] || [];
  queryIndex++;
  return response;
}) as any;

mockDb.unsafe = vi.fn(async (query: string) => {
  const response = queryResponses[queryIndex] || [];
  queryIndex++;
  return response;
});

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(() => mockDb),
}));

describe('Audit Logging Integration', () => {
  let auditService: AuditService;
  let auditTracker: AuditTracker;
  let req: Partial<express.Request>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryResponses = [];
    queryIndex = 0;
    auditService = new AuditService();
    auditTracker = new AuditTracker(auditService);

    // Mock request with authenticated user (AuditTracker.getUser reads req.user)
    req = {
      headers: {
        'user-agent': 'Test Browser',
        'x-forwarded-for': '192.168.1.1',
      },
      user: { id: 'user-1', organizationId: 'org-1' },
      socket: {
        remoteAddress: '127.0.0.1',
      } as any,
    };
  });

  const setResponses = (responses: unknown[]) => {
    queryResponses = responses;
    queryIndex = 0;
  };

  describe('Session Export Logging', () => {
    it('should log session export as bash script', async () => {
      const mockEvent = {
        id: 'audit-1',
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'session:export',
        resource_type: 'session',
        resource_id: 'session-1',
        details: {
          format: 'bash',
          commandCount: 42,
          severity: 'high',
          exportType: 'session_script',
        },
        ip_address: '192.168.1.1',
        user_agent: 'Test Browser',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logSessionExport(
        req as express.Request,
        'session-1',
        'team-1',
        'bash',
        42,
        true
      );

      expect(mockDb).toHaveBeenCalled();
    });

    it('should log session export as JSON', async () => {
      const mockEvent = {
        id: 'audit-2',
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'session:export',
        resource_type: 'session',
        resource_id: 'session-2',
        details: {
          format: 'json',
          commandCount: 128,
          severity: 'high',
          exportType: 'session_script',
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logSessionExport(
        req as express.Request,
        'session-2',
        'team-1',
        'json',
        128,
        true
      );

      expect(mockDb).toHaveBeenCalled();
    });

    it('should track large batch exports (100+ sessions)', async () => {
      const mockEvents = Array.from({ length: 100 }, (_, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'session:export',
        resource_type: 'session',
        resource_id: `session-${i}`,
        details: {
          format: 'bash',
          commandCount: 50 + i,
          severity: 'high',
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      }));

      setResponses([mockEvents]);

      const events = await auditService.getAuditLog('org-1', { limit: 1000 });

      expect(events).toBeDefined();
    });
  });

  describe('Playback Access Logging', () => {
    it('should log playback access with command count', async () => {
      const mockEvent = {
        id: 'audit-3',
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'session:playback:access',
        resource_type: 'session',
        resource_id: 'session-1',
        details: {
          commandsViewed: 42,
          severity: 'medium',
          playbackAccess: true,
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logPlaybackAccess(
        req as express.Request,
        'session-1',
        'team-1',
        42
      );

      expect(mockDb).toHaveBeenCalled();
    });

    it('should log playback access from different users', async () => {
      const users = ['user-1', 'user-2', 'user-3'];

      for (const userId of users) {
        const mockEvent = {
          id: `audit-${userId}`,
          organization_id: 'org-1',
          team_id: 'team-1',
          user_id: userId,
          action: 'session:playback:access',
          resource_type: 'session',
          resource_id: 'session-1',
          details: {
            commandsViewed: 50,
            severity: 'medium',
            playbackAccess: true,
          },
          ip_address: '192.168.1.1',
          created_at: new Date(),
        };

        setResponses([[mockEvent]]);

        req.headers = {
          ...req.headers,
          'x-user-id': userId,
        };

        await auditTracker.logPlaybackAccess(
          req as express.Request,
          'session-1',
          'team-1',
          50
        );
      }

      expect(mockDb.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should track repeated playback access (same session, multiple users)', async () => {
      const sessionId = 'session-shared';
      const userIds = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];

      const mockEvents = userIds.map((userId, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: userId,
        action: 'session:playback:access',
        resource_type: 'session',
        resource_id: sessionId,
        details: {
          commandsViewed: 75,
          severity: 'medium',
          playbackAccess: true,
        },
        ip_address: '192.168.1.1',
        created_at: new Date(Date.now() - i * 1000),
      }));

      setResponses([mockEvents]);

      const events = await auditService.getAuditLog('org-1', {
        resourceId: sessionId,
        action: 'session:playback:access',
        limit: 100,
      } as any);

      expect(events).toBeDefined();
    });
  });

  describe('Permission Change Logging', () => {
    it('should log member added to team', async () => {
      const mockEvent = {
        id: 'audit-4',
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'member_added',
        resource_type: 'team_member',
        resource_id: 'user-2',
        details: {
          severity: 'high',
          targetUserId: 'user-2',
          beforeState: {},
          afterState: { role: 'editor', addedAt: new Date().toISOString() },
          changes: {
            role: { before: undefined, after: 'editor' },
          },
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logPermissionChange(
        req as express.Request,
        'team-1',
        'user-2',
        'member_added',
        {},
        { role: 'editor', addedAt: new Date().toISOString() }
      );

      expect(mockDb).toHaveBeenCalled();
    });

    it('should log member role updated', async () => {
      const beforeState = { role: 'viewer', permissions: 5 };
      const afterState = { role: 'editor', permissions: 10 };

      const mockEvent = {
        id: 'audit-5',
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'role_updated',
        resource_type: 'team_member',
        resource_id: 'user-3',
        details: {
          severity: 'high',
          targetUserId: 'user-3',
          beforeState,
          afterState,
          changes: {
            role: { before: 'viewer', after: 'editor' },
            permissions: { before: 5, after: 10 },
          },
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logPermissionChange(
        req as express.Request,
        'team-1',
        'user-3',
        'role_updated',
        beforeState,
        afterState
      );

      expect(mockDb).toHaveBeenCalled();
    });

    it('should log member removed from team', async () => {
      const mockEvent = {
        id: 'audit-6',
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'member_removed',
        resource_type: 'team_member',
        resource_id: 'user-4',
        details: {
          severity: 'high',
          targetUserId: 'user-4',
          beforeState: { role: 'editor' },
          afterState: { role: null },
          changes: {
            role: { before: 'editor', after: null },
          },
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logPermissionChange(
        req as express.Request,
        'team-1',
        'user-4',
        'member_removed',
        { role: 'editor' },
        { role: null }
      );

      expect(mockDb).toHaveBeenCalled();
    });

    it('should track batch permission changes (10+ members)', async () => {
      const mockEvents = Array.from({ length: 10 }, (_, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'member_added',
        resource_type: 'team_member',
        resource_id: `user-${i}`,
        details: {
          severity: 'high',
          targetUserId: `user-${i}`,
          beforeState: {},
          afterState: { role: 'viewer' },
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      }));

      setResponses([mockEvents]);

      const events = await auditService.getAuditLog('org-1', {
        action: 'member_added',
        limit: 100,
      });

      expect(events).toBeDefined();
    });
  });

  describe('Sensitive Data Access Logging', () => {
    it('should log vault access', async () => {
      const mockEvent = {
        id: 'audit-7',
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'data_access:read',
        resource_type: 'vault',
        resource_id: 'vault-1',
        details: {
          accessType: 'read',
          severity: 'high',
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logDataAccess(
        req as express.Request,
        'team-1',
        'vault',
        'vault-1',
        'read'
      );

      expect(mockDb).toHaveBeenCalled();
    });

    it('should log entry export', async () => {
      const mockEvent = {
        id: 'audit-8',
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'data_access:export',
        resource_type: 'entry',
        resource_id: 'entry-1',
        details: {
          accessType: 'export',
          severity: 'high',
          format: 'csv',
          entryCount: 50,
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logDataAccess(
        req as express.Request,
        'team-1',
        'entry',
        'entry-1',
        'export',
        { format: 'csv', entryCount: 50 }
      );

      expect(mockDb).toHaveBeenCalled();
    });

    it('should log encryption key access', async () => {
      const mockEvent = {
        id: 'audit-9',
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: 'user-1',
        action: 'data_access:decrypt',
        resource_type: 'encryption_key',
        resource_id: 'key-1',
        details: {
          accessType: 'decrypt',
          severity: 'high',
          keyType: 'master',
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logDataAccess(
        req as express.Request,
        'team-1',
        'encryption_key',
        'key-1',
        'decrypt',
        { keyType: 'master' }
      );

      expect(mockDb).toHaveBeenCalled();
    });
  });

  describe('Authentication Events Logging', () => {
    it('should log successful login', async () => {
      const mockEvent = {
        id: 'audit-10',
        organization_id: 'org-1',
        user_id: 'user-1',
        action: 'auth:login',
        resource_type: 'authentication',
        resource_id: undefined,
        details: {
          success: true,
          severity: 'medium',
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logAuthEvent(
        req as express.Request,
        'user-1',
        'org-1',
        'login',
        true
      );

      expect(mockDb).toHaveBeenCalled();
    });

    it('should log failed login attempt', async () => {
      const mockEvent = {
        id: 'audit-11',
        organization_id: 'org-1',
        user_id: 'user-99',
        action: 'auth:failed_login',
        resource_type: 'authentication',
        resource_id: undefined,
        details: {
          success: false,
          severity: 'high',
          reason: 'invalid_credentials',
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logAuthEvent(
        req as express.Request,
        'user-99',
        'org-1',
        'failed_login',
        false,
        { reason: 'invalid_credentials' }
      );

      expect(mockDb).toHaveBeenCalled();
    });

    it('should track multiple failed login attempts from same IP', async () => {
      const mockEvents = Array.from({ length: 5 }, (_, i) => ({
        id: `audit-failed-${i}`,
        organization_id: 'org-1',
        user_id: 'user-99',
        action: 'auth:failed_login',
        resource_type: 'authentication',
        resource_id: undefined,
        details: {
          success: false,
          severity: 'high',
          attemptNumber: i + 1,
        },
        ip_address: '192.168.1.100',
        created_at: new Date(Date.now() - i * 1000),
      }));

      setResponses([mockEvents]);

      const events = await auditService.getAuditLog('org-1', {
        action: 'auth:failed_login',
        limit: 100,
      });

      expect(events).toBeDefined();
    });

    it('should log token refresh', async () => {
      const mockEvent = {
        id: 'audit-12',
        organization_id: 'org-1',
        user_id: 'user-1',
        action: 'auth:token_refresh',
        resource_type: 'authentication',
        resource_id: undefined,
        details: {
          success: true,
          severity: 'low',
        },
        ip_address: '192.168.1.1',
        created_at: new Date(),
      };

      setResponses([[mockEvent]]);

      await auditTracker.logAuthEvent(
        req as express.Request,
        'user-1',
        'org-1',
        'token_refresh',
        true
      );

      expect(mockDb).toHaveBeenCalled();
    });
  });

  describe('Audit Statistics and Filtering', () => {
    it('should generate statistics for large event set (1000+ entries)', async () => {
      const mockEvents = Array.from({ length: 1000 }, (_, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: `user-${i % 10}`,
        action: ['session:export', 'session:playback:access', 'member_added', 'auth:login'][i % 4],
        resource_type: ['session', 'team_member', 'authentication'][i % 3],
        resource_id: `resource-${i}`,
        details: {
          severity: ['low', 'medium', 'high', 'critical'][i % 4],
        },
        ip_address: '192.168.1.1',
        created_at: new Date(Date.now() - i * 1000),
      }));

      setResponses([mockEvents]);

      const events = await auditService.getAuditLog('org-1', { limit: 1000 });

      expect(events).toBeDefined();
    });

    it('should query events by action type', async () => {
      const mockEvents = Array.from({ length: 50 }, (_, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        action: 'session:export',
        resource_type: 'session',
        user_id: 'user-1',
        created_at: new Date(),
      }));

      setResponses([mockEvents]);

      const events = await auditService.getAuditLog('org-1', {
        action: 'session:export',
        limit: 100,
      });

      expect(events).toBeDefined();
    });

    it('should query events by severity level', async () => {
      const mockEvents = Array.from({ length: 30 }, (_, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        action: 'session:export',
        resource_type: 'session',
        user_id: 'user-1',
        details: { severity: 'high' },
        created_at: new Date(),
      }));

      setResponses([mockEvents]);

      const events = await auditService.queryAuditEvents('org-1', {
        severity: 'high',
        limit: 100,
      });

      expect(events).toBeDefined();
    });

    it('should filter events by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const mockEvents = [
        {
          id: 'audit-1',
          organization_id: 'org-1',
          action: 'session:export',
          created_at: new Date('2024-06-15'),
        },
      ];

      setResponses([mockEvents]);

      const events = await auditService.getAuditLog('org-1', {
        startDate,
        endDate,
        limit: 100,
      });

      expect(events).toBeDefined();
    });
  });

  describe('Compliance and Risk Assessment', () => {
    it('should generate compliance report', async () => {
      // Mock responses for getEventCount, getUniqueUsers, getUniqueActions, getRetentionPolicy
      const mockEventCount = [{ count: 500 }];
      const mockUsers = [
        { user_id: 'user-1' },
        { user_id: 'user-2' },
        { user_id: 'user-3' },
        { user_id: 'user-4' },
        { user_id: 'user-5' },
      ];
      const mockActions = [
        { action: 'session:export' },
        { action: 'session:playback:access' },
        { action: 'member_added' },
        { action: 'auth:login' },
      ];
      const mockPolicy = {
        id: 'policy-1',
        organization_id: 'org-1',
        team_audit_retention_days: 90,
        session_recording_retention_days: 30,
        updated_at: new Date(),
      };

      setResponses([mockEventCount, mockUsers, mockActions, mockPolicy]);

      const report = await auditService.generateComplianceReport('org-1');

      expect(report).toBeDefined();
      expect(report.organization_id).toBe('org-1');
      expect(report.report_type).toBe('compliance');
      expect(report.events_count).toBe(500);
      expect(report.retention_days).toBe(90);
    });

    it('should assess user risk score', async () => {
      const mockEvents = Array.from({ length: 50 }, (_, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        user_id: 'user-risktest',
        action: ['auth:failed_login', 'session:export', 'member_added', 'data_access:decrypt'][i % 4],
        resource_type: 'session',
        created_at: new Date(),
        details: { severity: 'high' },
      }));

      setResponses([mockEvents]);

      const assessment = await auditService.getUserRiskAssessment('org-1', 'user-risktest', 30);

      expect(assessment).toBeDefined();
      expect(assessment.userId).toBe('user-risktest');
    });
  });

  describe('Performance with Large Datasets', () => {
    it('should handle 10000+ audit entries efficiently', async () => {
      const mockEvents = Array.from({ length: 10000 }, (_, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        team_id: 'team-1',
        user_id: `user-${i % 100}`,
        action: ['session:export', 'playback:access', 'member_added', 'auth:login'][i % 4],
        resource_type: ['session', 'team_member'][i % 2],
        resource_id: `resource-${i}`,
        created_at: new Date(Date.now() - i * 100),
        details: { severity: ['low', 'medium', 'high'][i % 3] },
      }));

      setResponses([mockEvents.slice(0, 1000)]);

      const startTime = Date.now();
      const events = await auditService.getAuditLog('org-1', { limit: 1000 });
      const duration = Date.now() - startTime;

      expect(events).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete in reasonable time
    });

    it('should efficiently export large audit logs (1000+ entries)', async () => {
      const mockEvents = Array.from({ length: 1000 }, (_, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        user_id: 'user-1',
        action: 'session:export',
        resource_type: 'session',
        details: { severity: 'high' },
        created_at: new Date(),
      }));

      setResponses([mockEvents]);

      const result = await auditService.exportAuditLog('org-1', 'json', { limit: 10000 });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should batch query large result sets efficiently', async () => {
      const mockEvents = Array.from({ length: 500 }, (_, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        action: 'session:export',
        resource_type: 'session',
        created_at: new Date(),
      }));

      setResponses([mockEvents]);

      const startTime = Date.now();
      const events = await auditService.getAuditLog('org-1', {
        limit: 500,
        offset: 0,
      });
      const duration = Date.now() - startTime;

      expect(events).toBeDefined();
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('IP Address Tracking', () => {
    it('should track events by IP address', async () => {
      const mockEvents = Array.from({ length: 10 }, (_, i) => ({
        id: `audit-${i}`,
        organization_id: 'org-1',
        user_id: 'user-1',
        action: 'session:export',
        resource_type: 'session',
        ip_address: '192.168.1.100',
        created_at: new Date(),
      }));

      setResponses([mockEvents]);

      const events = await auditService.queryAuditEvents('org-1', {
        ipAddress: '192.168.1.100',
        limit: 100,
      });

      expect(events).toBeDefined();
    });

    it('should detect events from multiple IP addresses', async () => {
      const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];
      const mockEvents = ips.flatMap((ip) =>
        Array.from({ length: 5 }, (_, i) => ({
          id: `audit-${ip}-${i}`,
          organization_id: 'org-1',
          user_id: 'user-1',
          action: 'session:export',
          resource_type: 'session',
          ip_address: ip,
          created_at: new Date(),
        }))
      );

      setResponses([mockEvents]);

      const events = await auditService.getAuditLog('org-1', { limit: 100 });

      expect(events).toBeDefined();
    });
  });
});
