import express from 'express';
import { getMonitoringService } from '../middleware/monitoring.js';
import { authMiddleware } from '../middleware/auth.js';
import { ComplianceService } from '../services/ComplianceService.js';
import { DashboardMetricsService } from '../services/DashboardMetricsService.js';
import { UsageAnalyticsService } from '../services/UsageAnalyticsService.js';
import { AuditService } from '../services/AuditService.js';

export const monitoringRouter = express.Router();

const monitoring = getMonitoringService();
const compliance = new ComplianceService();
const dashboardMetrics = new DashboardMetricsService();
const auditService = new AuditService();

/**
 * GET /api/monitoring/health
 * Get current system health status
 */
monitoringRouter.get('/health', async (_req, res) => {
  try {
    const health = await monitoring.getSystemHealth();
    res.json(health);
  } catch (error) {
    console.error('[monitoring] Health check failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve health status',
      status: 'critical',
    });
  }
});

/**
 * GET /api/monitoring/metrics
 * Get performance metrics for endpoints
 * Query: endpoint (optional), limit (optional)
 */
monitoringRouter.get('/metrics', authMiddleware, async (req, res) => {
  try {
    const endpoint = req.query.endpoint as string | undefined;

    if (endpoint) {
      const metrics = monitoring.getPerformanceMetrics(endpoint);
      res.json({
        endpoint,
        metrics,
      });
    } else {
      res.json({
        message: 'Provide endpoint query parameter to get metrics',
      });
    }
  } catch (error) {
    console.error('[monitoring] Failed to get metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * GET /api/monitoring/rate-limit-violations
 * Get rate limit violations with filtering
 * Query: status, severity, startDate, endDate, limit, offset
 */
monitoringRouter.get('/rate-limit-violations', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    const filters = {
      status: req.query.status as any,
      severity: req.query.severity as any,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const violations = await monitoring.getRateLimitViolations(filters);

    res.json({
      user_id: user.id,
      organization_id: user.organizationId,
      filters,
      violations,
      count: violations.length,
    });
  } catch (error) {
    console.error('[monitoring] Failed to get rate limit violations:', error);
    res.status(500).json({ error: 'Failed to retrieve violations' });
  }
});

/**
 * GET /api/monitoring/auth-failures
 * Get authentication failures with filtering
 * Query: status, severity, startDate, endDate, limit, offset
 */
monitoringRouter.get('/auth-failures', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    const filters = {
      status: req.query.status as any,
      severity: req.query.severity as any,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const failures = await monitoring.getAuthFailures(filters);

    res.json({
      user_id: user.id,
      organization_id: user.organizationId,
      filters,
      failures,
      count: failures.length,
    });
  } catch (error) {
    console.error('[monitoring] Failed to get auth failures:', error);
    res.status(500).json({ error: 'Failed to retrieve failures' });
  }
});

/**
 * GET /api/monitoring/brute-force-suspects
 * Get potential brute force attempts
 * Query: hourWindow (default 1)
 */
monitoringRouter.get('/brute-force-suspects', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const hourWindow = req.query.hourWindow ? parseInt(req.query.hourWindow as string) : 1;

    const suspects = await monitoring.getBruteForceSuspects(hourWindow);

    res.json({
      user_id: user.id,
      organization_id: user.organizationId,
      hour_window: hourWindow,
      suspects,
      count: suspects.length,
    });
  } catch (error) {
    console.error('[monitoring] Failed to get brute force suspects:', error);
    res.status(500).json({ error: 'Failed to retrieve suspects' });
  }
});

/**
 * POST /api/monitoring/violations/:violationId/resolve
 * Resolve a rate limit violation
 */
monitoringRouter.post('/violations/:violationId/resolve', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { violationId } = req.params;

    await monitoring.resolveViolation(violationId);

    res.json({
      success: true,
      violation_id: violationId,
      resolved_by: user.id,
      resolved_at: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to resolve violation:', error);
    res.status(500).json({ error: 'Failed to resolve violation' });
  }
});

/**
 * POST /api/monitoring/auth-failures/:failureId/resolve
 * Resolve an authentication failure
 */
monitoringRouter.post('/auth-failures/:failureId/resolve', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { failureId } = req.params;

    await monitoring.resolveAuthFailure(failureId);

    res.json({
      success: true,
      failure_id: failureId,
      resolved_by: user.id,
      resolved_at: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to resolve auth failure:', error);
    res.status(500).json({ error: 'Failed to resolve failure' });
  }
});

/**
 * GET /api/monitoring/status
 * Get monitoring system status and stats
 */
monitoringRouter.get('/status', authMiddleware, async (_req, res) => {
  try {
    const health = await monitoring.getSystemHealth();

    const violations = await monitoring.getRateLimitViolations({
      status: 'open',
      limit: 5,
    });

    const failures = await monitoring.getAuthFailures({
      status: 'open',
      limit: 5,
    });

    const suspects = await monitoring.getBruteForceSuspects(1);

    res.json({
      health,
      recent_violations: violations,
      recent_failures: failures,
      brute_force_suspects: suspects,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to get status:', error);
    res.status(500).json({ error: 'Failed to retrieve status' });
  }
});

/**
 * Prometheus metrics endpoint
 * GET /api/monitoring/prometheus
 */
monitoringRouter.get('/prometheus', async (_req, res) => {
  try {
    const health = await monitoring.getSystemHealth();

    let metrics = '# HELP novossh_system_health System health status\n';
    metrics += '# TYPE novossh_system_health gauge\n';
    metrics += `novossh_system_health{status="${health.status}"} ${health.status === 'healthy' ? 1 : health.status === 'degraded' ? 0.5 : 0}\n`;

    metrics += '\n# HELP novossh_database_latency_ms Database latency in milliseconds\n';
    metrics += '# TYPE novossh_database_latency_ms gauge\n';
    metrics += `novossh_database_latency_ms ${health.database.latency_ms}\n`;

    metrics += '\n# HELP novossh_auth_failed_attempts_1h Failed authentication attempts in last hour\n';
    metrics += '# TYPE novossh_auth_failed_attempts_1h gauge\n';
    metrics += `novossh_auth_failed_attempts_1h ${health.auth.failed_attempts_1h}\n`;

    metrics += '\n# HELP novossh_rate_limit_violations_1h Rate limit violations in last hour\n';
    metrics += '# TYPE novossh_rate_limit_violations_1h gauge\n';
    metrics += `novossh_rate_limit_violations_1h ${health.rate_limit.violations_1h}\n`;

    metrics += '\n# HELP novossh_memory_used_mb Memory used in MB\n';
    metrics += '# TYPE novossh_memory_used_mb gauge\n';
    metrics += `novossh_memory_used_mb ${health.memory.used_mb}\n`;

    metrics += '\n# HELP novossh_memory_available_mb Memory available in MB\n';
    metrics += '# TYPE novossh_memory_available_mb gauge\n';
    metrics += `novossh_memory_available_mb ${health.memory.available_mb}\n`;

    res.type('text/plain; version=0.0.4').send(metrics);
  } catch (error) {
    console.error('[monitoring] Failed to generate Prometheus metrics:', error);
    res.status(500).send('# Error generating metrics');
  }
});

/**
 * GET /api/monitoring/logs
 * Search and filter audit logs for monitoring
 * Query: action, severity, resource_type, userId, startDate, endDate, limit
 */
monitoringRouter.get('/logs', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    const filters = {
      action: req.query.action as string | undefined,
      severity: req.query.severity as 'low' | 'medium' | 'high' | 'critical' | undefined,
      resourceType: req.query.resource_type as string | undefined,
      userId: req.query.userId as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
    };

    const logs = await auditService.queryAuditEvents(user.organizationId, filters);

    res.json({
      user_id: user.id,
      organization_id: user.organizationId,
      filters,
      logs,
    });
  } catch (error) {
    console.error('[monitoring] Failed to get logs:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

/**
 * GET /api/monitoring/dashboard
 * Get comprehensive dashboard metrics
 * Query: organization_id (optional)
 */
monitoringRouter.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const organizationId = user.organizationId;

    const metrics = await dashboardMetrics.getDashboardMetrics(organizationId);

    res.json({
      user_id: user.id,
      organization_id: organizationId,
      metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to get dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard metrics' });
  }
});

/**
 * GET /api/monitoring/system-events
 * Get system events with filtering
 * Query: event_type, severity, status, startDate, endDate, limit, offset
 */
monitoringRouter.get('/system-events', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    const events = await monitoring.getSystemEvents({
      event_type: req.query.event_type as string | undefined,
      severity: req.query.severity as string | undefined,
      status: req.query.status as string | undefined,
      organization_id: user.organizationId,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    });

    res.json({
      user_id: user.id,
      organization_id: user.organizationId,
      events,
      count: events.length,
    });
  } catch (error) {
    console.error('[monitoring] Failed to get system events:', error);
    res.status(500).json({ error: 'Failed to retrieve system events' });
  }
});

/**
 * POST /api/monitoring/system-events/:eventId/acknowledge
 * Acknowledge a system event
 */
monitoringRouter.post('/system-events/:eventId/acknowledge', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { eventId } = req.params;

    await monitoring.acknowledgeSystemEvent(eventId, user.id);

    res.json({
      success: true,
      event_id: eventId,
      acknowledged_by: user.id,
      acknowledged_at: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to acknowledge event:', error);
    res.status(500).json({ error: 'Failed to acknowledge event' });
  }
});

/**
 * POST /api/monitoring/system-events/:eventId/resolve
 * Resolve a system event
 */
monitoringRouter.post('/system-events/:eventId/resolve', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { eventId } = req.params;

    await monitoring.resolveSystemEvent(eventId, user.id);

    res.json({
      success: true,
      event_id: eventId,
      resolved_by: user.id,
      resolved_at: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to resolve event:', error);
    res.status(500).json({ error: 'Failed to resolve event' });
  }
});

/**
 * GET /api/monitoring/api-usage
 * Get API usage statistics
 * Query: endpoint, stat_date, stat_hour, limit, offset
 */
monitoringRouter.get('/api-usage', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    const stats = await monitoring.getApiUsageStats({
      endpoint: req.query.endpoint as string | undefined,
      stat_date: req.query.stat_date as string | undefined,
      stat_hour: req.query.stat_hour ? parseInt(req.query.stat_hour as string) : undefined,
      organization_id: user.organizationId,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    });

    res.json({
      user_id: user.id,
      organization_id: user.organizationId,
      stats,
      count: stats.length,
    });
  } catch (error) {
    console.error('[monitoring] Failed to get API usage stats:', error);
    res.status(500).json({ error: 'Failed to retrieve API usage stats' });
  }
});

/**
 * GET /api/monitoring/alert-rules
 * Get alert rules for organization
 */
monitoringRouter.get('/alert-rules', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    const rules = await monitoring.getAlertRules(user.organizationId);

    res.json({
      user_id: user.id,
      organization_id: user.organizationId,
      rules,
      count: rules.length,
    });
  } catch (error) {
    console.error('[monitoring] Failed to get alert rules:', error);
    res.status(500).json({ error: 'Failed to retrieve alert rules' });
  }
});

/**
 * POST /api/monitoring/alert-rules
 * Create a new alert rule
 */
monitoringRouter.post('/alert-rules', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { name, description, rule_type, condition, actions } = req.body;

    const rule = await monitoring.createAlertRule(
      user.organizationId,
      name,
      rule_type,
      condition,
      actions,
      description
    );

    res.status(201).json({
      success: true,
      rule,
      created_by: user.id,
      created_at: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to create alert rule:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

/**
 * PUT /api/monitoring/alert-rules/:ruleId
 * Update an alert rule
 */
monitoringRouter.put('/alert-rules/:ruleId', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { ruleId } = req.params;
    const { name, description, condition, actions, is_enabled } = req.body;

    const rule = await monitoring.updateAlertRule(ruleId, {
      name,
      description,
      condition_json: condition,
      actions_json: actions,
      is_enabled,
    });

    res.json({
      success: true,
      rule,
      updated_by: user.id,
      updated_at: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to update alert rule:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

/**
 * DELETE /api/monitoring/alert-rules/:ruleId
 * Delete an alert rule
 */
monitoringRouter.delete('/alert-rules/:ruleId', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { ruleId } = req.params;

    await monitoring.deleteAlertRule(ruleId);

    res.json({
      success: true,
      rule_id: ruleId,
      deleted_by: user.id,
      deleted_at: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to delete alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
});

/**
 * POST /api/monitoring/compliance/audit-report
 * Generate an audit compliance report
 * Body: startDate, endDate
 */
monitoringRouter.post('/compliance/audit-report', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.body;

    const report = await compliance.generateAuditReport(
      user.organizationId,
      new Date(startDate),
      new Date(endDate),
      user.id
    );

    res.status(201).json({
      success: true,
      report,
      generated_at: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to generate audit report:', error);
    res.status(500).json({ error: 'Failed to generate audit report' });
  }
});

/**
 * POST /api/monitoring/compliance/security-report
 * Generate a security compliance report
 * Body: startDate, endDate
 */
monitoringRouter.post('/compliance/security-report', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.body;

    const report = await compliance.generateSecurityReport(
      user.organizationId,
      new Date(startDate),
      new Date(endDate),
      user.id
    );

    res.status(201).json({
      success: true,
      report,
      generated_at: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to generate security report:', error);
    res.status(500).json({ error: 'Failed to generate security report' });
  }
});

/**
 * POST /api/monitoring/compliance/performance-report
 * Generate a performance compliance report
 * Body: startDate, endDate
 */
monitoringRouter.post('/compliance/performance-report', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const { startDate, endDate } = req.body;

    const report = await compliance.generatePerformanceReport(
      user.organizationId,
      new Date(startDate),
      new Date(endDate),
      user.id
    );

    res.status(201).json({
      success: true,
      report,
      generated_at: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to generate performance report:', error);
    res.status(500).json({ error: 'Failed to generate performance report' });
  }
});

/**
 * GET /api/monitoring/compliance/reports
 * Get compliance reports for organization
 * Query: report_type, startDate, endDate, limit
 */
monitoringRouter.get('/compliance/reports', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    const reports = await compliance.getComplianceReports(user.organizationId, {
      report_type: req.query.report_type as any,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });

    res.json({
      user_id: user.id,
      organization_id: user.organizationId,
      reports,
      count: reports.length,
    });
  } catch (error) {
    console.error('[monitoring] Failed to get compliance reports:', error);
    res.status(500).json({ error: 'Failed to retrieve compliance reports' });
  }
});

/**
 * GET /api/monitoring/compliance/summary
 * Get compliance summary for organization
 */
monitoringRouter.get('/compliance/summary', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;

    const summary = await compliance.getComplianceSummary(user.organizationId);

    res.json({
      user_id: user.id,
      organization_id: user.organizationId,
      summary,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[monitoring] Failed to get compliance summary:', error);
    res.status(500).json({ error: 'Failed to retrieve compliance summary' });
  }
});

/**
 * GET /api/monitoring/analytics/usage
 * Get current resource usage for authenticated user
 */
monitoringRouter.get('/analytics/usage', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const analyticsService = new UsageAnalyticsService();
    const usage = await analyticsService.getResourceUsage(user.id);
    res.json(usage);
  } catch (error) {
    console.error('[monitoring] Failed to get resource usage:', error);
    res.status(500).json({ error: 'Failed to retrieve resource usage' });
  }
});

/**
 * GET /api/monitoring/analytics/history
 * Get usage history for the last 30 days
 * Query: days (optional, default 30)
 */
monitoringRouter.get('/analytics/history', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const days = Math.min(parseInt(req.query.days as string) || 30, 365);
    const analyticsService = new UsageAnalyticsService();
    const history = await analyticsService.getUsageHistory(user.id, days);
    res.json({ days, history });
  } catch (error) {
    console.error('[monitoring] Failed to get usage history:', error);
    res.status(500).json({ error: 'Failed to retrieve usage history' });
  }
});

/**
 * GET /api/monitoring/analytics/api-usage
 * Get top API endpoints by request count
 * Query: hours (optional, default 24)
 */
monitoringRouter.get('/analytics/api-usage', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const hours = Math.min(parseInt(req.query.hours as string) || 24, 720);
    const analyticsService = new UsageAnalyticsService();
    const stats = await analyticsService.getApiUsageStats(user.id, hours);
    res.json({ hours, endpoints: stats });
  } catch (error) {
    console.error('[monitoring] Failed to get API usage stats:', error);
    res.status(500).json({ error: 'Failed to retrieve API usage stats' });
  }
});

/**
 * GET /api/monitoring/analytics/summary
 * Get complete analytics summary for user
 */
monitoringRouter.get('/analytics/summary', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const analyticsService = new UsageAnalyticsService();
    const summary = await analyticsService.getAnalyticsSummary(user.id);
    res.json(summary);
  } catch (error) {
    console.error('[monitoring] Failed to get analytics summary:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics summary' });
  }
});

export default monitoringRouter;
