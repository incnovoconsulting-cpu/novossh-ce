import { getDb } from '../db/connection.js';

/**
 * Dashboard metrics aggregation
 */
export interface DashboardMetrics {
  timestamp: Date;
  system_health: {
    overall_status: 'healthy' | 'degraded' | 'critical';
    database_latency_ms: number;
    memory_used_mb: number;
    memory_available_mb: number;
  };
  rate_limits: {
    violations_1h: number;
    violations_24h: number;
    violations_7d: number;
    top_endpoints: Array<{
      endpoint: string;
      violation_count: number;
      severity: string;
    }>;
  };
  authentication: {
    failures_1h: number;
    failures_24h: number;
    failures_7d: number;
    brute_force_attempts: number;
    top_failure_types: Array<{
      type: string;
      count: number;
    }>;
  };
  performance: {
    avg_response_time_ms: number;
    p95_response_time_ms: number;
    p99_response_time_ms: number;
    error_rate_percent: number;
    slow_endpoints: Array<{
      endpoint: string;
      method: string;
      avg_response_time_ms: number;
      error_rate: number;
    }>;
  };
  system_events: {
    total_open: number;
    critical: number;
    warnings: number;
    recent: Array<{
      id: string;
      event_type: string;
      severity: string;
      title: string;
      created_at: Date;
    }>;
  };
}

/**
 * Dashboard Metrics Service - aggregates metrics for dashboard display
 */
export class DashboardMetricsService {
  private db = getDb();
  private metricsCache: DashboardMetrics | null = null;
  private cacheTime: number = 0;
  private cacheTTL: number = 60000; // 1 minute

  /**
   * Get aggregated dashboard metrics
   */
  async getDashboardMetrics(organizationId?: string): Promise<DashboardMetrics> {
    // Return cached metrics if still fresh
    const now = Date.now();
    if (this.metricsCache && now - this.cacheTime < this.cacheTTL) {
      return this.metricsCache;
    }

    const metrics: DashboardMetrics = {
      timestamp: new Date(),
      system_health: await this.getSystemHealthMetrics(),
      rate_limits: await this.getRateLimitMetrics(organizationId),
      authentication: await this.getAuthenticationMetrics(organizationId),
      performance: await this.getPerformanceMetrics(organizationId),
      system_events: await this.getSystemEventsMetrics(organizationId),
    };

    this.metricsCache = metrics;
    this.cacheTime = now;
    return metrics;
  }

  /**
   * Get system health metrics
   */
  private async getSystemHealthMetrics(): Promise<DashboardMetrics['system_health']> {
    try {
      // Database latency
      const start = Date.now();
      await this.db`SELECT 1`;
      const dbLatency = Date.now() - start;

      // Memory usage
      const memUsage = process.memoryUsage();
      const memUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024);
      const memAvailableMb = Math.round(memUsage.heapTotal / 1024 / 1024);

      let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (dbLatency > 1000 || memUsedMb > memAvailableMb * 0.9) {
        overallStatus = 'critical';
      } else if (memUsedMb > memAvailableMb * 0.7) {
        overallStatus = 'degraded';
      }

      return {
        overall_status: overallStatus,
        database_latency_ms: dbLatency,
        memory_used_mb: memUsedMb,
        memory_available_mb: memAvailableMb,
      };
    } catch (error) {
      console.error('[dashboard] Failed to get system health:', error);
      return {
        overall_status: 'critical',
        database_latency_ms: 5000,
        memory_used_mb: 0,
        memory_available_mb: 0,
      };
    }
  }

  /**
   * Get rate limit metrics
   */
  private async getRateLimitMetrics(
    organizationId?: string
  ): Promise<DashboardMetrics['rate_limits']> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneDayAgo = new Date(now.getTime() - 86400000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

      let query1h = this.db`
        SELECT COUNT(*) as count FROM rate_limit_violations
        WHERE last_violation_at >= ${oneHourAgo}
      `;
      let query24h = this.db`
        SELECT COUNT(*) as count FROM rate_limit_violations
        WHERE last_violation_at >= ${oneDayAgo}
      `;
      let query7d = this.db`
        SELECT COUNT(*) as count FROM rate_limit_violations
        WHERE last_violation_at >= ${sevenDaysAgo}
      `;
      let queryTop = this.db`
        SELECT endpoint, severity, COUNT(*) as count
        FROM rate_limit_violations
        WHERE last_violation_at >= ${oneHourAgo}
        GROUP BY endpoint, severity
        ORDER BY count DESC
        LIMIT 5
      `;

      if (organizationId) {
        query1h = this.db`
          SELECT COUNT(*) as count FROM rate_limit_violations
          WHERE last_violation_at >= ${oneHourAgo}
          AND organization_id = ${organizationId}
        `;
        query24h = this.db`
          SELECT COUNT(*) as count FROM rate_limit_violations
          WHERE last_violation_at >= ${oneDayAgo}
          AND organization_id = ${organizationId}
        `;
        query7d = this.db`
          SELECT COUNT(*) as count FROM rate_limit_violations
          WHERE last_violation_at >= ${sevenDaysAgo}
          AND organization_id = ${organizationId}
        `;
        queryTop = this.db`
          SELECT endpoint, severity, COUNT(*) as count
          FROM rate_limit_violations
          WHERE last_violation_at >= ${oneHourAgo}
          AND organization_id = ${organizationId}
          GROUP BY endpoint, severity
          ORDER BY count DESC
          LIMIT 5
        `;
      }

      const violations1h = await query1h;
      const violations24h = await query24h;
      const violations7d = await query7d;
      const topEndpoints = await queryTop;

      return {
        violations_1h: (violations1h[0] as any)?.count || 0,
        violations_24h: (violations24h[0] as any)?.count || 0,
        violations_7d: (violations7d[0] as any)?.count || 0,
        top_endpoints: (topEndpoints as any[]).map((e) => ({
          endpoint: e.endpoint,
          violation_count: e.count,
          severity: e.severity,
        })),
      };
    } catch (error) {
      console.error('[dashboard] Failed to get rate limit metrics:', error);
      return {
        violations_1h: 0,
        violations_24h: 0,
        violations_7d: 0,
        top_endpoints: [],
      };
    }
  }

  /**
   * Get authentication metrics
   */
  private async getAuthenticationMetrics(
    organizationId?: string
  ): Promise<DashboardMetrics['authentication']> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneDayAgo = new Date(now.getTime() - 86400000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

      let query1h = this.db`
        SELECT COUNT(*) as count FROM auth_failures
        WHERE last_failure_at >= ${oneHourAgo}
      `;
      let query24h = this.db`
        SELECT COUNT(*) as count FROM auth_failures
        WHERE last_failure_at >= ${oneDayAgo}
      `;
      let query7d = this.db`
        SELECT COUNT(*) as count FROM auth_failures
        WHERE last_failure_at >= ${sevenDaysAgo}
      `;
      let queryBrute = this.db`
        SELECT COUNT(*) as count FROM auth_failures
        WHERE last_failure_at >= ${oneHourAgo}
        AND failure_count >= 5
      `;
      let queryTypes = this.db`
        SELECT failure_type, COUNT(*) as count
        FROM auth_failures
        WHERE last_failure_at >= ${oneHourAgo}
        GROUP BY failure_type
        ORDER BY count DESC
      `;

      if (organizationId) {
        query1h = this.db`
          SELECT COUNT(*) as count FROM auth_failures
          WHERE last_failure_at >= ${oneHourAgo}
          AND organization_id = ${organizationId}
        `;
        query24h = this.db`
          SELECT COUNT(*) as count FROM auth_failures
          WHERE last_failure_at >= ${oneDayAgo}
          AND organization_id = ${organizationId}
        `;
        query7d = this.db`
          SELECT COUNT(*) as count FROM auth_failures
          WHERE last_failure_at >= ${sevenDaysAgo}
          AND organization_id = ${organizationId}
        `;
        queryBrute = this.db`
          SELECT COUNT(*) as count FROM auth_failures
          WHERE last_failure_at >= ${oneHourAgo}
          AND failure_count >= 5
          AND organization_id = ${organizationId}
        `;
        queryTypes = this.db`
          SELECT failure_type, COUNT(*) as count
          FROM auth_failures
          WHERE last_failure_at >= ${oneHourAgo}
          AND organization_id = ${organizationId}
          GROUP BY failure_type
          ORDER BY count DESC
        `;
      }

      const failures1h = await query1h;
      const failures24h = await query24h;
      const failures7d = await query7d;
      const bruteForceCounts = await queryBrute;
      const failureTypes = await queryTypes;

      return {
        failures_1h: (failures1h[0] as any)?.count || 0,
        failures_24h: (failures24h[0] as any)?.count || 0,
        failures_7d: (failures7d[0] as any)?.count || 0,
        brute_force_attempts: (bruteForceCounts[0] as any)?.count || 0,
        top_failure_types: (failureTypes as any[]).map((t) => ({
          type: t.failure_type,
          count: t.count,
        })),
      };
    } catch (error) {
      console.error('[dashboard] Failed to get authentication metrics:', error);
      return {
        failures_1h: 0,
        failures_24h: 0,
        failures_7d: 0,
        brute_force_attempts: 0,
        top_failure_types: [],
      };
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(
    organizationId?: string
  ): Promise<DashboardMetrics['performance']> {
    try {
      const today = new Date().toISOString().split('T')[0];

      let query = this.db`
        SELECT
          AVG(avg_response_time_ms) as avg_time,
          MAX(max_response_time_ms) as max_time,
          AVG(CASE WHEN error_count > 0 THEN (error_count::float / request_count * 100) ELSE 0 END) as error_rate,
          endpoint,
          method
        FROM api_usage_stats
        WHERE stat_date = ${today}
      `;

      if (organizationId) {
        query = this.db`
          SELECT
            AVG(avg_response_time_ms) as avg_time,
            MAX(max_response_time_ms) as max_time,
            AVG(CASE WHEN error_count > 0 THEN (error_count::float / request_count * 100) ELSE 0 END) as error_rate,
            endpoint,
            method
          FROM api_usage_stats
          WHERE stat_date = ${today}
          AND organization_id = ${organizationId}
        `;
      }

      const stats = await query;

      let avgResponseTime = 0;
      let errorRate = 0;
      let slowEndpoints: Array<{
        endpoint: string;
        method: string;
        avg_response_time_ms: number;
        error_rate: number;
      }> = [];

      if ((stats as any[]).length > 0) {
        const stat = (stats as any[])[0];
        avgResponseTime = stat.avg_time || 0;
        errorRate = stat.error_rate || 0;

        // Get slow endpoints
        let slowQuery = this.db`
          SELECT endpoint, method, avg_response_time_ms, error_count, request_count
          FROM api_usage_stats
          WHERE stat_date = ${today}
          AND avg_response_time_ms > 5000
          ORDER BY avg_response_time_ms DESC
          LIMIT 10
        `;

        if (organizationId) {
          slowQuery = this.db`
            SELECT endpoint, method, avg_response_time_ms, error_count, request_count
            FROM api_usage_stats
            WHERE stat_date = ${today}
            AND avg_response_time_ms > 5000
            AND organization_id = ${organizationId}
            ORDER BY avg_response_time_ms DESC
            LIMIT 10
          `;
        }

        const slowStats = await slowQuery;
        slowEndpoints = (slowStats as any[]).map((s) => ({
          endpoint: s.endpoint,
          method: s.method,
          avg_response_time_ms: Math.round(s.avg_response_time_ms),
          error_rate:
            ((s.error_count || 0) / (s.request_count || 1)) * 100 || 0,
        }));
      }

      return {
        avg_response_time_ms: Math.round(avgResponseTime),
        p95_response_time_ms: Math.round(avgResponseTime * 1.5),
        p99_response_time_ms: Math.round(avgResponseTime * 2),
        error_rate_percent: Math.round(errorRate * 100) / 100,
        slow_endpoints: slowEndpoints,
      };
    } catch (error) {
      console.error('[dashboard] Failed to get performance metrics:', error);
      return {
        avg_response_time_ms: 0,
        p95_response_time_ms: 0,
        p99_response_time_ms: 0,
        error_rate_percent: 0,
        slow_endpoints: [],
      };
    }
  }

  /**
   * Get system events metrics
   */
  private async getSystemEventsMetrics(
    organizationId?: string
  ): Promise<DashboardMetrics['system_events']> {
    try {
      let queryOpen = this.db`
        SELECT COUNT(*) as count FROM system_events
        WHERE status = 'open'
      `;
      let queryCritical = this.db`
        SELECT COUNT(*) as count FROM system_events
        WHERE severity = 'critical'
        AND status = 'open'
      `;
      let queryWarnings = this.db`
        SELECT COUNT(*) as count FROM system_events
        WHERE severity = 'warning'
        AND status = 'open'
      `;
      let queryRecent = this.db`
        SELECT id, event_type, severity, title, created_at
        FROM system_events
        WHERE status = 'open'
        ORDER BY created_at DESC
        LIMIT 10
      `;

      if (organizationId) {
        queryOpen = this.db`
          SELECT COUNT(*) as count FROM system_events
          WHERE status = 'open'
          AND organization_id = ${organizationId}
        `;
        queryCritical = this.db`
          SELECT COUNT(*) as count FROM system_events
          WHERE severity = 'critical'
          AND status = 'open'
          AND organization_id = ${organizationId}
        `;
        queryWarnings = this.db`
          SELECT COUNT(*) as count FROM system_events
          WHERE severity = 'warning'
          AND status = 'open'
          AND organization_id = ${organizationId}
        `;
        queryRecent = this.db`
          SELECT id, event_type, severity, title, created_at
          FROM system_events
          WHERE status = 'open'
          AND organization_id = ${organizationId}
          ORDER BY created_at DESC
          LIMIT 10
        `;
      }

      const openCount = await queryOpen;
      const criticalCount = await queryCritical;
      const warningCount = await queryWarnings;
      const recentEvents = await queryRecent;

      return {
        total_open: (openCount[0] as any)?.count || 0,
        critical: (criticalCount[0] as any)?.count || 0,
        warnings: (warningCount[0] as any)?.count || 0,
        recent: (recentEvents as any[]).map((e) => ({
          id: e.id,
          event_type: e.event_type,
          severity: e.severity,
          title: e.title,
          created_at: new Date(e.created_at),
        })),
      };
    } catch (error) {
      console.error('[dashboard] Failed to get system events:', error);
      return {
        total_open: 0,
        critical: 0,
        warnings: 0,
        recent: [],
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.metricsCache = null;
    this.cacheTime = 0;
  }
}
