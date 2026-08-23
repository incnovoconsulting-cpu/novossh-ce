import { getDb } from '../db/connection.js';

/**
 * Rate limit violation record
 */
export interface RateLimitViolation {
  id: string;
  organization_id?: string;
  user_id?: string;
  ip_address?: string;
  endpoint: string;
  violation_count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved' | 'escalated';
  first_violation_at: Date;
  last_violation_at: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Auth failure record
 */
export interface AuthFailure {
  id: string;
  organization_id?: string;
  user_id?: string;
  ip_address: string;
  failure_type: 'invalid_credentials' | 'invalid_token' | 'expired_token' | 'missing_token';
  endpoint: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved';
  failure_count: number;
  first_failure_at: Date;
  last_failure_at: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Performance metric snapshot
 */
export interface PerformanceMetric {
  id: string;
  endpoint: string;
  method: string;
  response_time_ms: number;
  status_code: number;
  timestamp: Date;
}

/**
 * Health check status
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: Date;
  database: {
    status: 'healthy' | 'unhealthy';
    latency_ms: number;
  };
  auth: {
    status: 'healthy' | 'unhealthy';
    failed_attempts_1h: number;
  };
  rate_limit: {
    status: 'healthy' | 'unhealthy';
    violations_1h: number;
  };
  memory: {
    status: 'healthy' | 'unhealthy';
    used_mb: number;
    available_mb: number;
  };
}

/**
 * API Usage Statistics aggregation
 */
export interface ApiUsageStats {
  endpoint: string;
  method: string;
  request_count: number;
  error_count: number;
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  p99_response_time_ms: number;
  max_response_time_ms: number;
  error_rate: number;
  stat_date: string;
  stat_hour?: number;
}

/**
 * Alert rule for automated notifications
 */
export interface AlertRule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  rule_type: 'rate_limit' | 'auth_failure' | 'performance' | 'resource' | 'custom';
  condition_json: Record<string, unknown>;
  actions_json: Array<{ type: 'webhook' | 'email'; url?: string; recipients?: string[] }>;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Alert execution record
 */
export interface AlertExecution {
  id: string;
  alert_rule_id: string;
  organization_id: string;
  triggered_at: Date;
  trigger_value: number;
  trigger_threshold: number;
  channels_json: Record<string, unknown>;
  status: 'sent' | 'pending' | 'failed';
  acknowledged_at?: Date;
  acknowledged_by?: string;
  created_at: Date;
}

/**
 * System event for important incidents
 */
export interface SystemEvent {
  id: string;
  event_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description?: string;
  organization_id?: string;
  team_id?: string;
  user_id?: string;
  details: Record<string, unknown>;
  status: 'open' | 'acknowledged' | 'resolved' | 'escalated';
  acknowledged_at?: Date;
  acknowledged_by?: string;
  resolved_at?: Date;
  resolved_by?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Monitoring Service - tracks system health and violations
 */
export class MonitoringService {
  private db = getDb();
  private metricsCache: Map<string, PerformanceMetric[]> = new Map();
  private metricsWindow = 3600000; // 1 hour
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private alertCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startMetricsCleanup();
    this.startAlertCheck();
  }

  /**
   * Start periodic cleanup of old metrics
   */
  private startMetricsCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, metrics] of this.metricsCache.entries()) {
        const filtered = metrics.filter((m) => now - m.timestamp.getTime() < this.metricsWindow);
        if (filtered.length === 0) {
          this.metricsCache.delete(key);
        } else {
          this.metricsCache.set(key, filtered);
        }
      }
    }, 300000); // Cleanup every 5 minutes
  }

  /**
   * Record a rate limit violation
   */
  async recordRateLimitViolation(
    endpoint: string,
    userId?: string,
    ipAddress?: string,
    organizationId?: string
  ): Promise<RateLimitViolation> {
    const identifier = userId ? `user:${userId}` : `ip:${ipAddress}`;
    const now = new Date();

    // Check if violation record exists
    let result = await this.db`
      SELECT * FROM rate_limit_violations
      WHERE endpoint = ${endpoint} AND identifier = ${identifier}
      AND status = 'open'
    `;

    if (result.length > 0) {
      // Update existing violation
      const updated = await this.db`
        UPDATE rate_limit_violations
        SET violation_count = violation_count + 1,
            last_violation_at = ${now},
            severity = CASE
              WHEN violation_count + 1 >= 10 THEN 'critical'
              WHEN violation_count + 1 >= 5 THEN 'high'
              WHEN violation_count + 1 >= 3 THEN 'medium'
              ELSE 'low'
            END,
            updated_at = ${now}
        WHERE endpoint = ${endpoint} AND identifier = ${identifier}
        RETURNING *
      `;
      return this.mapRateLimitViolation(updated[0]);
    } else {
      // Create new violation record
      const created = await this.db`
        INSERT INTO rate_limit_violations (
          organization_id, user_id, ip_address, endpoint, identifier, violation_count, severity, status, first_violation_at, last_violation_at
        )
        VALUES (
          ${organizationId || null}, ${userId || null}, ${ipAddress || null}, ${endpoint}, ${identifier}, 1, 'low', 'open', ${now}, ${now}
        )
        RETURNING *
      `;
      return this.mapRateLimitViolation(created[0]);
    }
  }

  /**
   * Record authentication failure
   */
  async recordAuthFailure(
    failureType: 'invalid_credentials' | 'invalid_token' | 'expired_token' | 'missing_token',
    endpoint: string,
    userId?: string,
    ipAddress?: string,
    organizationId?: string
  ): Promise<AuthFailure> {
    const identifier = userId ? `user:${userId}` : `ip:${ipAddress}`;
    const now = new Date();

    // Check if failure record exists
    let result = await this.db`
      SELECT * FROM auth_failures
      WHERE endpoint = ${endpoint} AND identifier = ${identifier} AND failure_type = ${failureType}
      AND status = 'open'
    `;

    if (result.length > 0) {
      // Update existing failure record
      const updated = await this.db`
        UPDATE auth_failures
        SET failure_count = failure_count + 1,
            last_failure_at = ${now},
            severity = CASE
              WHEN failure_count + 1 >= 10 THEN 'critical'
              WHEN failure_count + 1 >= 5 THEN 'high'
              WHEN failure_count + 1 >= 3 THEN 'medium'
              ELSE 'low'
            END,
            updated_at = ${now}
        WHERE endpoint = ${endpoint} AND identifier = ${identifier} AND failure_type = ${failureType}
        RETURNING *
      `;
      return this.mapAuthFailure(updated[0]);
    } else {
      // Create new failure record
      const created = await this.db`
        INSERT INTO auth_failures (
          organization_id, user_id, ip_address, endpoint, identifier, failure_type, failure_count, severity, status, first_failure_at, last_failure_at
        )
        VALUES (
          ${organizationId || null}, ${userId || null}, ${ipAddress || null}, ${endpoint}, ${identifier}, ${failureType}, 1, 'low', 'open', ${now}, ${now}
        )
        RETURNING *
      `;
      return this.mapAuthFailure(created[0]);
    }
  }

  /**
   * Record performance metric
   */
  recordPerformanceMetric(
    endpoint: string,
    method: string,
    responseTimeMs: number,
    statusCode: number
  ): void {
    const metric: PerformanceMetric = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      endpoint,
      method,
      response_time_ms: responseTimeMs,
      status_code: statusCode,
      timestamp: new Date(),
    };

    const key = endpoint;
    const metrics = this.metricsCache.get(key) || [];
    metrics.push(metric);
    this.metricsCache.set(key, metrics);
  }

  /**
   * Get performance metrics for an endpoint
   */
  getPerformanceMetrics(endpoint: string): {
    count: number;
    avgResponseTime: number;
    p50: number;
    p95: number;
    p99: number;
    maxResponseTime: number;
    minResponseTime: number;
    errorRate: number;
  } {
    const metrics = this.metricsCache.get(endpoint) || [];

    if (metrics.length === 0) {
      return {
        count: 0,
        avgResponseTime: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        maxResponseTime: 0,
        minResponseTime: 0,
        errorRate: 0,
      };
    }

    const responseTimes = metrics.map((m) => m.response_time_ms).sort((a, b) => a - b);
    const errorCount = metrics.filter((m) => m.status_code >= 400).length;
    const errorRate = (errorCount / metrics.length) * 100;

    return {
      count: metrics.length,
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p50: responseTimes[Math.floor(responseTimes.length * 0.5)],
      p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99: responseTimes[Math.floor(responseTimes.length * 0.99)],
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes),
      errorRate,
    };
  }

  /**
   * Get all rate limit violations
   */
  async getRateLimitViolations(
    filters?: {
      status?: 'open' | 'resolved' | 'escalated';
      severity?: 'low' | 'medium' | 'high' | 'critical';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<RateLimitViolation[]> {
    let query = this.db`SELECT * FROM rate_limit_violations WHERE 1=1`;

    if (filters?.status) {
      query = this.db`${query} AND status = ${filters.status}`;
    }
    if (filters?.severity) {
      query = this.db`${query} AND severity = ${filters.severity}`;
    }
    if (filters?.startDate) {
      query = this.db`${query} AND created_at >= ${filters.startDate}`;
    }
    if (filters?.endDate) {
      query = this.db`${query} AND created_at <= ${filters.endDate}`;
    }

    query = this.db`${query} ORDER BY last_violation_at DESC`;

    if (filters?.limit) {
      query = this.db`${query} LIMIT ${filters.limit}`;
    }
    if (filters?.offset) {
      query = this.db`${query} OFFSET ${filters.offset}`;
    }

    const result = await query;
    return (result as unknown[]).map((v) => this.mapRateLimitViolation(v));
  }

  /**
   * Get all auth failures
   */
  async getAuthFailures(
    filters?: {
      status?: 'open' | 'resolved';
      severity?: 'low' | 'medium' | 'high' | 'critical';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<AuthFailure[]> {
    let query = this.db`SELECT * FROM auth_failures WHERE 1=1`;

    if (filters?.status) {
      query = this.db`${query} AND status = ${filters.status}`;
    }
    if (filters?.severity) {
      query = this.db`${query} AND severity = ${filters.severity}`;
    }
    if (filters?.startDate) {
      query = this.db`${query} AND created_at >= ${filters.startDate}`;
    }
    if (filters?.endDate) {
      query = this.db`${query} AND created_at <= ${filters.endDate}`;
    }

    query = this.db`${query} ORDER BY last_failure_at DESC`;

    if (filters?.limit) {
      query = this.db`${query} LIMIT ${filters.limit}`;
    }
    if (filters?.offset) {
      query = this.db`${query} OFFSET ${filters.offset}`;
    }

    const result = await query;
    return (result as unknown[]).map((f) => this.mapAuthFailure(f));
  }

  /**
   * Get brute force attempts for an IP
   */
  async getBruteForceSuspects(hourWindow: number = 1): Promise<
    Array<{
      identifier: string;
      failureType: string;
      failureCount: number;
      lastFailureAt: Date;
      severity: string;
    }>
  > {
    const startDate = new Date(Date.now() - hourWindow * 3600000);

    const result = await this.db`
      SELECT identifier, failure_type, failure_count, last_failure_at, severity
      FROM auth_failures
      WHERE last_failure_at >= ${startDate} AND failure_count >= 5
      ORDER BY failure_count DESC
    `;

    return (result as unknown[]).map((r) => ({
      identifier: (r as any).identifier,
      failureType: (r as any).failure_type,
      failureCount: (r as any).failure_count,
      lastFailureAt: new Date((r as any).last_failure_at),
      severity: (r as any).severity,
    }));
  }

  /**
   * Resolve a violation
   */
  async resolveViolation(violationId: string): Promise<void> {
    await this.db`
      UPDATE rate_limit_violations
      SET status = 'resolved', updated_at = NOW()
      WHERE id = ${violationId}
    `;
  }

  /**
   * Resolve an auth failure
   */
  async resolveAuthFailure(failureId: string): Promise<void> {
    await this.db`
      UPDATE auth_failures
      SET status = 'resolved', updated_at = NOW()
      WHERE id = ${failureId}
    `;
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const now = new Date();
    const startOfHour = new Date(now.getTime() - 3600000);

    let dbStatus: 'healthy' | 'unhealthy' = 'healthy';
    let dbLatency = 0;

    try {
      const start = Date.now();
      await this.db`SELECT 1`;
      dbLatency = Date.now() - start;
      if (dbLatency > 1000) {
        dbStatus = 'unhealthy';
      }
    } catch {
      dbStatus = 'unhealthy';
      dbLatency = 1000;
    }

    const violations = await this.db`
      SELECT COUNT(*) as count FROM rate_limit_violations
      WHERE last_violation_at >= ${startOfHour} AND status = 'open'
    `;
    const violationCount = (violations[0] as any).count;

    const authFailures = await this.db`
      SELECT COUNT(*) as count FROM auth_failures
      WHERE last_failure_at >= ${startOfHour} AND status = 'open'
    `;
    const authFailureCount = (authFailures[0] as any).count;

    const memUsage = process.memoryUsage();
    const memUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memAvailableMb = Math.round(memUsage.heapTotal / 1024 / 1024);

    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';

    if (
      dbStatus === 'unhealthy' ||
      authFailureCount > 20 ||
      memUsedMb > memAvailableMb * 0.9
    ) {
      overallStatus = 'critical';
    } else if (
      violationCount > 10 ||
      authFailureCount > 10 ||
      memUsedMb > memAvailableMb * 0.7
    ) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: now,
      database: {
        status: dbStatus,
        latency_ms: dbLatency,
      },
      auth: {
        status: authFailureCount > 20 ? 'unhealthy' : 'healthy',
        failed_attempts_1h: authFailureCount,
      },
      rate_limit: {
        status: violationCount > 10 ? 'unhealthy' : 'healthy',
        violations_1h: violationCount,
      },
      memory: {
        status: memUsedMb > memAvailableMb * 0.9 ? 'unhealthy' : 'healthy',
        used_mb: memUsedMb,
        available_mb: memAvailableMb,
      },
    };
  }

  /**
   * Start periodic alert checking
   */
  private startAlertCheck(): void {
    this.alertCheckInterval = setInterval(async () => {
      try {
        await this.checkAndExecuteAlerts();
      } catch (error) {
        console.error('[monitoring] Alert check failed:', error);
      }
    }, 60000); // Check every 60 seconds
  }

  /**
   * Check active alert rules and execute if conditions are met
   */
  private async checkAndExecuteAlerts(): Promise<void> {
    try {
      const rules = await this.db`
        SELECT * FROM alert_rules WHERE is_enabled = true
      `;

      for (const rule of rules as unknown[]) {
        await this.evaluateAlertRule(rule as AlertRule);
      }
    } catch (error) {
      console.error('[monitoring] Failed to check alert rules:', error);
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateAlertRule(rule: AlertRule): Promise<void> {
    const condition = rule.condition_json as any;
    let shouldTrigger = false;
    let triggerValue = 0;

    try {
      // Evaluate based on metric type
      if (condition.metric === 'auth_failures') {
        const startTime = new Date(Date.now() - condition.window_minutes * 60000);
        const result = await this.db`
          SELECT COUNT(*) as count FROM auth_failures
          WHERE last_failure_at >= ${startTime}
          AND organization_id = ${rule.organization_id}
        `;
        triggerValue = (result[0] as any).count;
        shouldTrigger = this.compareValue(triggerValue, condition.operator, condition.value);
      } else if (condition.metric === 'rate_limit_violations') {
        const startTime = new Date(Date.now() - condition.window_minutes * 60000);
        const result = await this.db`
          SELECT COUNT(*) as count FROM rate_limit_violations
          WHERE last_violation_at >= ${startTime}
          AND organization_id = ${rule.organization_id}
        `;
        triggerValue = (result[0] as any).count;
        shouldTrigger = this.compareValue(triggerValue, condition.operator, condition.value);
      } else if (condition.metric === 'response_time') {
        // Check average response time
        const metrics = this.metricsCache.get(condition.endpoint) || [];
        if (metrics.length > 0) {
          const avgTime =
            metrics.reduce((a, b) => a + b.response_time_ms, 0) / metrics.length;
          triggerValue = avgTime;
          shouldTrigger = this.compareValue(triggerValue, condition.operator, condition.value);
        }
      }

      if (shouldTrigger) {
        await this.executeAlertRule(rule, triggerValue);
      }
    } catch (error) {
      console.error(`[monitoring] Failed to evaluate alert rule ${rule.id}:`, error);
    }
  }

  /**
   * Compare a value against a condition
   */
  private compareValue(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '>=':
        return value >= threshold;
      case '<':
        return value < threshold;
      case '<=':
        return value <= threshold;
      case '===':
        return value === threshold;
      case '!==':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Execute an alert rule - send notifications
   */
  private async executeAlertRule(rule: AlertRule, triggerValue: number): Promise<void> {
    const condition = rule.condition_json as any;

    // Create alert execution record
    await this.db`
      INSERT INTO alert_executions (
        alert_rule_id, organization_id, triggered_at, trigger_value, trigger_threshold, channels_json, status
      )
      VALUES (
        ${rule.id},
        ${rule.organization_id},
        NOW(),
        ${triggerValue},
        ${condition.value},
        ${JSON.stringify(rule.actions_json)},
        'sent'
      )
      RETURNING *
    `;

    // Log system event
    await this.createSystemEvent(
      rule.organization_id,
      'alert_triggered',
      'warning',
      `Alert: ${rule.name}`,
      `Condition triggered: ${JSON.stringify(condition)}`,
      { rule_id: rule.id, trigger_value: triggerValue, threshold: condition.value }
    );

    // In production, would send emails/webhooks here
  }

  /**
   * Create a system event
   */
  async createSystemEvent(
    organizationId: string | undefined,
    eventType: string,
    severity: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    description?: string,
    details?: Record<string, unknown>
  ): Promise<SystemEvent> {
    const result = await this.db`
      INSERT INTO system_events (
        event_type, severity, title, description, organization_id, details, status, created_at
      )
      VALUES (
        ${eventType},
        ${severity},
        ${title},
        ${description || null},
        ${organizationId || null},
        ${JSON.stringify(details || {})},
        'open',
        NOW()
      )
      RETURNING *
    `;

    return this.mapSystemEvent(result[0]);
  }

  /**
   * Get system events
   */
  async getSystemEvents(
    filters?: {
      event_type?: string;
      severity?: string;
      status?: string;
      organization_id?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<SystemEvent[]> {
    let query = this.db`SELECT * FROM system_events WHERE 1=1`;

    if (filters?.event_type) {
      query = this.db`${query} AND event_type = ${filters.event_type}`;
    }
    if (filters?.severity) {
      query = this.db`${query} AND severity = ${filters.severity}`;
    }
    if (filters?.status) {
      query = this.db`${query} AND status = ${filters.status}`;
    }
    if (filters?.organization_id) {
      query = this.db`${query} AND organization_id = ${filters.organization_id}`;
    }
    if (filters?.startDate) {
      query = this.db`${query} AND created_at >= ${filters.startDate}`;
    }
    if (filters?.endDate) {
      query = this.db`${query} AND created_at <= ${filters.endDate}`;
    }

    query = this.db`${query} ORDER BY created_at DESC`;

    if (filters?.limit) {
      query = this.db`${query} LIMIT ${filters.limit}`;
    }
    if (filters?.offset) {
      query = this.db`${query} OFFSET ${filters.offset}`;
    }

    const result = await query;
    return (result as unknown[]).map((e) => this.mapSystemEvent(e));
  }

  /**
   * Acknowledge a system event
   */
  async acknowledgeSystemEvent(eventId: string, userId: string): Promise<void> {
    await this.db`
      UPDATE system_events
      SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = ${userId}
      WHERE id = ${eventId}
    `;
  }

  /**
   * Resolve a system event
   */
  async resolveSystemEvent(eventId: string, userId: string): Promise<void> {
    await this.db`
      UPDATE system_events
      SET status = 'resolved', resolved_at = NOW(), resolved_by = ${userId}
      WHERE id = ${eventId}
    `;
  }

  /**
   * Get API usage statistics
   */
  async getApiUsageStats(
    filters?: {
      endpoint?: string;
      stat_date?: string;
      stat_hour?: number;
      organization_id?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiUsageStats[]> {
    let query = this.db`SELECT * FROM api_usage_stats WHERE 1=1`;

    if (filters?.endpoint) {
      query = this.db`${query} AND endpoint = ${filters.endpoint}`;
    }
    if (filters?.stat_date) {
      query = this.db`${query} AND stat_date = ${filters.stat_date}`;
    }
    if (filters?.stat_hour !== undefined) {
      query = this.db`${query} AND stat_hour = ${filters.stat_hour}`;
    }
    if (filters?.organization_id) {
      query = this.db`${query} AND organization_id = ${filters.organization_id}`;
    }

    query = this.db`${query} ORDER BY stat_date DESC, stat_hour DESC`;

    if (filters?.limit) {
      query = this.db`${query} LIMIT ${filters.limit}`;
    }
    if (filters?.offset) {
      query = this.db`${query} OFFSET ${filters.offset}`;
    }

    const result = await query;
    return (result as unknown[]).map((s) => this.mapApiUsageStats(s));
  }

  /**
   * Record API usage statistics (hourly aggregation)
   */
  async recordApiUsageStats(
    endpoint: string,
    method: string,
    responseTimeMs: number,
    statusCode: number,
    organizationId?: string
  ): Promise<void> {
    const now = new Date();
    const statDate = now.toISOString().split('T')[0];
    const statHour = now.getHours();

    try {
      // Check if record exists
      const existing = await this.db`
        SELECT * FROM api_usage_stats
        WHERE endpoint = ${endpoint}
        AND method = ${method}
        AND stat_date = ${statDate}
        AND stat_hour = ${statHour}
        ${organizationId ? this.db`AND organization_id = ${organizationId}` : this.db`AND organization_id IS NULL`}
      `;

      if (existing.length > 0) {
        // Update existing record
        const stat = existing[0] as any;
        const newRequestCount = stat.request_count + 1;
        const newErrorCount = statusCode >= 400 ? stat.error_count + 1 : stat.error_count;
        const newAvgTime =
          (stat.avg_response_time_ms * stat.request_count + responseTimeMs) / newRequestCount;

        await this.db`
          UPDATE api_usage_stats
          SET request_count = ${newRequestCount},
              error_count = ${newErrorCount},
              avg_response_time_ms = ${newAvgTime},
              updated_at = NOW()
          WHERE id = ${stat.id}
        `;
      } else {
        // Create new record
        await this.db`
          INSERT INTO api_usage_stats (
            organization_id, endpoint, method, request_count, error_count, avg_response_time_ms, stat_date, stat_hour
          )
          VALUES (
            ${organizationId || null},
            ${endpoint},
            ${method},
            1,
            ${statusCode >= 400 ? 1 : 0},
            ${responseTimeMs},
            ${statDate},
            ${statHour}
          )
        `;
      }
    } catch (error) {
      console.error('[monitoring] Failed to record API usage stats:', error);
    }
  }

  /**
   * Create an alert rule
   */
  async createAlertRule(
    organizationId: string,
    name: string,
    ruleType: 'rate_limit' | 'auth_failure' | 'performance' | 'resource' | 'custom',
    condition: Record<string, unknown>,
    actions?: Array<{ type: 'webhook' | 'email'; url?: string; recipients?: string[] }>,
    description?: string
  ): Promise<AlertRule> {
    const result = await this.db`
      INSERT INTO alert_rules (
        organization_id, name, description, rule_type, condition_json, actions_json, is_enabled
      )
      VALUES (
        ${organizationId},
        ${name},
        ${description || null},
        ${ruleType},
        ${JSON.stringify(condition)},
        ${JSON.stringify(actions || [])},
        true
      )
      RETURNING *
    `;

    return this.mapAlertRule(result[0]);
  }

  /**
   * Get alert rules for organization
   */
  async getAlertRules(organizationId: string): Promise<AlertRule[]> {
    const result = await this.db`
      SELECT * FROM alert_rules
      WHERE organization_id = ${organizationId}
      ORDER BY created_at DESC
    `;

    return (result as unknown[]).map((r) => this.mapAlertRule(r));
  }

  /**
   * Update alert rule
   */
  async updateAlertRule(
    ruleId: string,
    updates: {
      name?: string;
      description?: string;
      condition_json?: Record<string, unknown>;
      actions_json?: Array<{ type: 'webhook' | 'email'; url?: string; recipients?: string[] }>;
      is_enabled?: boolean;
    }
  ): Promise<AlertRule> {
    const updates_obj: Record<string, unknown> = {};
    if (updates.name !== undefined) updates_obj.name = updates.name;
    if (updates.description !== undefined) updates_obj.description = updates.description;
    if (updates.condition_json !== undefined) updates_obj.condition_json = updates.condition_json;
    if (updates.actions_json !== undefined) updates_obj.actions_json = updates.actions_json;
    if (updates.is_enabled !== undefined) updates_obj.is_enabled = updates.is_enabled;

    const result = await this.db`
      UPDATE alert_rules
      SET ${(Object.keys(updates_obj)
        .map((key) => this.db`${key} = ${(updates_obj as any)[key]}`)
        .reduce((a: any, b: any) => a.concat(' ,', b)) as any)},
          updated_at = NOW()
      WHERE id = ${ruleId}
      RETURNING *
    `;

    return this.mapAlertRule(result[0]);
  }

  /**
   * Delete alert rule
   */
  async deleteAlertRule(ruleId: string): Promise<void> {
    await this.db`DELETE FROM alert_rules WHERE id = ${ruleId}`;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }
  }

  private mapRateLimitViolation(violation: unknown): RateLimitViolation {
    const v = violation as Record<string, unknown>;
    return {
      id: v.id as string,
      organization_id: v.organization_id as string | undefined,
      user_id: v.user_id as string | undefined,
      ip_address: v.ip_address as string | undefined,
      endpoint: v.endpoint as string,
      violation_count: v.violation_count as number,
      severity: v.severity as 'low' | 'medium' | 'high' | 'critical',
      status: v.status as 'open' | 'resolved' | 'escalated',
      first_violation_at: new Date(v.first_violation_at as string),
      last_violation_at: new Date(v.last_violation_at as string),
      created_at: new Date(v.created_at as string),
      updated_at: new Date(v.updated_at as string),
    };
  }

  private mapAuthFailure(failure: unknown): AuthFailure {
    const f = failure as Record<string, unknown>;
    return {
      id: f.id as string,
      organization_id: f.organization_id as string | undefined,
      user_id: f.user_id as string | undefined,
      ip_address: f.ip_address as string,
      failure_type: f.failure_type as AuthFailure['failure_type'],
      endpoint: f.endpoint as string,
      severity: f.severity as 'low' | 'medium' | 'high' | 'critical',
      status: f.status as 'open' | 'resolved',
      failure_count: f.failure_count as number,
      first_failure_at: new Date(f.first_failure_at as string),
      last_failure_at: new Date(f.last_failure_at as string),
      created_at: new Date(f.created_at as string),
      updated_at: new Date(f.updated_at as string),
    };
  }

  private mapAlertRule(rule: unknown): AlertRule {
    const r = rule as Record<string, unknown>;
    return {
      id: r.id as string,
      organization_id: r.organization_id as string,
      name: r.name as string,
      description: r.description as string | undefined,
      rule_type: r.rule_type as AlertRule['rule_type'],
      condition_json: r.condition_json as Record<string, unknown>,
      actions_json: r.actions_json as AlertRule['actions_json'],
      is_enabled: r.is_enabled as boolean,
      created_at: new Date(r.created_at as string),
      updated_at: new Date(r.updated_at as string),
    };
  }

  private mapApiUsageStats(stats: unknown): ApiUsageStats {
    const s = stats as Record<string, unknown>;
    return {
      endpoint: s.endpoint as string,
      method: s.method as string,
      request_count: s.request_count as number,
      error_count: s.error_count as number,
      avg_response_time_ms: s.avg_response_time_ms as number,
      p95_response_time_ms: s.p95_response_time_ms as number,
      p99_response_time_ms: s.p99_response_time_ms as number,
      max_response_time_ms: s.max_response_time_ms as number,
      error_rate: (((s.error_count as number) / (s.request_count as number)) * 100) || 0,
      stat_date: s.stat_date as string,
      stat_hour: s.stat_hour as number | undefined,
    };
  }

  private mapSystemEvent(event: unknown): SystemEvent {
    const e = event as Record<string, unknown>;
    return {
      id: e.id as string,
      event_type: e.event_type as string,
      severity: e.severity as SystemEvent['severity'],
      title: e.title as string,
      description: e.description as string | undefined,
      organization_id: e.organization_id as string | undefined,
      team_id: e.team_id as string | undefined,
      user_id: e.user_id as string | undefined,
      details: e.details as Record<string, unknown>,
      status: e.status as SystemEvent['status'],
      acknowledged_at: e.acknowledged_at ? new Date(e.acknowledged_at as string) : undefined,
      acknowledged_by: e.acknowledged_by as string | undefined,
      resolved_at: e.resolved_at ? new Date(e.resolved_at as string) : undefined,
      resolved_by: e.resolved_by as string | undefined,
      created_at: new Date(e.created_at as string),
      updated_at: new Date(e.updated_at as string),
    };
  }
}
