import { getDb } from '../db/connection.js';

/**
 * Delivery Statistics for notifications
 */
export interface DeliveryStats {
  period: string;
  byType: Record<
    string,
    {
      sent: number;
      delivered: number;
      failed: number;
      rate: number; // percentage
      avgDeliveryTimeMs?: number;
    }
  >;
  overall: {
    sent: number;
    delivered: number;
    failed: number;
    rate: number;
  };
}

/**
 * Engagement Metrics
 */
export interface EngagementMetrics {
  totalSent: number;
  uniqueTypes: number;
  topType: string;
  topTypeCount: number;
  averageTimeToDelivery: string; // formatted duration
  preferredFrequency: string;
}

/**
 * Notification History Entry
 */
export interface NotificationHistoryEntry {
  id: string;
  type: string;
  frequency: string;
  scheduledFor: Date;
  sentAt: Date | null;
  data: Record<string, unknown>;
}

/**
 * Trend Data for charts
 */
export interface TrendDataPoint {
  date: string;
  count: number;
  type?: string;
}

/**
 * Preference Statistics
 */
export interface PreferenceStats {
  totalNotificationTypes: number;
  byFrequency: Record<
    string,
    {
      count: number;
      enabledCount: number;
      disabledCount: number;
      avgMaxPerDay: number;
    }
  >;
  enabledTypes: string[];
  disabledTypes: string[];
  preferredMaxPerDay: number;
}

/**
 * Notification Analytics Service
 * Provides aggregated metrics and analytics for notification delivery and engagement
 */
export class NotificationAnalyticsService {
  private db = getDb();

  /**
   * Get delivery statistics for a user
   * @param userId User ID to get stats for
   * @param days Number of days to look back (default 30)
   * @returns Delivery statistics
   */
  async getDeliveryStats(userId: string, days: number = 30): Promise<DeliveryStats> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Query scheduled notifications to calculate delivery stats
      const stats = await this.db`
        SELECT
          type,
          COUNT(*) as sent,
          COUNT(*) FILTER (WHERE sent_at IS NOT NULL) as delivered,
          COUNT(*) FILTER (WHERE sent_at IS NULL AND scheduled_for < NOW()) as failed,
          ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - scheduled_for))) * 1000)::integer as avg_delivery_time_ms
        FROM scheduled_notifications
        WHERE user_id = ${userId}
          AND created_at >= ${startDate}
        GROUP BY type
      `;

      // Calculate overall stats
      let overallSent = 0;
      let overallDelivered = 0;
      let overallFailed = 0;

      const byType: Record<string, any> = {};

      for (const row of stats) {
        const sent = Number(row.sent);
        const delivered = Number(row.delivered);
        const failed = Number(row.failed);
        const rate = sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0;

        byType[row.type as string] = {
          sent,
          delivered,
          failed,
          rate,
          avgDeliveryTimeMs: row.avg_delivery_time_ms || 0,
        };

        overallSent += sent;
        overallDelivered += delivered;
        overallFailed += failed;
      }

      const overallRate =
        overallSent > 0 ? Math.round((overallDelivered / overallSent) * 1000) / 10 : 0;

      return {
        period: `${days}d`,
        byType,
        overall: {
          sent: overallSent,
          delivered: overallDelivered,
          failed: overallFailed,
          rate: overallRate,
        },
      };
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to get delivery stats:', error);
      throw error;
    }
  }

  /**
   * Get engagement metrics for a user
   * @param userId User ID to get metrics for
   * @returns Engagement metrics
   */
  async getEngagementMetrics(userId: string): Promise<EngagementMetrics> {
    try {
      // Get total sent and type breakdown
      const typeStats = await this.db`
        SELECT
          type,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (sent_at - scheduled_for))) as avg_delivery_seconds
        FROM scheduled_notifications
        WHERE user_id = ${userId}
          AND sent_at IS NOT NULL
        GROUP BY type
        ORDER BY count DESC
      `;

      let totalSent = 0;
      let topType = '';
      let topTypeCount = 0;
      let totalDeliverySeconds = 0;
      let deliveryCount = 0;

      for (const row of typeStats) {
        const count = Number(row.count);
        totalSent += count;

        if (count > topTypeCount) {
          topTypeCount = count;
          topType = row.type as string;
        }

        if (row.avg_delivery_seconds) {
          totalDeliverySeconds += (Number(row.avg_delivery_seconds) * count) as number;
          deliveryCount += count;
        }
      }

      // Get preferred frequency from preferences
      const preferences = await this.db`
        SELECT
          frequency,
          COUNT(*) as count
        FROM notification_preferences
        WHERE user_id = ${userId}
          AND enabled = true
        GROUP BY frequency
        ORDER BY count DESC
        LIMIT 1
      `;

      const preferredFrequency = (preferences[0]?.frequency as string) || 'immediate';
      const avgDeliverySeconds = deliveryCount > 0 ? totalDeliverySeconds / deliveryCount : 0;

      // Format average delivery time
      const avgDeliveryMs = Math.round(avgDeliverySeconds * 1000);
      const avgDeliveryTime = this.formatDuration(avgDeliveryMs);

      return {
        totalSent,
        uniqueTypes: typeStats.length,
        topType: topType || 'N/A',
        topTypeCount,
        averageTimeToDelivery: avgDeliveryTime,
        preferredFrequency,
      };
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to get engagement metrics:', error);
      throw error;
    }
  }

  /**
   * Get notification history for a user
   * @param userId User ID to get history for
   * @param type Optional notification type filter
   * @param limit Maximum number of results (default 50)
   * @returns Array of notification history entries
   */
  async getNotificationHistory(
    userId: string,
    type?: string,
    limit: number = 50
  ): Promise<NotificationHistoryEntry[]> {
    try {
      const history = await this.db`
        SELECT
          id,
          type,
          frequency,
          scheduled_for,
          sent_at,
          data
        FROM scheduled_notifications
        WHERE user_id = ${userId}
          ${type ? this.db`AND type = ${type}` : this.db``}
        ORDER BY scheduled_for DESC
        LIMIT ${limit}
      `;

      return (history as any[]).map((row) => ({
        id: row.id as string,
        type: row.type as string,
        frequency: row.frequency as string,
        scheduledFor: new Date(row.scheduled_for as string),
        sentAt: row.sent_at ? new Date(row.sent_at as string) : null,
        data: (row.data as Record<string, unknown>) || {},
      }));
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to get notification history:', error);
      throw error;
    }
  }

  /**
   * Get notification volume trends over time
   * @param userId User ID to get trends for
   * @param days Number of days to look back (default 30)
   * @returns Array of trend data points
   */
  async getTrendData(userId: string, days: number = 30): Promise<TrendDataPoint[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const trends = await this.db`
        SELECT
          DATE(scheduled_for)::text as date,
          type,
          COUNT(*) as count
        FROM scheduled_notifications
        WHERE user_id = ${userId}
          AND scheduled_for >= ${startDate}
        GROUP BY DATE(scheduled_for), type
        ORDER BY DATE(scheduled_for) DESC
      `;

      // Aggregate by date (sum all types)
      const trendMap: Record<string, number> = {};

      for (const row of trends) {
        const date = row.date as string;
        const count = Number(row.count);

        if (!trendMap[date]) {
          trendMap[date] = 0;
        }
        trendMap[date] += count;
      }

      // Convert to array and sort chronologically
      const result: TrendDataPoint[] = Object.entries(trendMap)
        .map(([date, count]) => ({
          date,
          count,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return result;
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to get trend data:', error);
      throw error;
    }
  }

  /**
   * Get notification preference statistics for a user
   * @param userId User ID to get preference stats for
   * @returns Preference statistics
   */
  async getPreferenceStats(userId: string): Promise<PreferenceStats> {
    try {
      const preferences = await this.db`
        SELECT
          type,
          frequency,
          enabled,
          max_per_day
        FROM notification_preferences
        WHERE user_id = ${userId}
      `;

      const enabledTypes: string[] = [];
      const disabledTypes: string[] = [];
      const frequencyStats: Record<string, any> = {
        immediate: { count: 0, enabledCount: 0, disabledCount: 0, totalMaxPerDay: 0 },
        daily: { count: 0, enabledCount: 0, disabledCount: 0, totalMaxPerDay: 0 },
        weekly: { count: 0, enabledCount: 0, disabledCount: 0, totalMaxPerDay: 0 },
        monthly: { count: 0, enabledCount: 0, disabledCount: 0, totalMaxPerDay: 0 },
      };

      let totalMaxPerDay = 0;
      let maxPerDayCount = 0;

      for (const pref of preferences as any[]) {
        const type = pref.type as string;
        const frequency = pref.frequency as string;
        const enabled = pref.enabled as boolean;
        const maxPerDay = Number(pref.max_per_day) || 5;

        if (enabled) {
          enabledTypes.push(type);
          frequencyStats[frequency].enabledCount += 1;
        } else {
          disabledTypes.push(type);
          frequencyStats[frequency].disabledCount += 1;
        }

        frequencyStats[frequency].count += 1;
        frequencyStats[frequency].totalMaxPerDay += maxPerDay;
        totalMaxPerDay += maxPerDay;
        maxPerDayCount += 1;
      }

      // Calculate averages for max_per_day
      const byFrequency: Record<string, any> = {};
      for (const [freq, stats] of Object.entries(frequencyStats)) {
        if ((stats as any).count > 0) {
          byFrequency[freq] = {
            count: (stats as any).count,
            enabledCount: (stats as any).enabledCount,
            disabledCount: (stats as any).disabledCount,
            avgMaxPerDay: Math.round((stats as any).totalMaxPerDay / (stats as any).count),
          };
        }
      }

      const preferredMaxPerDay =
        maxPerDayCount > 0 ? Math.round(totalMaxPerDay / maxPerDayCount) : 5;

      return {
        totalNotificationTypes: preferences.length,
        byFrequency,
        enabledTypes,
        disabledTypes,
        preferredMaxPerDay,
      };
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to get preference stats:', error);
      throw error;
    }
  }

  /**
   * Get trial notification statistics (from trial_notifications table)
   * @param userId User ID to get stats for
   * @returns Trial notification statistics
   */
  async getTrialNotificationStats(userId: string): Promise<Record<string, unknown>> {
    try {
      const stats = await this.db`
        SELECT
          notification_type,
          COUNT(*) as count,
          MAX(sent_at) as last_sent_at
        FROM trial_notifications
        WHERE user_id = ${userId}
        GROUP BY notification_type
      `;

      const result: Record<string, any> = {};

      for (const row of stats) {
        result[row.notification_type as string] = {
          count: Number(row.count),
          lastSentAt: row.last_sent_at ? new Date(row.last_sent_at as string) : null,
        };
      }

      return result;
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to get trial notification stats:', error);
      throw error;
    }
  }

  /**
   * Get plan downgrade notification statistics
   * @param userId User ID to get stats for
   * @returns Plan downgrade statistics
   */
  async getPlanDowngradeStats(userId: string): Promise<Record<string, unknown>> {
    try {
      const stats = await this.db`
        SELECT
          previous_plan,
          new_plan,
          COUNT(*) as count,
          MAX(downgraded_at) as last_downgrade
        FROM plan_downgrades
        WHERE user_id = ${userId}
        GROUP BY previous_plan, new_plan
      `;

      return {
        totalDowngrades: (stats as any[]).reduce((sum, s) => sum + Number(s.count), 0),
        byTransition: stats,
      };
    } catch (error) {
      console.error('[NotificationAnalytics] Failed to get plan downgrade stats:', error);
      throw error;
    }
  }

  /**
   * Format milliseconds to human-readable duration
   */
  private formatDuration(ms: number): string {
    const seconds = Math.round(ms / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
}
