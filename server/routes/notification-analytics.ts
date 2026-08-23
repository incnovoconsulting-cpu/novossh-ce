import express from 'express';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { NotificationAnalyticsService } from '../services/NotificationAnalyticsService.js';

export const notificationAnalyticsRouter = express.Router();
const analyticsService = new NotificationAnalyticsService();

/**
 * GET /api/notification-analytics/delivery-stats
 * Get delivery statistics for notifications
 * Query params:
 *   - days: Number of days to look back (default 30)
 */
notificationAnalyticsRouter.get('/delivery-stats', authMiddleware, async (req, res) => {
  try {
    const user = getUser(req);
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    if (days < 1 || days > 365) {
      res.status(400).json({ error: 'Days must be between 1 and 365' });
      return;
    }

    const stats = await analyticsService.getDeliveryStats(user.id, days);

    res.json({
      userId: user.id,
      stats,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[notification-analytics] Failed to get delivery stats:', error);
    res.status(500).json({ error: 'Failed to retrieve delivery statistics' });
  }
});

/**
 * GET /api/notification-analytics/engagement
 * Get engagement metrics for notifications
 */
notificationAnalyticsRouter.get('/engagement', authMiddleware, async (req, res) => {
  try {
    const user = getUser(req);

    const metrics = await analyticsService.getEngagementMetrics(user.id);

    res.json({
      userId: user.id,
      metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[notification-analytics] Failed to get engagement metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve engagement metrics' });
  }
});

/**
 * GET /api/notification-analytics/history
 * Get notification history
 * Query params:
 *   - type: Filter by notification type (optional)
 *   - limit: Maximum number of results (default 50, max 200)
 */
notificationAnalyticsRouter.get('/history', authMiddleware, async (req, res) => {
  try {
    const user = getUser(req);
    const type = req.query.type as string | undefined;
    let limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    // Validate limit
    if (limit < 1 || limit > 200) {
      limit = Math.min(Math.max(limit, 1), 200);
    }

    const history = await analyticsService.getNotificationHistory(user.id, type, limit);

    res.json({
      userId: user.id,
      type: type || 'all',
      count: history.length,
      history,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[notification-analytics] Failed to get notification history:', error);
    res.status(500).json({ error: 'Failed to retrieve notification history' });
  }
});

/**
 * GET /api/notification-analytics/trends
 * Get notification volume trends
 * Query params:
 *   - days: Number of days to look back (default 30)
 */
notificationAnalyticsRouter.get('/trends', authMiddleware, async (req, res) => {
  try {
    const user = getUser(req);
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    if (days < 1 || days > 365) {
      res.status(400).json({ error: 'Days must be between 1 and 365' });
      return;
    }

    const trends = await analyticsService.getTrendData(user.id, days);

    res.json({
      userId: user.id,
      period: `${days}d`,
      dataPoints: trends,
      count: trends.length,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[notification-analytics] Failed to get trend data:', error);
    res.status(500).json({ error: 'Failed to retrieve trend data' });
  }
});

/**
 * GET /api/notification-analytics/preferences
 * Get user notification preference statistics
 */
notificationAnalyticsRouter.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const user = getUser(req);

    const stats = await analyticsService.getPreferenceStats(user.id);

    res.json({
      userId: user.id,
      stats,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[notification-analytics] Failed to get preference stats:', error);
    res.status(500).json({ error: 'Failed to retrieve preference statistics' });
  }
});

/**
 * GET /api/notification-analytics/trial-notifications
 * Get trial notification statistics
 */
notificationAnalyticsRouter.get('/trial-notifications', authMiddleware, async (req, res) => {
  try {
    const user = getUser(req);

    const stats = await analyticsService.getTrialNotificationStats(user.id);

    res.json({
      userId: user.id,
      stats,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[notification-analytics] Failed to get trial notification stats:', error);
    res.status(500).json({ error: 'Failed to retrieve trial notification statistics' });
  }
});

/**
 * GET /api/notification-analytics/plan-downgrades
 * Get plan downgrade notification statistics
 */
notificationAnalyticsRouter.get('/plan-downgrades', authMiddleware, async (req, res) => {
  try {
    const user = getUser(req);

    const stats = await analyticsService.getPlanDowngradeStats(user.id);

    res.json({
      userId: user.id,
      stats,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[notification-analytics] Failed to get plan downgrade stats:', error);
    res.status(500).json({ error: 'Failed to retrieve plan downgrade statistics' });
  }
});

/**
 * GET /api/notification-analytics/summary
 * Get comprehensive summary of all notification analytics
 */
notificationAnalyticsRouter.get('/summary', authMiddleware, async (req, res) => {
  try {
    const user = getUser(req);
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

    if (days < 1 || days > 365) {
      res.status(400).json({ error: 'Days must be between 1 and 365' });
      return;
    }

    // Fetch all analytics in parallel
    const [deliveryStats, engagement, preferences, trends, trialStats, downgrades] =
      await Promise.all([
        analyticsService.getDeliveryStats(user.id, days),
        analyticsService.getEngagementMetrics(user.id),
        analyticsService.getPreferenceStats(user.id),
        analyticsService.getTrendData(user.id, days),
        analyticsService.getTrialNotificationStats(user.id),
        analyticsService.getPlanDowngradeStats(user.id),
      ]);

    res.json({
      userId: user.id,
      period: `${days}d`,
      summary: {
        deliveryStats,
        engagement,
        preferences,
        trends,
        trialNotifications: trialStats,
        planDowngrades: downgrades,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[notification-analytics] Failed to get summary:', error);
    res.status(500).json({ error: 'Failed to retrieve analytics summary' });
  }
});

export default notificationAnalyticsRouter;
