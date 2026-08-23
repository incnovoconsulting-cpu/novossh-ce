import express from 'express';
import { SessionAnalyticsService } from '../services/SessionAnalyticsService.js';
import { PermissionService } from '../services/PermissionService.js';
import { AnalyticsService } from '../services/AnalyticsService.js';

const router = express.Router();

const sessionAnalyticsService = new SessionAnalyticsService();
const permissionService = new PermissionService();
const analyticsService = new AnalyticsService();

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// Helper: Check permission and return 403 if denied
const checkAnalyticsPermission = async (req: express.Request, res: express.Response): Promise<boolean> => {
  const user = getUser(req);
  if (!user) { res.status(401).json({ error: 'Authentication required' }); return false; }
  const teamId = req.query.teamId as string;

  // Solo users (no teamId) can always read their own analytics
  if (!teamId) return true;

  try {
    const hasPermission = await permissionService.checkPermission(user.id, teamId, 'analytics:read');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return false;
    }
    return true;
  } catch (error) {
    console.error('[analytics] Permission check failed:', error);
    res.status(500).json({ error: 'Permission check failed' });
    return false;
  }
};

/**
 * GET /api/analytics/sessions
 * Get aggregated session metrics with trend analysis
 */
router.get('/sessions', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const days = parseInt((req.query.days as string) || '30', 10);

    const metrics = await sessionAnalyticsService.getSessionMetricsWithTrends(teamId, days);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('[analytics] Failed to get session metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve session metrics' });
  }
});

/**
 * GET /api/analytics/users
 * Get user behavior profiles and engagement distribution
 */
router.get('/users', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const limit = parseInt((req.query.limit as string) || '20', 10);

    const [profiles, distribution] = await Promise.all([
      sessionAnalyticsService.getUserBehaviorProfiles(teamId, limit),
      sessionAnalyticsService.getUserEngagementDistribution(teamId),
    ]);

    res.json({
      success: true,
      data: { profiles, distribution },
    });
  } catch (error) {
    console.error('[analytics] Failed to get user analytics:', error);
    res.status(500).json({ error: 'Failed to retrieve user analytics' });
  }
});

/**
 * GET /api/analytics/commands
 * Get command analytics with success rates and execution times
 */
router.get('/commands', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const days = parseInt((req.query.days as string) || '30', 10);
    const limit = parseInt((req.query.limit as string) || '15', 10);

    const [topCommands, successAnalysis, distribution, byCategory] = await Promise.all([
      sessionAnalyticsService.getTopCommands(teamId, limit, days),
      sessionAnalyticsService.getCommandSuccessAnalysis(teamId, days),
      sessionAnalyticsService.getCommandExecutionDistribution(teamId, days),
      sessionAnalyticsService.getCommandSuccessByCategory(teamId, days),
    ]);

    res.json({
      success: true,
      data: {
        topCommands,
        successAnalysis,
        executionDistribution: distribution,
        byCategory,
      },
    });
  } catch (error) {
    console.error('[analytics] Failed to get command analytics:', error);
    res.status(500).json({ error: 'Failed to retrieve command analytics' });
  }
});

/**
 * GET /api/analytics/features
 * Get feature adoption metrics and timeline
 */
router.get('/features', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const days = parseInt((req.query.days as string) || '30', 10);

    const [metrics, timeline, byStage] = await Promise.all([
      sessionAnalyticsService.getFeatureAdoptionMetrics(teamId, days),
      sessionAnalyticsService.getFeatureAdoptionTimeline(teamId, days),
      sessionAnalyticsService.getFeatureAdoptionByStage(teamId),
    ]);

    res.json({
      success: true,
      data: { metrics, timeline, byStage },
    });
  } catch (error) {
    console.error('[analytics] Failed to get feature adoption analytics:', error);
    res.status(500).json({ error: 'Failed to retrieve feature adoption analytics' });
  }
});

/**
 * GET /api/analytics/performance
 * Get performance metrics (latency, throughput, reliability)
 */
router.get('/performance', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const hours = parseInt((req.query.hours as string) || '24', 10);
    const days = parseInt((req.query.days as string) || '30', 10);

    const [metrics, trends] = await Promise.all([
      sessionAnalyticsService.getPerformanceMetrics(teamId, undefined, hours),
      sessionAnalyticsService.getPerformanceTrends(teamId, days),
    ]);

    res.json({
      success: true,
      data: { metrics, trends },
    });
  } catch (error) {
    console.error('[analytics] Failed to get performance analytics:', error);
    res.status(500).json({ error: 'Failed to retrieve performance analytics' });
  }
});

/**
 * GET /api/analytics/anomalies
 * Get detected anomalies with severity levels and context
 */
router.get('/anomalies', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const severity = (req.query.severity as string) || undefined;
    const limit = parseInt((req.query.limit as string) || '50', 10);

    const [anomalies, bySeverity, active] = await Promise.all([
      sessionAnalyticsService.getAnomalies(teamId, severity, limit),
      sessionAnalyticsService.getUnresolvedAnomaliesBySeverity(teamId),
      sessionAnalyticsService.detectActiveAnomalies(teamId),
    ]);

    res.json({
      success: true,
      data: { anomalies, bySeverity, active },
    });
  } catch (error) {
    console.error('[analytics] Failed to get anomalies:', error);
    res.status(500).json({ error: 'Failed to retrieve anomalies' });
  }
});

/**
 * GET /api/analytics/churn-risk
 * Get churn risk assessments and high-risk users for outreach
 */
router.get('/churn-risk', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const minRiskScore = parseInt((req.query.minRiskScore as string) || '60', 10);

    const [assessments, highRiskUsers] = await Promise.all([
      sessionAnalyticsService.getChurnRiskAssessments(teamId, 50),
      sessionAnalyticsService.getChurnRiskUsersWithContext(teamId, minRiskScore),
    ]);

    res.json({
      success: true,
      data: { assessments, highRiskUsers },
    });
  } catch (error) {
    console.error('[analytics] Failed to get churn risk analytics:', error);
    res.status(500).json({ error: 'Failed to retrieve churn risk analytics' });
  }
});

/**
 * GET /api/analytics/heatmap
 * Get user activity heatmap (24-hour pattern by day of week)
 */
router.get('/heatmap', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const userId = (req.query.userId as string) || undefined;

    const heatmap = await sessionAnalyticsService.getUserActivityHeatmap(teamId, userId);

    res.json({
      success: true,
      data: { heatmap },
    });
  } catch (error) {
    console.error('[analytics] Failed to get activity heatmap:', error);
    res.status(500).json({ error: 'Failed to retrieve activity heatmap' });
  }
});

/**
 * GET /api/analytics/hourly-distribution
 * Get hourly session distribution
 */
router.get('/hourly-distribution', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const days = parseInt((req.query.days as string) || '7', 10);

    const distribution = await sessionAnalyticsService.getHourlySessionDistribution(teamId, days);

    res.json({
      success: true,
      data: { distribution },
    });
  } catch (error) {
    console.error('[analytics] Failed to get hourly distribution:', error);
    res.status(500).json({ error: 'Failed to retrieve hourly distribution' });
  }
});

/**
 * GET /api/analytics/activity-comparison
 * Get session activity comparison across time periods
 */
router.get('/activity-comparison', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const period1 = parseInt((req.query.period1Days as string) || '7', 10);
    const period2 = parseInt((req.query.period2Days as string) || '7', 10);

    const comparison = await sessionAnalyticsService.getSessionActivityComparison(teamId, period1, period2);

    res.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    console.error('[analytics] Failed to get activity comparison:', error);
    res.status(500).json({ error: 'Failed to retrieve activity comparison' });
  }
});

/**
 * GET /api/analytics/summary
 * Get comprehensive analytics summary for a period
 */
router.get('/summary', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const days = parseInt((req.query.days as string) || '30', 10);

    const summary = await sessionAnalyticsService.getAnalyticsSummary(teamId, days);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[analytics] Failed to get analytics summary:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics summary' });
  }
});

/**
 * GET /api/analytics/overview
 * Dashboard summary with connections, sessions, commands, storage, team
 */
router.get('/overview', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const teamId = req.query.teamId as string;
    const days = parseInt((req.query.days as string) || '30', 10);

    const overview = await analyticsService.getOverview(user.id, teamId, days);

    res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error('[analytics] Failed to get overview:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics overview' });
  }
});

/**
 * GET /api/analytics/connections
 * Connection history with daily breakdown
 */
router.get('/connections', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const days = parseInt((req.query.days as string) || '30', 10);

    const history = await analyticsService.getConnectionHistory(user.id, days);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('[analytics] Failed to get connection history:', error);
    res.status(500).json({ error: 'Failed to retrieve connection history' });
  }
});

/**
 * GET /api/analytics/hosts
 * Host usage stats sorted by connection count
 */
router.get('/hosts', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const days = parseInt((req.query.days as string) || '30', 10);

    const hosts = await analyticsService.getHostUsage(user.id, days);

    res.json({
      success: true,
      data: hosts,
    });
  } catch (error) {
    console.error('[analytics] Failed to get host usage:', error);
    res.status(500).json({ error: 'Failed to retrieve host usage' });
  }
});

/**
 * GET /api/analytics/export
 * Export analytics data as CSV
 */
router.get('/export', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const days = parseInt((req.query.days as string) || '30', 10);

    const csv = await analyticsService.exportCsv(user.id, days);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="novossh-analytics-${days}d.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('[analytics] Failed to export analytics:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

/**
 * POST /api/analytics/outreach-flag
 * Flag a user for churn outreach
 */
router.post('/outreach-flag', async (req, res) => {
  try {
    if (!(await checkAnalyticsPermission(req, res))) return;

    const teamId = req.query.teamId as string;
    const { userId, reasons } = req.body;

    if (!userId || !Array.isArray(reasons)) {
      res.status(400).json({ error: 'userId and reasons array required' });
      return;
    }

    await sessionAnalyticsService.flagUserForChurnOutreach(teamId, userId, reasons);

    res.json({
      success: true,
      message: 'User flagged for outreach',
    });
  } catch (error) {
    console.error('[analytics] Failed to flag user for outreach:', error);
    res.status(500).json({ error: 'Failed to flag user for outreach' });
  }
});

export default router;
