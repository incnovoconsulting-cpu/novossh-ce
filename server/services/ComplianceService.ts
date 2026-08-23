import { getDb } from '../db/connection.js';

/**
 * Compliance report
 */
export interface ComplianceReport {
  id: string;
  organization_id: string;
  report_type: 'audit' | 'security' | 'performance' | 'compliance';
  report_period_start: Date;
  report_period_end: Date;
  total_events: number;
  high_severity_events: number;
  medium_severity_events: number;
  low_severity_events: number;
  metrics_json: Record<string, unknown>;
  report_content: string;
  report_format: 'json' | 'pdf' | 'csv';
  is_finalized: boolean;
  generated_by?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Compliance Service - generates reports and tracks compliance metrics
 */
export class ComplianceService {
  private db = getDb();

  /**
   * Generate an audit report
   */
  async generateAuditReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    userId: string
  ): Promise<ComplianceReport> {
    // Get audit events in period
    const events = await this.db`
      SELECT severity, COUNT(*) as count
      FROM audit_log
      WHERE organization_id = ${organizationId}
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
      GROUP BY severity
    `;

    const eventMap = new Map((events as any[]).map((e) => [e.severity, e.count]));
    const total = Array.from(eventMap.values()).reduce((a, b) => a + b, 0);

    const metrics = {
      total_events: total,
      high_severity: eventMap.get('high') || 0,
      medium_severity: eventMap.get('medium') || 0,
      low_severity: eventMap.get('low') || 0,
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      generated_at: new Date().toISOString(),
    };

    const report = await this.db`
      INSERT INTO compliance_report_history (
        organization_id,
        report_type,
        report_period_start,
        report_period_end,
        total_events,
        high_severity_events,
        medium_severity_events,
        low_severity_events,
        metrics_json,
        report_content,
        report_format,
        is_finalized,
        generated_by
      )
      VALUES (
        ${organizationId},
        'audit',
        ${startDate},
        ${endDate},
        ${total},
        ${eventMap.get('high') || 0},
        ${eventMap.get('medium') || 0},
        ${eventMap.get('low') || 0},
        ${JSON.stringify(metrics)},
        ${JSON.stringify(metrics)},
        'json',
        true,
        ${userId}
      )
      RETURNING *
    `;

    return this.mapReport(report[0]);
  }

  /**
   * Generate a security report
   */
  async generateSecurityReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    userId: string
  ): Promise<ComplianceReport> {
    // Get auth failures and rate limit violations
    const authFailures = await this.db`
      SELECT severity, COUNT(*) as count
      FROM auth_failures
      WHERE organization_id = ${organizationId}
      AND last_failure_at >= ${startDate}
      AND last_failure_at <= ${endDate}
      GROUP BY severity
    `;

    const rateLimitViolations = await this.db`
      SELECT severity, COUNT(*) as count
      FROM rate_limit_violations
      WHERE organization_id = ${organizationId}
      AND last_violation_at >= ${startDate}
      AND last_violation_at <= ${endDate}
      GROUP BY severity
    `;

    const authFailureMap = new Map(
      (authFailures as any[]).map((e) => [e.severity, e.count])
    );
    const rateLimitMap = new Map(
      (rateLimitViolations as any[]).map((e) => [e.severity, e.count])
    );

    const metrics = {
      auth_failures: {
        total: Array.from(authFailureMap.values()).reduce((a, b) => a + b, 0),
        critical: authFailureMap.get('critical') || 0,
        high: authFailureMap.get('high') || 0,
        medium: authFailureMap.get('medium') || 0,
        low: authFailureMap.get('low') || 0,
      },
      rate_limit_violations: {
        total: Array.from(rateLimitMap.values()).reduce((a, b) => a + b, 0),
        critical: rateLimitMap.get('critical') || 0,
        high: rateLimitMap.get('high') || 0,
        medium: rateLimitMap.get('medium') || 0,
        low: rateLimitMap.get('low') || 0,
      },
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      generated_at: new Date().toISOString(),
    };

    const highSeverity =
      (authFailureMap.get('critical') || 0) + (rateLimitMap.get('critical') || 0);
    const mediumSeverity =
      (authFailureMap.get('high') || 0) + (rateLimitMap.get('high') || 0);
    const lowSeverity =
      (authFailureMap.get('medium') || 0) +
      (authFailureMap.get('low') || 0) +
      (rateLimitMap.get('medium') || 0) +
      (rateLimitMap.get('low') || 0);

    const report = await this.db`
      INSERT INTO compliance_report_history (
        organization_id,
        report_type,
        report_period_start,
        report_period_end,
        total_events,
        high_severity_events,
        medium_severity_events,
        low_severity_events,
        metrics_json,
        report_content,
        report_format,
        is_finalized,
        generated_by
      )
      VALUES (
        ${organizationId},
        'security',
        ${startDate},
        ${endDate},
        ${highSeverity + mediumSeverity + lowSeverity},
        ${highSeverity},
        ${mediumSeverity},
        ${lowSeverity},
        ${JSON.stringify(metrics)},
        ${JSON.stringify(metrics)},
        'json',
        true,
        ${userId}
      )
      RETURNING *
    `;

    return this.mapReport(report[0]);
  }

  /**
   * Generate a performance report
   */
  async generatePerformanceReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    userId: string
  ): Promise<ComplianceReport> {
    // Get API usage stats
    const stats = await this.db`
      SELECT
        endpoint,
        method,
        SUM(request_count) as total_requests,
        AVG(avg_response_time_ms) as avg_response_time,
        MAX(max_response_time_ms) as max_response_time,
        SUM(error_count) as total_errors
      FROM api_usage_stats
      WHERE organization_id = ${organizationId}
      AND stat_date >= ${startDate.toISOString().split('T')[0]}
      AND stat_date <= ${endDate.toISOString().split('T')[0]}
      GROUP BY endpoint, method
      ORDER BY total_requests DESC
      LIMIT 50
    `;

    const slowEndpoints = (stats as any[]).filter(
      (s) => s.avg_response_time > 5000
    );

    const metrics = {
      endpoints_analyzed: stats.length,
      slow_endpoints: slowEndpoints.length,
      top_endpoints: (stats as any[]).slice(0, 10).map((s) => ({
        endpoint: s.endpoint,
        method: s.method,
        requests: s.total_requests,
        avg_response_time_ms: Math.round(s.avg_response_time),
        error_rate: (
          ((s.total_errors || 0) / (s.total_requests || 1)) *
          100
        ).toFixed(2),
      })),
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      generated_at: new Date().toISOString(),
    };

    const report = await this.db`
      INSERT INTO compliance_report_history (
        organization_id,
        report_type,
        report_period_start,
        report_period_end,
        total_events,
        high_severity_events,
        medium_severity_events,
        low_severity_events,
        metrics_json,
        report_content,
        report_format,
        is_finalized,
        generated_by
      )
      VALUES (
        ${organizationId},
        'performance',
        ${startDate},
        ${endDate},
        ${stats.length},
        ${slowEndpoints.length},
        0,
        0,
        ${JSON.stringify(metrics)},
        ${JSON.stringify(metrics)},
        'json',
        true,
        ${userId}
      )
      RETURNING *
    `;

    return this.mapReport(report[0]);
  }

  /**
   * Get compliance reports
   */
  async getComplianceReports(
    organizationId: string,
    filters?: {
      report_type?: 'audit' | 'security' | 'performance' | 'compliance';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<ComplianceReport[]> {
    let query = this.db`
      SELECT * FROM compliance_report_history
      WHERE organization_id = ${organizationId}
    `;

    if (filters?.report_type) {
      query = this.db`${query} AND report_type = ${filters.report_type}`;
    }
    if (filters?.startDate) {
      query = this.db`${query} AND report_period_start >= ${filters.startDate}`;
    }
    if (filters?.endDate) {
      query = this.db`${query} AND report_period_end <= ${filters.endDate}`;
    }

    query = this.db`${query} ORDER BY created_at DESC`;

    if (filters?.limit) {
      query = this.db`${query} LIMIT ${filters.limit}`;
    }
    if (filters?.offset) {
      query = this.db`${query} OFFSET ${filters.offset}`;
    }

    const result = await query;
    return (result as unknown[]).map((r) => this.mapReport(r));
  }

  /**
   * Get a specific compliance report
   */
  async getComplianceReport(reportId: string): Promise<ComplianceReport | null> {
    const result = await this.db`
      SELECT * FROM compliance_report_history WHERE id = ${reportId}
    `;

    if (result.length === 0) return null;
    return this.mapReport(result[0]);
  }

  /**
   * Get compliance summary for organization
   */
  async getComplianceSummary(organizationId: string): Promise<{
    last_audit_report?: ComplianceReport;
    last_security_report?: ComplianceReport;
    last_performance_report?: ComplianceReport;
    audit_events_last_30_days: number;
    critical_events_last_30_days: number;
    compliance_score: number;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const reports = await this.db`
      SELECT * FROM compliance_report_history
      WHERE organization_id = ${organizationId}
      AND created_at >= ${thirtyDaysAgo}
      ORDER BY created_at DESC
      LIMIT 3
    `;

    const auditReport = (reports as any[]).find((r) => r.report_type === 'audit');
    const securityReport = (reports as any[]).find((r) => r.report_type === 'security');
    const performanceReport = (reports as any[]).find(
      (r) => r.report_type === 'performance'
    );

    const events = await this.db`
      SELECT COUNT(*) as count FROM audit_log
      WHERE organization_id = ${organizationId}
      AND created_at >= ${thirtyDaysAgo}
    `;

    const criticalEvents = await this.db`
      SELECT COUNT(*) as count FROM system_events
      WHERE organization_id = ${organizationId}
      AND severity = 'critical'
      AND created_at >= ${thirtyDaysAgo}
    `;

    const eventCount = (events[0] as any).count || 0;
    const criticalCount = (criticalEvents[0] as any).count || 0;

    // Simple compliance score: 100 - (critical events * 10) - (total events * 0.1)
    const complianceScore = Math.max(0, Math.min(100, 100 - criticalCount * 10 - eventCount * 0.1));

    return {
      last_audit_report: auditReport ? this.mapReport(auditReport) : undefined,
      last_security_report: securityReport ? this.mapReport(securityReport) : undefined,
      last_performance_report: performanceReport
        ? this.mapReport(performanceReport)
        : undefined,
      audit_events_last_30_days: eventCount,
      critical_events_last_30_days: criticalCount,
      compliance_score: Math.round(complianceScore),
    };
  }

  private mapReport(report: unknown): ComplianceReport {
    const r = report as Record<string, unknown>;
    return {
      id: r.id as string,
      organization_id: r.organization_id as string,
      report_type: r.report_type as ComplianceReport['report_type'],
      report_period_start: new Date(r.report_period_start as string),
      report_period_end: new Date(r.report_period_end as string),
      total_events: r.total_events as number,
      high_severity_events: r.high_severity_events as number,
      medium_severity_events: r.medium_severity_events as number,
      low_severity_events: r.low_severity_events as number,
      metrics_json: r.metrics_json as Record<string, unknown>,
      report_content: r.report_content as string,
      report_format: r.report_format as ComplianceReport['report_format'],
      is_finalized: r.is_finalized as boolean,
      generated_by: r.generated_by as string | undefined,
      created_at: new Date(r.created_at as string),
      updated_at: new Date(r.updated_at as string),
    };
  }
}
