import { getDb } from '../db/connection.js';
import { SubscriptionService, Plan } from './SubscriptionService.js';

/**
 * Resource types that can be metered
 */
export type ResourceType = 'api_calls' | 'storage_bytes' | 'session_minutes' | 'sftp_bytes';

/**
 * Metering event for recording usage
 */
export interface MeteringEvent {
  userId: string;
  eventType: 'api_call' | 'storage_bytes' | 'session_minutes' | 'sftp_bytes';
  resourceType: ResourceType;
  quantity: number; // 1 for API calls, bytes for storage, minutes for sessions
  unit: 'calls' | 'bytes' | 'minutes';
  metadata?: Record<string, any>;
}

/**
 * Current quota status for a resource
 */
export interface QuotaStatus {
  resourceType: ResourceType;
  currentUsage: number;
  hardLimit: number;
  softLimitWarning: number;
  softLimitCritical: number;
  usagePercent: number;
  exceeded: boolean;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Projected usage forecast for month-end
 */
export interface UsageForecast {
  resourceType: ResourceType;
  currentUsage: number;
  dailyAverage: number;
  projectedEndOfMonth: number;
  confidenceLow: number;
  confidenceHigh: number;
  currentDay: number;
  totalDays: number;
  usagePercent: number;
  exceedanceRisk: 'low' | 'medium' | 'high' | 'very_high';
}

/**
 * Quota alert notification
 */
export interface QuotaAlert {
  id: string;
  userId: string;
  resourceType: ResourceType;
  alertType: 'soft_warning' | 'critical' | 'hard_limit';
  thresholdPercent: number;
  currentUsage: number;
  limitValue: number;
  acknowledged: boolean;
  createdAt: Date;
}

export class UsageMeterService {
  private db = getDb();
  private subscriptionService = new SubscriptionService();

  /**
   * Record a metering event (e.g., API call, storage usage, session duration)
   */
  async recordUsageEvent(event: MeteringEvent): Promise<void> {
    try {
      await this.db`
        INSERT INTO usage_events (user_id, event_type, resource_type, quantity, unit, metadata)
        VALUES (${event.userId}, ${event.eventType}, ${event.resourceType}, ${event.quantity}, ${event.unit}, ${JSON.stringify(event.metadata || {})})
      `;
    } catch (error) {
      console.error('[UsageMeterService] Failed to record usage event:', error);
      throw error;
    }
  }

  /**
   * Record multiple metering events in a batch
   */
  async recordUsageEventsBatch(events: MeteringEvent[]): Promise<void> {
    try {
      await this.db.begin(async (sql) => {
        for (const event of events) {
          await sql`
            INSERT INTO usage_events (user_id, event_type, resource_type, quantity, unit, metadata)
            VALUES (${event.userId}, ${event.eventType}, ${event.resourceType}, ${event.quantity}, ${event.unit}, ${JSON.stringify(event.metadata || {})})
          `;
        }
      });
    } catch (error) {
      console.error('[UsageMeterService] Failed to record batch usage events:', error);
      throw error;
    }
  }

  /**
   * Get current month period start and end dates
   */
  private getMonthPeriod(date: Date = new Date()): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }

  /**
   * Get current usage for a resource in the monthly billing period
   */
  async getCurrentUsage(userId: string, resourceType: ResourceType): Promise<number> {
    try {
      const period = this.getMonthPeriod();

      const result = await this.db`
        SELECT COALESCE(SUM(quantity), 0) as total_usage
        FROM usage_events
        WHERE user_id = ${userId}
          AND resource_type = ${resourceType}
          AND created_at >= ${period.start}
          AND created_at < ${period.end}
      `;

      return parseInt(result[0]?.total_usage || '0', 10);
    } catch (error) {
      console.error('[UsageMeterService] Failed to get current usage:', error);
      throw error;
    }
  }

  /**
   * Get quota status for a resource (includes usage, limits, and alert status)
   */
  async getQuotaStatus(userId: string, resourceType: ResourceType): Promise<QuotaStatus> {
    try {
      const subscription = await this.subscriptionService.getSubscription(userId);
      const plan: Plan = subscription?.plan || 'free';

      // Get quota limits for this plan
      const quotaRows = await this.db`
        SELECT hard_limit, soft_limit_warning, soft_limit_critical
        FROM resource_quotas
        WHERE plan = ${plan}
          AND resource_type = ${resourceType}
          AND period = 'monthly'
        LIMIT 1
      `;

      if (quotaRows.length === 0) {
        throw new Error(`No quota defined for plan=${plan}, resource=${resourceType}`);
      }

      const quota = quotaRows[0];
      const currentUsage = await this.getCurrentUsage(userId, resourceType);
      const usagePercent = (currentUsage / quota.hard_limit) * 100;

      // Determine status
      let status: 'ok' | 'warning' | 'critical' | 'exceeded' = 'ok';
      if (currentUsage > quota.hard_limit) {
        status = 'exceeded';
      } else if (currentUsage >= quota.soft_limit_critical) {
        status = 'critical';
      } else if (currentUsage >= quota.soft_limit_warning) {
        status = 'warning';
      }

      const period = this.getMonthPeriod();

      return {
        resourceType,
        currentUsage,
        hardLimit: quota.hard_limit,
        softLimitWarning: quota.soft_limit_warning,
        softLimitCritical: quota.soft_limit_critical,
        usagePercent: Math.round(usagePercent * 100) / 100,
        exceeded: currentUsage > quota.hard_limit,
        status,
        periodStart: period.start,
        periodEnd: period.end,
      };
    } catch (error) {
      console.error('[UsageMeterService] Failed to get quota status:', error);
      throw error;
    }
  }

  /**
   * Check if user has exceeded hard limit for a resource
   */
  async isQuotaExceeded(userId: string, resourceType: ResourceType): Promise<boolean> {
    try {
      const status = await this.getQuotaStatus(userId, resourceType);
      return status.exceeded;
    } catch (error) {
      console.error('[UsageMeterService] Failed to check quota exceeded:', error);
      throw error;
    }
  }

  /**
   * Get quota status for all metered resources
   */
  async getAllQuotaStatuses(userId: string): Promise<QuotaStatus[]> {
    try {
      const resourceTypes: ResourceType[] = [
        'api_calls',
        'storage_bytes',
        'session_minutes',
        'sftp_bytes',
      ];

      const statuses = await Promise.all(
        resourceTypes.map((rt) => this.getQuotaStatus(userId, rt))
      );

      return statuses;
    } catch (error) {
      console.error('[UsageMeterService] Failed to get all quota statuses:', error);
      throw error;
    }
  }

  /**
   * Generate usage forecast for end of month
   */
  async generateUsageForecast(userId: string, resourceType: ResourceType): Promise<UsageForecast> {
    try {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      // Get current usage
      const currentUsage = await this.getCurrentUsage(userId, resourceType);

      // Calculate days elapsed and remaining
      const daysElapsed = Math.floor(
        (today.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1; // +1 to include current day
      const totalDays = monthEnd.getDate();
      const daysRemaining = totalDays - daysElapsed + 1;

      // Calculate daily average
      const dailyAverage = currentUsage / daysElapsed;

      // Project end-of-month usage
      const projectedEndOfMonth = Math.ceil(dailyAverage * totalDays);

      // Calculate confidence interval (68% = 1 standard deviation)
      // Using simple linear projection with 15% variance
      const variance = projectedEndOfMonth * 0.15;
      const confidenceLow = Math.max(currentUsage, projectedEndOfMonth - variance);
      const confidenceHigh = projectedEndOfMonth + variance;

      // Get quota limit
      const status = await this.getQuotaStatus(userId, resourceType);
      const usagePercent = (projectedEndOfMonth / status.hardLimit) * 100;

      // Determine exceedance risk
      let exceedanceRisk: 'low' | 'medium' | 'high' | 'very_high' = 'low';
      if (projectedEndOfMonth > status.hardLimit) {
        exceedanceRisk = 'very_high';
      } else if (confidenceHigh > status.hardLimit) {
        exceedanceRisk = 'high';
      } else if (usagePercent > 75) {
        exceedanceRisk = 'medium';
      }

      // Store forecast
      await this.db`
        INSERT INTO usage_forecasts (
          user_id, resource_type, forecast_date, month_start,
          projected_end_of_month_usage, confidence_low, confidence_high,
          daily_average, current_usage, days_elapsed, days_remaining
        )
        VALUES (
          ${userId}, ${resourceType}, ${today.toISOString().split('T')[0]}, ${monthStart.toISOString().split('T')[0]},
          ${projectedEndOfMonth}, ${confidenceLow}, ${confidenceHigh},
          ${dailyAverage}, ${currentUsage}, ${daysElapsed}, ${daysRemaining}
        )
        ON CONFLICT (user_id, resource_type, forecast_date) DO UPDATE
        SET projected_end_of_month_usage = EXCLUDED.projected_end_of_month_usage,
            confidence_low = EXCLUDED.confidence_low,
            confidence_high = EXCLUDED.confidence_high,
            daily_average = EXCLUDED.daily_average,
            current_usage = EXCLUDED.current_usage,
            updated_at = NOW()
      `;

      return {
        resourceType,
        currentUsage,
        dailyAverage: Math.round(dailyAverage * 100) / 100,
        projectedEndOfMonth,
        confidenceLow: Math.ceil(confidenceLow),
        confidenceHigh: Math.ceil(confidenceHigh),
        currentDay: daysElapsed,
        totalDays,
        usagePercent: Math.round(usagePercent * 100) / 100,
        exceedanceRisk,
      };
    } catch (error) {
      console.error('[UsageMeterService] Failed to generate usage forecast:', error);
      throw error;
    }
  }

  /**
   * Get all forecasts for a user
   */
  async getAllForecasts(userId: string): Promise<UsageForecast[]> {
    try {
      const resourceTypes: ResourceType[] = [
        'api_calls',
        'storage_bytes',
        'session_minutes',
        'sftp_bytes',
      ];

      const forecasts = await Promise.all(
        resourceTypes.map((rt) => this.generateUsageForecast(userId, rt))
      );

      return forecasts;
    } catch (error) {
      console.error('[UsageMeterService] Failed to get all forecasts:', error);
      throw error;
    }
  }

  /**
   * Record a quota alert when threshold is exceeded
   */
  async recordQuotaAlert(
    userId: string,
    resourceType: ResourceType,
    alertType: 'soft_warning' | 'critical' | 'hard_limit',
    currentUsage: number,
    limitValue: number
  ): Promise<QuotaAlert> {
    try {
      const thresholdPercent = alertType === 'soft_warning' ? 80 : alertType === 'critical' ? 95 : 100;

      const result = await this.db`
        INSERT INTO quota_alerts (user_id, resource_type, alert_type, threshold_percent, current_usage, limit_value, period)
        VALUES (${userId}, ${resourceType}, ${alertType}, ${thresholdPercent}, ${currentUsage}, ${limitValue}, 'monthly')
        RETURNING id, created_at
      `;

      return {
        id: result[0].id,
        userId,
        resourceType,
        alertType,
        thresholdPercent,
        currentUsage,
        limitValue,
        acknowledged: false,
        createdAt: result[0].created_at,
      };
    } catch (error) {
      console.error('[UsageMeterService] Failed to record quota alert:', error);
      throw error;
    }
  }

  /**
   * Get recent unacknowledged alerts for a user
   */
  async getUnacknowledgedAlerts(userId: string): Promise<QuotaAlert[]> {
    try {
      const alerts = await this.db`
        SELECT id, user_id, resource_type, alert_type, threshold_percent, current_usage, limit_value, acknowledged, created_at
        FROM quota_alerts
        WHERE user_id = ${userId} AND acknowledged = FALSE
        ORDER BY created_at DESC
        LIMIT 10
      `;

      return alerts.map((a) => ({
        id: a.id,
        userId: a.user_id,
        resourceType: a.resource_type as ResourceType,
        alertType: a.alert_type as 'soft_warning' | 'critical' | 'hard_limit',
        thresholdPercent: a.threshold_percent,
        currentUsage: a.current_usage,
        limitValue: a.limit_value,
        acknowledged: a.acknowledged,
        createdAt: a.created_at,
      }));
    } catch (error) {
      console.error('[UsageMeterService] Failed to get unacknowledged alerts:', error);
      throw error;
    }
  }

  /**
   * Acknowledge a quota alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      await this.db`
        UPDATE quota_alerts
        SET acknowledged = TRUE, acknowledged_at = NOW()
        WHERE id = ${alertId} AND user_id = ${userId}
      `;
    } catch (error) {
      console.error('[UsageMeterService] Failed to acknowledge alert:', error);
      throw error;
    }
  }

  /**
   * Get hourly aggregate usage for a resource
   */
  async getHourlyUsage(userId: string, resourceType: ResourceType, hoursBack: number = 24): Promise<Array<{ hourStart: Date; usage: number }>> {
    try {
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const results = await this.db`
        SELECT DATE_TRUNC('hour', created_at) as hour_start, SUM(quantity) as total_usage
        FROM usage_events
        WHERE user_id = ${userId}
          AND resource_type = ${resourceType}
          AND created_at > ${cutoffTime}
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY hour_start DESC
      `;

      return results.map((r) => ({
        hourStart: new Date(r.hour_start),
        usage: parseInt(r.total_usage || '0', 10),
      }));
    } catch (error) {
      console.error('[UsageMeterService] Failed to get hourly usage:', error);
      throw error;
    }
  }

  /**
   * Get daily aggregate usage for a resource
   */
  async getDailyUsage(userId: string, resourceType: ResourceType, daysBack: number = 30): Promise<Array<{ dayStart: Date; usage: number }>> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - daysBack);

      const results = await this.db`
        SELECT DATE_TRUNC('day', created_at) as day_start, SUM(quantity) as total_usage
        FROM usage_events
        WHERE user_id = ${userId}
          AND resource_type = ${resourceType}
          AND created_at > ${cutoffTime}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY day_start DESC
      `;

      return results.map((r) => ({
        dayStart: new Date(r.day_start),
        usage: parseInt(r.total_usage || '0', 10),
      }));
    } catch (error) {
      console.error('[UsageMeterService] Failed to get daily usage:', error);
      throw error;
    }
  }

  /**
   * Get usage for a specific day
   */
  async getUsageForDay(userId: string, resourceType: ResourceType, date: Date): Promise<number> {
    try {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      const result = await this.db`
        SELECT COALESCE(SUM(quantity), 0) as total_usage
        FROM usage_events
        WHERE user_id = ${userId}
          AND resource_type = ${resourceType}
          AND created_at >= ${dayStart}
          AND created_at < ${dayEnd}
      `;

      return parseInt(result[0]?.total_usage || '0', 10);
    } catch (error) {
      console.error('[UsageMeterService] Failed to get usage for day:', error);
      throw error;
    }
  }
}
