import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { auditRouter, auditService, permissionService } from '../audit';

let app: express.Application;

beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const userId = req.headers['x-user-id'] as string;
    const orgId = req.headers['x-org-id'] as string;
    if (userId) {
      req.user = { id: userId, organizationId: orgId || 'org-1' };
    }
    next();
  });
  app.use('/api/audit', auditRouter);

  vi.spyOn(auditService, 'getAuditLog');
  vi.spyOn(auditService, 'exportAuditLog');
  vi.spyOn(auditService, 'generateComplianceReport');
  vi.spyOn(auditService, 'getRetentionPolicy');
  vi.spyOn(auditService, 'setRetentionPolicy');
  vi.spyOn(auditService, 'getAuditSummary');
  vi.spyOn(permissionService, 'checkPermission');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Audit Routes', () => {
  describe('GET /logs - List audit events', () => {
    it('should return audit logs for authorized users', async () => {
      const mockLogs = [
        { id: '1', action: 'create', resourceType: 'vault', userId: 'user-1' },
        { id: '2', action: 'update', resourceType: 'entry', userId: 'user-2' },
      ];
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.getAuditLog as any).mockResolvedValueOnce(mockLogs);

      const res = await request(app)
        .get('/api/audit/logs?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);
    });

    it('should deny access without audit:read permission', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const res = await request(app)
        .get('/api/audit/logs?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Permission denied');
    });

    it('should handle service errors gracefully', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.getAuditLog as any).mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get('/api/audit/logs?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to retrieve audit log');
    });
  });

  describe('GET /logs/export - Export audit logs', () => {
    it('should export logs as JSON format', async () => {
      const jsonData = JSON.stringify([{ id: '1', action: 'create' }]);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.exportAuditLog as any).mockResolvedValueOnce(jsonData);

      const res = await request(app)
        .get('/api/audit/logs/export?teamId=team-1&format=json')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-disposition']).toContain('audit-log.json');
    });

    it('should export logs as CSV format', async () => {
      const csvData = 'id,action,resourceType\n1,create,vault\n';
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.exportAuditLog as any).mockResolvedValueOnce(csvData);

      const res = await request(app)
        .get('/api/audit/logs/export?teamId=team-1&format=csv')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('audit-log.csv');
    });

    it('should reject invalid export format', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);

      const res = await request(app)
        .get('/api/audit/logs/export?teamId=team-1&format=xml')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Format must be json or csv');
    });

    it('should deny export without audit:export permission', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const res = await request(app)
        .get('/api/audit/logs/export?teamId=team-1&format=json')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Permission denied');
    });
  });

  describe('GET /compliance/report - Generate compliance report', () => {
    it('should return compliance report for authorized users', async () => {
      const mockReport = {
        teamId: 'team-1',
        reportDate: new Date(),
        accessViolations: 2,
        dataRetention: 'compliant',
      };
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.generateComplianceReport as any).mockResolvedValueOnce(mockReport);

      const res = await request(app)
        .get('/api/audit/compliance/report?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.teamId).toBe('team-1');
      expect(res.body.accessViolations).toBe(2);
    });

    it('should deny access without compliance:read permission', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const res = await request(app)
        .get('/api/audit/compliance/report?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Permission denied');
    });
  });

  describe('GET /retention - Get retention policy', () => {
    it('should return retention policy for authorized users', async () => {
      const mockPolicy = {
        id: 'policy-1',
        teamAuditRetentionDays: 365,
        sessionRecordingRetentionDays: 90,
      };
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.getRetentionPolicy as any).mockResolvedValueOnce(mockPolicy);

      const res = await request(app)
        .get('/api/audit/retention?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('policy-1');
      expect(res.body.teamAuditRetentionDays).toBe(365);
    });

    it('should deny access without audit:config permission', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const res = await request(app)
        .get('/api/audit/retention?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Permission denied');
    });

    it('should return 404 when policy not found', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.getRetentionPolicy as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/audit/retention?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Retention policy not found');
    });
  });

  describe('POST /retention - Set retention policy', () => {
    it('should create retention policy with valid data', async () => {
      const mockPolicy = {
        id: 'policy-1',
        teamAuditRetentionDays: 365,
        sessionRecordingRetentionDays: 90,
      };
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.setRetentionPolicy as any).mockResolvedValueOnce(mockPolicy);

      const res = await request(app)
        .post('/api/audit/retention')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          teamId: 'team-1',
          teamAuditRetentionDays: 365,
          sessionRecordingRetentionDays: 90,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('policy-1');
      expect(res.body.teamAuditRetentionDays).toBe(365);
    });

    it('should reject request with missing retention days', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/api/audit/retention')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          teamId: 'team-1',
          teamAuditRetentionDays: 365,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Retention days are required');
    });

    it('should deny access without audit:config permission', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/api/audit/retention')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          teamId: 'team-1',
          teamAuditRetentionDays: 365,
          sessionRecordingRetentionDays: 90,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Permission denied');
    });
  });

  describe('GET /summary - Get audit summary', () => {
    it('should return audit summary for authorized users', async () => {
      const mockSummary = {
        totalEvents: 1542,
        eventsByAction: { create: 500, update: 800, delete: 242 },
      };
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.getAuditSummary as any).mockResolvedValueOnce(mockSummary);

      const res = await request(app)
        .get('/api/audit/summary?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.totalEvents).toBe(1542);
    });

    it('should use default 30 days when not specified', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.getAuditSummary as any).mockResolvedValueOnce({});

      await request(app)
        .get('/api/audit/summary?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(auditService.getAuditSummary).toHaveBeenCalledWith('org-1', 30);
    });

    it('should accept custom days parameter', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (auditService.getAuditSummary as any).mockResolvedValueOnce({});

      await request(app)
        .get('/api/audit/summary?teamId=team-1&days=90')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(auditService.getAuditSummary).toHaveBeenCalledWith('org-1', 90);
    });

    it('should deny access without audit:read permission', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const res = await request(app)
        .get('/api/audit/summary?teamId=team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Permission denied');
    });
  });
});
