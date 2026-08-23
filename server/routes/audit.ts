import express from 'express';
import { AuditService } from '../services/AuditService.js';
import { PermissionService } from '../services/PermissionService.js';

const router = express.Router();

export const auditService = new AuditService();
export const permissionService = new PermissionService();

function getUser(req: express.Request): { id: string; organizationId: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// GET /api/audit-logs - List audit events with filtering
router.get('/logs', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      req.query.teamId as string,
      'audit:read'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const filters = {
      teamId: req.query.teamId as string | undefined,
      userId: req.query.userId as string | undefined,
      action: req.query.action as string | undefined,
      resourceType: req.query.resourceType as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const events = await auditService.getAuditLog(user.organizationId, filters);

    res.json({
      data: events,
      count: events.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve audit log' });
  }
});

// GET /api/audit-logs/export - Export logs in CSV/JSON format
router.get('/logs/export', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const format = (req.query.format as string) || 'json';

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      req.query.teamId as string,
      'audit:export'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    if (format !== 'json' && format !== 'csv') {
      res.status(400).json({ error: 'Format must be json or csv' });
      return;
    }

    const filters = {
      teamId: req.query.teamId as string | undefined,
      userId: req.query.userId as string | undefined,
      action: req.query.action as string | undefined,
      resourceType: req.query.resourceType as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const exported = await auditService.exportAuditLog(user.organizationId, format as 'csv' | 'json', filters);

    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    const filename = format === 'json' ? 'audit-log.json' : 'audit-log.csv';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exported);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export audit log' });
  }
});

// GET /api/compliance/report - Generate compliance report
router.get('/compliance/report', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      req.query.teamId as string,
      'compliance:read'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const filters = {
      teamId: req.query.teamId as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const report = await auditService.generateComplianceReport(user.organizationId, filters);

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate compliance report' });
  }
});

// GET /api/audit-retention - Get retention policy
router.get('/retention', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      req.query.teamId as string,
      'audit:config'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const policy = await auditService.getRetentionPolicy(user.organizationId);

    if (!policy) {
      res.status(404).json({ error: 'Retention policy not found' });
      return;
    }

    res.json(policy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve retention policy' });
  }
});

// POST /api/audit-retention - Set retention policy
router.post('/retention', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { teamAuditRetentionDays, sessionRecordingRetentionDays } = req.body;

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      req.body.teamId as string,
      'audit:config'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    if (!teamAuditRetentionDays || !sessionRecordingRetentionDays) {
      res.status(400).json({ error: 'Retention days are required' });
      return;
    }

    const policy = await auditService.setRetentionPolicy(
      user.organizationId,
      teamAuditRetentionDays,
      sessionRecordingRetentionDays
    );

    res.status(201).json(policy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to set retention policy' });
  }
});

// POST /api/audit-summary - Get audit summary
router.get('/summary', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      req.query.teamId as string,
      'audit:read'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const summary = await auditService.getAuditSummary(user.organizationId, days);

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate audit summary' });
  }
});

// GET /api/audit/stats - Get audit statistics for a period
router.get('/stats', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const teamId = req.query.teamId as string;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    // Check permission
    const hasPermission = await permissionService.checkPermission(user.id, teamId, 'audit:read');

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await auditService.getAuditStatistics(user.organizationId, startDate, endDate);

    res.json({
      ...stats,
      period: {
        startDate,
        endDate,
        days,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate audit statistics' });
  }
});

// GET /api/audit/user-risk/:userId - Get risk assessment for a user
router.get('/user-risk/:userId', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const targetUserId = req.params.userId;
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const teamId = req.query.teamId as string;

    // Check permission
    const hasPermission = await permissionService.checkPermission(user.id, teamId, 'audit:read');

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const assessment = await auditService.getUserRiskAssessment(user.organizationId, targetUserId, days);

    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to assess user risk' });
  }
});

// GET /api/audit/events - Advanced audit event query with filters
router.get('/events', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const teamId = req.query.teamId as string;

    // Check permission
    const hasPermission = await permissionService.checkPermission(user.id, teamId, 'audit:read');

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const events = await auditService.queryAuditEvents(user.organizationId, {
      teamId: req.query.teamId as string | undefined,
      userId: req.query.userId as string | undefined,
      action: req.query.action as string | undefined,
      resourceType: req.query.resourceType as string | undefined,
      severity: req.query.severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
      ipAddress: req.query.ipAddress as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    });

    res.json({
      data: events,
      count: events.length,
      query: {
        teamId: req.query.teamId,
        userId: req.query.userId,
        action: req.query.action,
        resourceType: req.query.resourceType,
        severity: req.query.severity,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to query audit events' });
  }
});

// POST /api/audit/log - Manually log an audit event (internal use)
router.post('/log', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { teamId, action, resourceType, resourceId, details, ipAddress, userAgent } = req.body;

    if (!action || !resourceType) {
      res.status(400).json({ error: 'Action and resourceType are required' });
      return;
    }

    // Check permission for audit:write
    const hasPermission = await permissionService.checkPermission(user.id, teamId, 'audit:write');

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const event = await auditService.logEvent(
      user.organizationId,
      teamId,
      user.id,
      action,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent
    );

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: 'Failed to log audit event' });
  }
});

export { router as auditRouter };
export default router;
