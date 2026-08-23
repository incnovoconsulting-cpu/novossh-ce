import { getDb } from '../db/connection.js';
import { UsageMeterService, ResourceType } from './UsageMeterService.js';

/**
 * Aggregates raw usage events into hourly, daily, and monthly summaries
 * Runs periodically to optimize quota checking performance
 */
export class UsageAggregationService {
  private db = getDb();
  private meterService = new UsageMeterService();

  /**
   * Aggregate hourly usage from raw events
   * Should run every hour
   */
  async aggregateHourly(): Promise<{ recordsProcessed: number; recordsInserted: number }> {
    try {
      // Get the previous hour's boundaries
      const now = new Date();
      const hourStart = new Date(now);
      hourStart.setMinutes(0, 0, 0);
      hourStart.setHours(hourStart.getHours() - 1);

      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourEnd.getHours() + 1);

      // Get distinct user+resource combinations with activity
      const activeResources = await this.db`
        SELECT DISTINCT user_id, resource_type
        FROM usage_events
        WHERE created_at >= ${hourStart} AND created_at < ${hourEnd}
      `;

      let recordsInserted = 0;

      for (const { user_id: userId, resource_type: resourceType } of activeResources) {
        // Sum usage for this hour
        const usage = await this.db`
          SELECT
            COALESCE(SUM(quantity), 0) as total_usage,
            COUNT(*) as event_count
          FROM usage_events
          WHERE user_id = ${userId}
            AND resource_type = ${resourceType}
            AND created_at >= ${hourStart}
            AND created_at < ${hourEnd}
        `;

        const totalUsage = parseInt(usage[0]?.total_usage || '0', 10);
        const eventCount = parseInt(usage[0]?.event_count || '0', 10);

        if (totalUsage > 0 || eventCount > 0) {
          // Upsert into hourly aggregates
          await this.db`
            INSERT INTO usage_aggregates_hourly (user_id, resource_type, hour_start, total_usage, event_count)
            VALUES (${userId}, ${resourceType}, ${hourStart}, ${totalUsage}, ${eventCount})
            ON CONFLICT (user_id, resource_type, hour_start) DO UPDATE
            SET total_usage = EXCLUDED.total_usage, event_count = EXCLUDED.event_count, updated_at = NOW()
          `;

          recordsInserted++;
        }
      }

      return {
        recordsProcessed: activeResources.length,
        recordsInserted,
      };
    } catch (error) {
      console.error('[UsageAggregationService] Hourly aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Aggregate daily usage from raw events
   * Should run once daily (e.g., at 1 AM UTC)
   */
  async aggregateDaily(): Promise<{ recordsProcessed: number; recordsInserted: number }> {
    try {
      // Get yesterday's date
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const dayStart = yesterday;
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      // Get distinct user+resource combinations with activity
      const activeResources = await this.db`
        SELECT DISTINCT user_id, resource_type
        FROM usage_events
        WHERE created_at >= ${dayStart} AND created_at < ${dayEnd}
      `;

      let recordsInserted = 0;

      for (const { user_id: userId, resource_type: resourceType } of activeResources) {
        // Sum usage for this day
        const usage = await this.db`
          SELECT
            COALESCE(SUM(quantity), 0) as total_usage,
            COUNT(*) as event_count
          FROM usage_events
          WHERE user_id = ${userId}
            AND resource_type = ${resourceType}
            AND created_at >= ${dayStart}
            AND created_at < ${dayEnd}
        `;

        const totalUsage = parseInt(usage[0]?.total_usage || '0', 10);
        const eventCount = parseInt(usage[0]?.event_count || '0', 10);

        if (totalUsage > 0 || eventCount > 0) {
          // Upsert into daily aggregates
          await this.db`
            INSERT INTO usage_aggregates_daily (user_id, resource_type, day_start, total_usage, event_count)
            VALUES (${userId}, ${resourceType}, ${dayStart.toISOString().split('T')[0]}, ${totalUsage}, ${eventCount})
            ON CONFLICT (user_id, resource_type, day_start) DO UPDATE
            SET total_usage = EXCLUDED.total_usage, event_count = EXCLUDED.event_count, updated_at = NOW()
          `;

          recordsInserted++;
        }
      }

      return {
        recordsProcessed: activeResources.length,
        recordsInserted,
      };
    } catch (error) {
      console.error('[UsageAggregationService] Daily aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Aggregate monthly usage from raw events
   * Should run once monthly (e.g., at 2 AM UTC on the 1st)
   */
  async aggregateMonthly(): Promise<{ recordsProcessed: number; recordsInserted: number }> {
    try {
      // Get last month's date
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const monthStart = lastMonth;
      const nextMonthStart = new Date(monthStart);
      nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

      // Get distinct user+resource combinations with activity
      const activeResources = await this.db`
        SELECT DISTINCT user_id, resource_type
        FROM usage_events
        WHERE created_at >= ${monthStart} AND created_at < ${nextMonthStart}
      `;

      let recordsInserted = 0;

      for (const { user_id: userId, resource_type: resourceType } of activeResources) {
        // Sum usage for this month
        const usage = await this.db`
          SELECT
            COALESCE(SUM(quantity), 0) as total_usage,
            COUNT(*) as event_count
          FROM usage_events
          WHERE user_id = ${userId}
            AND resource_type = ${resourceType}
            AND created_at >= ${monthStart}
            AND created_at < ${nextMonthStart}
        `;

        const totalUsage = parseInt(usage[0]?.total_usage || '0', 10);
        const eventCount = parseInt(usage[0]?.event_count || '0', 10);

        if (totalUsage > 0 || eventCount > 0) {
          // Upsert into monthly aggregates
          await this.db`
            INSERT INTO usage_aggregates_monthly (user_id, resource_type, month_start, total_usage, event_count)
            VALUES (${userId}, ${resourceType}, ${monthStart.toISOString().split('T')[0]}, ${totalUsage}, ${eventCount})
            ON CONFLICT (user_id, resource_type, month_start) DO UPDATE
            SET total_usage = EXCLUDED.total_usage, event_count = EXCLUDED.event_count, updated_at = NOW()
          `;

          recordsInserted++;
        }
      }

      return {
        recordsProcessed: activeResources.length,
        recordsInserted,
      };
    } catch (error) {
      console.error('[UsageAggregationService] Monthly aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Check all user quotas and generate alerts if thresholds exceeded
   * Should run every 15-30 minutes
   */
  async checkAllQuotas(): Promise<{ alertsGenerated: number; usersChecked: number }> {
    try {
      // Get all active users
      const users = await this.db`
        SELECT DISTINCT user_id FROM usage_events
        WHERE created_at > NOW() - INTERVAL '1 day'
      `;

      let alertsGenerated = 0;
      const resourceTypes: ResourceType[] = ['api_calls', 'storage_bytes', 'session_minutes', 'sftp_bytes'];

      for (const { user_id: userId } of users) {
        for (const resourceType of resourceTypes) {
          try {
            const status = await this.meterService.getQuotaStatus(userId, resourceType);

            // Check if we need to generate an alert
            if (status.exceeded && status.usagePercent >= 100) {
              // Check if hard limit alert already exists for today
              const existingHardLimit = await this.db`
                SELECT id FROM quota_alerts
                WHERE user_id = ${userId}
                  AND resource_type = ${resourceType}
                  AND alert_type = 'hard_limit'
                  AND DATE(created_at) = CURRENT_DATE
                LIMIT 1
              `;

              if (existingHardLimit.length === 0) {
                await this.meterService.recordQuotaAlert(
                  userId,
                  resourceType,
                  'hard_limit',
                  status.currentUsage,
                  status.hardLimit
                );
                alertsGenerated++;
              }
            } else if (status.status === 'critical' && status.usagePercent >= 95) {
              // Check if critical alert already exists for today
              const existingCritical = await this.db`
                SELECT id FROM quota_alerts
                WHERE user_id = ${userId}
                  AND resource_type = ${resourceType}
                  AND alert_type = 'critical'
                  AND DATE(created_at) = CURRENT_DATE
                LIMIT 1
              `;

              if (existingCritical.length === 0) {
                await this.meterService.recordQuotaAlert(
                  userId,
                  resourceType,
                  'critical',
                  status.currentUsage,
                  status.hardLimit
                );
                alertsGenerated++;
              }
            } else if (status.status === 'warning' && status.usagePercent >= 80) {
              // Check if warning alert already exists for today
              const existingWarning = await this.db`
                SELECT id FROM quota_alerts
                WHERE user_id = ${userId}
                  AND resource_type = ${resourceType}
                  AND alert_type = 'soft_warning'
                  AND DATE(created_at) = CURRENT_DATE
                LIMIT 1
              `;

              if (existingWarning.length === 0) {
                await this.meterService.recordQuotaAlert(
                  userId,
                  resourceType,
                  'soft_warning',
                  status.currentUsage,
                  status.hardLimit
                );
                alertsGenerated++;
              }
            }
          } catch (error) {
            console.error(`[UsageAggregationService] Failed to check quota for user ${userId}, resource ${resourceType}:`, error);
          }
        }
      }

      return {
        alertsGenerated,
        usersChecked: users.length,
      };
    } catch (error) {
      console.error('[UsageAggregationService] Quota check job failed:', error);
      throw error;
    }
  }

  /**
   * Clean up old usage events (older than 90 days) to save storage
   * Should run once weekly
   */
  async cleanupOldEvents(daysToKeep: number = 90): Promise<{ recordsDeleted: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.db`
        DELETE FROM usage_events
        WHERE created_at < ${cutoffDate}
        RETURNING id
      `;

      return {
        recordsDeleted: result.length,
      };
    } catch (error) {
      console.error('[UsageAggregationService] Cleanup job failed:', error);
      throw error;
    }
  }

  /**
   * Generate forecasts for all users
   * Should run once daily
   */
  async generateAllForecasts(): Promise<{ forecastsGenerated: number; usersProcessed: number }> {
    try {
      // Get all active users
      const users = await this.db`
        SELECT DISTINCT user_id FROM usage_events
        WHERE created_at > NOW() - INTERVAL '30 days'
      `;

      let forecastsGenerated = 0;
      const resourceTypes: ResourceType[] = ['api_calls', 'storage_bytes', 'session_minutes', 'sftp_bytes'];

      for (const { user_id: userId } of users) {
        for (const resourceType of resourceTypes) {
          try {
            await this.meterService.generateUsageForecast(userId, resourceType);
            forecastsGenerated++;
          } catch (error) {
            console.error(`[UsageAggregationService] Failed to generate forecast for user ${userId}, resource ${resourceType}:`, error);
          }
        }
      }

      return {
        forecastsGenerated,
        usersProcessed: users.length,
      };
    } catch (error) {
      console.error('[UsageAggregationService] Forecast generation job failed:', error);
      throw error;
    }
  }

  /**
   * Get aggregation job status and next scheduled runs
   */
  async getJobStatus(): Promise<{
    hourlyAggregation: { lastRun?: Date; nextRun: Date };
    dailyAggregation: { lastRun?: Date; nextRun: Date };
    monthlyAggregation: { lastRun?: Date; nextRun: Date };
    quotaChecks: { lastRun?: Date; nextRun: Date };
    forecastGeneration: { lastRun?: Date; nextRun: Date };
  }> {
    const now = new Date();

    // Calculate next run times
    const nextHourly = new Date(now);
    nextHourly.setMinutes(5, 0, 0);
    if (nextHourly <= now) {
      nextHourly.setHours(nextHourly.getHours() + 1);
    }

    const nextDaily = new Date(now);
    nextDaily.setHours(1, 0, 0, 0);
    if (nextDaily <= now) {
      nextDaily.setDate(nextDaily.getDate() + 1);
    }

    const nextMonthly = new Date(now);
    nextMonthly.setDate(1);
    nextMonthly.setHours(2, 0, 0, 0);
    if (nextMonthly <= now) {
      nextMonthly.setMonth(nextMonthly.getMonth() + 1);
    }

    const nextQuotaCheck = new Date(now);
    nextQuotaCheck.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
    if (nextQuotaCheck <= now) {
      nextQuotaCheck.setMinutes(nextQuotaCheck.getMinutes() + 15);
    }

    const nextForecast = new Date(now);
    nextForecast.setHours(0, 30, 0, 0);
    if (nextForecast <= now) {
      nextForecast.setDate(nextForecast.getDate() + 1);
    }

    return {
      hourlyAggregation: { nextRun: nextHourly },
      dailyAggregation: { nextRun: nextDaily },
      monthlyAggregation: { nextRun: nextMonthly },
      quotaChecks: { nextRun: nextQuotaCheck },
      forecastGeneration: { nextRun: nextForecast },
    };
  }
}
