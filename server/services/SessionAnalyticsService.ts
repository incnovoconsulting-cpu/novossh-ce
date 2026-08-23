import { getDb } from '../db/connection.js';

export interface SessionMetric {
  id: string;
  teamId: string;
  sessionId: string;
  durationSeconds?: number;
  commandCount: number;
  successfulCommands: number;
  failedCommands: number;
  commandSuccessRate?: number;
  avgCommandExecutionMs?: number;
  minCommandExecutionMs?: number;
  maxCommandExecutionMs?: number;
  participantCount: number;
  observerCount: number;
  isRecorded: boolean;
  recordingDurationSeconds?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommandAnalytic {
  commandPattern: string;
  commandCategory?: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate?: number;
  avgExecutionMs?: number;
  medianExecutionMs?: number;
  p95ExecutionMs?: number;
  lastExecutedAt?: Date;
}

export interface FeatureAdoptionMetric {
  featureName: string;
  featureCategory?: string;
  firstUsedAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
  isActive: boolean;
  adoptionStage: 'discovery' | 'onboarding' | 'regular' | 'power_user';
}

export interface UserBehaviorProfile {
  userId: string;
  totalSessions: number;
  totalCommandsExecuted: number;
  totalSessionDurationSeconds: number;
  avgSessionDurationSeconds?: number;
  mostActiveHour?: number;
  mostActiveDayOfWeek?: number;
  sessionsPerDay?: number;
  userType: 'inactive' | 'light' | 'moderate' | 'heavy' | 'power_user';
  engagementLevel: 'low' | 'medium' | 'high';
  lastActivityAt?: Date;
  inactiveDays: number;
  churnRiskScore: number;
  isAtRisk: boolean;
}

export interface PerformanceMetric {
  teamId: string;
  sessionId?: string;
  totalRequests: number;
  avgResponseTimeMs?: number;
  p95ResponseTimeMs?: number;
  p99ResponseTimeMs?: number;
  commandsPerSecond?: number;
  bytesTransferred: number;
  requestSuccessRate?: number;
  errorRate?: number;
  connectionDropCount: number;
  avgTimeToReconnectMs?: number;
  measurementPeriodSeconds?: number;
  measuredAt: Date;
}

export interface Anomaly {
  id: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  details?: Record<string, any>;
  baselineValue?: number;
  anomalyValue?: number;
  deviationPercentage?: number;
  isResolved: boolean;
  createdAt: Date;
}

export interface ChurnRiskAssessment {
  userId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  daysSinceLastActivity: number;
  sessionDropRate?: number;
  featureAdoptionRate?: number;
  engagementTrend: 'increasing' | 'stable' | 'declining';
  hasOutreachFlag: boolean;
  outreachReasons?: string[];
  lastOutreachAt?: Date;
  outreachCount: number;
}

export interface SessionAnalyticsSummary {
  period: string;
  totalSessions: number;
  totalCommands: number;
  avgSessionDuration: number;
  commandSuccessRate: number;
  topCommands: CommandAnalytic[];
  topUsers: UserBehaviorProfile[];
  performanceMetrics: PerformanceMetric[];
  anomalies: Anomaly[];
  churnRisks: ChurnRiskAssessment[];
}

export class SessionAnalyticsService {
  private db = getDb();

  /**
   * Get session metrics for a given session
   */
  async getSessionMetrics(sessionId: string): Promise<SessionMetric | null> {
    try {
      const result = await this.db`
        SELECT
          id,
          team_id as "teamId",
          session_id as "sessionId",
          duration_seconds as "durationSeconds",
          command_count as "commandCount",
          successful_commands as "successfulCommands",
          failed_commands as "failedCommands",
          command_success_rate as "commandSuccessRate",
          avg_command_execution_ms as "avgCommandExecutionMs",
          min_command_execution_ms as "minCommandExecutionMs",
          max_command_execution_ms as "maxCommandExecutionMs",
          participant_count as "participantCount",
          observer_count as "observerCount",
          is_recorded as "isRecorded",
          recording_duration_seconds as "recordingDurationSeconds",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM session_metrics
        WHERE session_id = ${sessionId}
        LIMIT 1
      `;
      return result.length > 0 ? (result[0] as SessionMetric) : null;
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get session metrics:', error);
      throw error;
    }
  }

  /**
   * Get aggregated session metrics for a team over a period
   */
  async getTeamSessionMetrics(
    teamId: string | undefined,
    days: number = 30
  ): Promise<{
    totalSessions: number;
    avgDurationSeconds: number;
    totalCommands: number;
    commandSuccessRate: number;
  }> {
    if (!teamId) return { totalSessions: 0, avgDurationSeconds: 0, totalCommands: 0, commandSuccessRate: 0 };
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.db`
        SELECT
          COUNT(*) as session_count,
          AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.created_at))) as avg_duration_seconds,
          COALESCE(SUM(sm.command_count), 0) as total_commands,
          COALESCE(AVG(sm.command_success_rate), 0) as avg_success_rate
        FROM sessions s
        LEFT JOIN session_metrics sm ON s.id = sm.session_id
        WHERE s.team_id = ${teamId} AND s.created_at > ${cutoffDate}
      `;

      const row = result[0] as any;
      return {
        totalSessions: parseInt(row.session_count, 10) || 0,
        avgDurationSeconds: parseFloat(row.avg_duration_seconds) || 0,
        totalCommands: parseInt(row.total_commands, 10) || 0,
        commandSuccessRate: parseFloat(row.avg_success_rate) || 0,
      };
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get team session metrics:', error);
      throw error;
    }
  }

  /**
   * Get top commands by frequency and success rate
   */
  async getTopCommands(
    teamId: string | undefined,
    limit: number = 10,
    days: number = 30
  ): Promise<CommandAnalytic[]> {
    if (!teamId) return [];
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.db`
        SELECT
          command_pattern as "commandPattern",
          command_category as "commandCategory",
          total_executions as "totalExecutions",
          successful_executions as "successfulExecutions",
          failed_executions as "failedExecutions",
          success_rate as "successRate",
          avg_execution_ms as "avgExecutionMs",
          median_execution_ms as "medianExecutionMs",
          p95_execution_ms as "p95ExecutionMs",
          last_executed_at as "lastExecutedAt"
        FROM command_analytics
        WHERE team_id = ${teamId} AND updated_at > ${cutoffDate}
        ORDER BY total_executions DESC
        LIMIT ${limit}
      `;

      return result as unknown as CommandAnalytic[];
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get top commands:', error);
      return [];
    }
  }

  /**
   * Get command success/failure breakdown
   */
  async getCommandSuccessAnalysis(
    teamId: string | undefined,
    days: number = 30
  ): Promise<{
    totalCommands: number;
    successfulCommands: number;
    failedCommands: number;
    successRate: number;
  }> {
    if (!teamId) return { totalCommands: 0, successfulCommands: 0, failedCommands: 0, successRate: 0 };
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.db`
        SELECT
          COALESCE(SUM(total_executions), 0) as total_executions,
          COALESCE(SUM(successful_executions), 0) as successful_executions,
          COALESCE(SUM(failed_executions), 0) as failed_executions,
          COALESCE(AVG(success_rate), 0) as avg_success_rate
        FROM command_analytics
        WHERE team_id = ${teamId} AND updated_at > ${cutoffDate}
      `;

      const row = result[0] as any;
      const total = parseInt(row.total_executions, 10) || 0;
      const successful = parseInt(row.successful_executions, 10) || 0;

      return {
        totalCommands: total,
        successfulCommands: successful,
        failedCommands: parseInt(row.failed_executions, 10) || 0,
        successRate: total > 0 ? (successful / total) * 100 : 0,
      };
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get command success analysis:', error);
      throw error;
    }
  }

  /**
   * Get feature adoption metrics
   */
  async getFeatureAdoptionMetrics(
    teamId: string | undefined,
    days: number = 30
  ): Promise<FeatureAdoptionMetric[]> {
    if (!teamId) return [];
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.db`
        SELECT
          feature_name as "featureName",
          feature_category as "featureCategory",
          first_used_at as "firstUsedAt",
          last_used_at as "lastUsedAt",
          usage_count as "usageCount",
          is_active as "isActive",
          adoption_stage as "adoptionStage"
        FROM feature_adoption
        WHERE team_id = ${teamId} AND first_used_at > ${cutoffDate}
        ORDER BY usage_count DESC
      `;

      return result as unknown as FeatureAdoptionMetric[];
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get feature adoption metrics:', error);
      return [];
    }
  }

  /**
   * Track feature adoption by stage
   */
  async getFeatureAdoptionByStage(
    teamId: string | undefined
  ): Promise<Record<string, number>> {
    const breakdown: Record<string, number> = {
      discovery: 0,
      onboarding: 0,
      regular: 0,
      power_user: 0,
    };
    if (!teamId) return breakdown;
    try {
      const result = await this.db`
        SELECT
          adoption_stage,
          COUNT(*) as count
        FROM feature_adoption
        WHERE team_id = ${teamId}
        GROUP BY adoption_stage
      `;

      for (const row of result as any[]) {
        breakdown[row.adoption_stage] = parseInt(row.count, 10);
      }

      return breakdown;
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get feature adoption by stage:', error);
      return breakdown;
    }
  }

  /**
   * Get user behavior profiles
   */
  async getUserBehaviorProfiles(
    teamId: string | undefined,
    limit: number = 10
  ): Promise<UserBehaviorProfile[]> {
    if (!teamId) return [];
    try {
      const result = await this.db`
        SELECT
          user_id as "userId",
          total_sessions as "totalSessions",
          total_commands_executed as "totalCommandsExecuted",
          total_session_duration_seconds as "totalSessionDurationSeconds",
          avg_session_duration_seconds as "avgSessionDurationSeconds",
          most_active_hour as "mostActiveHour",
          most_active_day_of_week as "mostActiveDayOfWeek",
          sessions_per_day as "sessionsPerDay",
          user_type as "userType",
          engagement_level as "engagementLevel",
          last_activity_at as "lastActivityAt",
          inactive_days as "inactiveDays",
          churn_risk_score as "churnRiskScore",
          is_at_risk as "isAtRisk"
        FROM user_behavior_profiles
        WHERE team_id = ${teamId}
        ORDER BY total_sessions DESC
        LIMIT ${limit}
      `;

      return result as unknown as UserBehaviorProfile[];
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get user behavior profiles:', error);
      return [];
    }
  }

  /**
   * Get user activity heatmap (24-hour pattern by day of week)
   */
  async getUserActivityHeatmap(
    teamId: string | undefined,
    userId?: string
  ): Promise<
    Array<{
      hourOfDay: number;
      dayOfWeek: number;
      sessionCount: number;
      commandCount: number;
      totalDurationSeconds: number;
    }>
  > {
    if (!teamId) return [];
    try {
      let query = this.db`
        SELECT
          hour_of_day as "hourOfDay",
          day_of_week as "dayOfWeek",
          session_count as "sessionCount",
          command_count as "commandCount",
          total_duration_seconds as "totalDurationSeconds"
        FROM user_activity_heatmap
        WHERE team_id = ${teamId}
      `;

      if (userId) {
        query = this.db`
          SELECT
            hour_of_day as "hourOfDay",
            day_of_week as "dayOfWeek",
            session_count as "sessionCount",
            command_count as "commandCount",
            total_duration_seconds as "totalDurationSeconds"
          FROM user_activity_heatmap
          WHERE team_id = ${teamId} AND user_id = ${userId}
        `;
      }

      const result = await query;
      return result as any[];
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get user activity heatmap:', error);
      return [];
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    teamId: string | undefined,
    sessionId?: string,
    hours: number = 24
  ): Promise<PerformanceMetric[]> {
    if (!teamId) return [];
    try {
      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      let query = this.db`
        SELECT
          team_id as "teamId",
          session_id as "sessionId",
          total_requests as "totalRequests",
          avg_response_time_ms as "avgResponseTimeMs",
          p95_response_time_ms as "p95ResponseTimeMs",
          p99_response_time_ms as "p99ResponseTimeMs",
          commands_per_second as "commandsPerSecond",
          bytes_transferred as "bytesTransferred",
          request_success_rate as "requestSuccessRate",
          error_rate as "errorRate",
          connection_drop_count as "connectionDropCount",
          avg_time_to_reconnect_ms as "avgTimeToReconnectMs",
          measurement_period_seconds as "measurementPeriodSeconds",
          measured_at as "measuredAt"
        FROM performance_metrics
        WHERE team_id = ${teamId} AND measured_at > ${cutoffDate}
      `;

      if (sessionId) {
        query = this.db`
          SELECT
            team_id as "teamId",
            session_id as "sessionId",
            total_requests as "totalRequests",
            avg_response_time_ms as "avgResponseTimeMs",
            p95_response_time_ms as "p95ResponseTimeMs",
            p99_response_time_ms as "p99ResponseTimeMs",
            commands_per_second as "commandsPerSecond",
            bytes_transferred as "bytesTransferred",
            request_success_rate as "requestSuccessRate",
            error_rate as "errorRate",
            connection_drop_count as "connectionDropCount",
            avg_time_to_reconnect_ms as "avgTimeToReconnectMs",
            measurement_period_seconds as "measurementPeriodSeconds",
            measured_at as "measuredAt"
          FROM performance_metrics
          WHERE team_id = ${teamId} AND session_id = ${sessionId} AND measured_at > ${cutoffDate}
        `;
      }

      const result = await query;
      return result as unknown as PerformanceMetric[];
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get performance metrics:', error);
      return [];
    }
  }

  /**
   * Get anomalies
   */
  async getAnomalies(
    teamId: string | undefined,
    severity?: string,
    limit: number = 50
  ): Promise<Anomaly[]> {
    if (!teamId) return [];
    try {
      const fullQuery = severity
        ? this.db`
            SELECT
              id,
              anomaly_type as "anomalyType",
              severity,
              description,
              details,
              baseline_value as "baselineValue",
              anomaly_value as "anomalyValue",
              deviation_percentage as "deviationPercentage",
              is_resolved as "isResolved",
              created_at as "createdAt"
            FROM anomalies
            WHERE team_id = ${teamId} AND severity = ${severity}
            ORDER BY created_at DESC
            LIMIT ${limit}
          `
        : this.db`
            SELECT
              id,
              anomaly_type as "anomalyType",
              severity,
              description,
              details,
              baseline_value as "baselineValue",
              anomaly_value as "anomalyValue",
              deviation_percentage as "deviationPercentage",
              is_resolved as "isResolved",
              created_at as "createdAt"
            FROM anomalies
            WHERE team_id = ${teamId}
            ORDER BY created_at DESC
            LIMIT ${limit}
          `;

      const result = await fullQuery;
      return result as unknown as Anomaly[];
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get anomalies:', error);
      return [];
    }
  }

  /**
   * Get unresolved anomalies by severity
   */
  async getUnresolvedAnomaliesBySeverity(teamId: string | undefined): Promise<Record<string, number>> {
    const breakdown: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    if (!teamId) return breakdown;
    try {
      const result = await this.db`
        SELECT
          severity,
          COUNT(*) as count
        FROM anomalies
        WHERE team_id = ${teamId} AND is_resolved = FALSE
        GROUP BY severity
      `;

      for (const row of result as any[]) {
        breakdown[row.severity] = parseInt(row.count, 10);
      }

      return breakdown;
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get unresolved anomalies by severity:', error);
      return breakdown;
    }
  }

  /**
   * Get churn risk assessments
   */
  async getChurnRiskAssessments(
    teamId: string | undefined,
    limit: number = 20
  ): Promise<ChurnRiskAssessment[]> {
    if (!teamId) return [];
    try {
      const result = await this.db`
        SELECT
          user_id as "userId",
          risk_score as "riskScore",
          risk_level as "riskLevel",
          days_since_last_activity as "daysSinceLastActivity",
          session_drop_rate as "sessionDropRate",
          feature_adoption_rate as "featureAdoptionRate",
          engagement_trend as "engagementTrend",
          has_outreach_flag as "hasOutreachFlag",
          outreach_reasons as "outreachReasons",
          last_outreach_at as "lastOutreachAt",
          outreach_count as "outreachCount"
        FROM churn_risk_assessments
        WHERE team_id = ${teamId}
        ORDER BY risk_score DESC
        LIMIT ${limit}
      `;

      return result as unknown as ChurnRiskAssessment[];
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get churn risk assessments:', error);
      return [];
    }
  }

  /**
   * Get high-risk users (for outreach)
   */
  async getHighRiskUsersForOutreach(teamId: string | undefined): Promise<ChurnRiskAssessment[]> {
    if (!teamId) return [];
    try {
      const result = await this.db`
        SELECT
          user_id as "userId",
          risk_score as "riskScore",
          risk_level as "riskLevel",
          days_since_last_activity as "daysSinceLastActivity",
          session_drop_rate as "sessionDropRate",
          feature_adoption_rate as "featureAdoptionRate",
          engagement_trend as "engagementTrend",
          has_outreach_flag as "hasOutreachFlag",
          outreach_reasons as "outreachReasons",
          last_outreach_at as "lastOutreachAt",
          outreach_count as "outreachCount"
        FROM churn_risk_assessments
        WHERE team_id = ${teamId}
          AND risk_level IN ('high', 'critical')
          AND has_outreach_flag = TRUE
        ORDER BY risk_score DESC
      `;

      return result as unknown as ChurnRiskAssessment[];
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get high-risk users:', error);
      return [];
    }
  }

  /**
   * Update churn risk flag for a user
   */
  async flagUserForChurnOutreach(
    teamId: string | undefined,
    userId: string,
    reasons: string[]
  ): Promise<void> {
    if (!teamId) throw new Error('teamId is required to flag a user for churn outreach');
    try {
      await this.db`
        UPDATE churn_risk_assessments
        SET
          has_outreach_flag = TRUE,
          outreach_reasons = ${JSON.stringify(reasons)},
          outreach_count = outreach_count + 1,
          last_outreach_at = NOW()
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to flag user for outreach:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive analytics summary for a period
   */
  async getAnalyticsSummary(teamId: string | undefined, days: number = 30): Promise<SessionAnalyticsSummary> {
    if (!teamId) {
      return {
        period: `last_${days}_days`,
        totalSessions: 0,
        totalCommands: 0,
        avgSessionDuration: 0,
        commandSuccessRate: 0,
        topCommands: [],
        topUsers: [],
        performanceMetrics: [],
        anomalies: [],
        churnRisks: [],
      };
    }
    try {
      const [
        sessionMetrics,
        topCommands,
        commandSuccessAnalysis,
        performanceMetrics,
        anomalies,
        churnRisks,
        topUsers,
      ] = await Promise.all([
        this.getTeamSessionMetrics(teamId, days),
        this.getTopCommands(teamId, 5, days),
        this.getCommandSuccessAnalysis(teamId, days),
        this.getPerformanceMetrics(teamId, undefined, days * 24),
        this.getAnomalies(teamId, undefined, 10),
        this.getChurnRiskAssessments(teamId, 10),
        this.getUserBehaviorProfiles(teamId, 5),
      ]);

      return {
        period: `last_${days}_days`,
        totalSessions: sessionMetrics.totalSessions,
        totalCommands: commandSuccessAnalysis.totalCommands,
        avgSessionDuration: sessionMetrics.avgDurationSeconds,
        commandSuccessRate: commandSuccessAnalysis.successRate,
        topCommands,
        topUsers,
        performanceMetrics,
        anomalies,
        churnRisks,
      };
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get analytics summary:', error);
      throw error;
    }
  }

  /**
   * NEW: Get session metrics with trend analysis
   */
  async getSessionMetricsWithTrends(
    teamId: string | undefined,
    days: number = 30
  ): Promise<{
    current: any;
    previous: any;
    trend: 'up' | 'down' | 'stable';
    percentageChange: number;
  }> {
    const empty = { sessionCount: 0, avgDuration: 0, totalCommands: 0 };
    if (!teamId) return { current: empty, previous: empty, trend: 'stable', percentageChange: 0 };
    try {
      const currentCutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const previousStart = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000);
      const previousEnd = currentCutoff;

      const [currentMetrics, previousMetrics] = await Promise.all([
        this.db`
          SELECT
            COUNT(*) as count,
            AVG(duration_seconds) as avg_duration,
            SUM(command_count) as total_commands
          FROM session_metrics
          WHERE team_id = ${teamId} AND created_at > ${currentCutoff}
        `,
        this.db`
          SELECT
            COUNT(*) as count,
            AVG(duration_seconds) as avg_duration,
            SUM(command_count) as total_commands
          FROM session_metrics
          WHERE team_id = ${teamId} AND created_at BETWEEN ${previousStart} AND ${previousEnd}
        `,
      ]);

      const curr = currentMetrics[0] as any;
      const prev = previousMetrics[0] as any;

      const currentCount = parseInt(curr?.count || 0, 10);
      const previousCount = parseInt(prev?.count || 0, 10);

      const percentageChange = previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : 0;

      return {
        current: {
          sessionCount: currentCount,
          avgDuration: parseFloat(curr?.avg_duration) || 0,
          totalCommands: parseInt(curr?.total_commands, 10) || 0,
        },
        previous: {
          sessionCount: previousCount,
          avgDuration: parseFloat(prev?.avg_duration) || 0,
          totalCommands: parseInt(prev?.total_commands, 10) || 0,
        },
        trend: percentageChange > 5 ? 'up' : percentageChange < -5 ? 'down' : 'stable',
        percentageChange,
      };
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get session metrics with trends:', error);
      return { current: empty, previous: empty, trend: 'stable' as const, percentageChange: 0 };
    }
  }

  /**
   * NEW: Get command execution time distribution
   */
  async getCommandExecutionDistribution(
    teamId: string | undefined,
    days: number = 30
  ): Promise<{
    fast: number;
    normal: number;
    slow: number;
    verySlowCount: number;
    avgMs: number;
  }> {
    if (!teamId) return { fast: 0, normal: 0, slow: 0, verySlowCount: 0, avgMs: 0 };
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.db`
        SELECT
          COUNT(*) FILTER (WHERE avg_execution_ms < 100) as fast_count,
          COUNT(*) FILTER (WHERE avg_execution_ms >= 100 AND avg_execution_ms < 500) as normal_count,
          COUNT(*) FILTER (WHERE avg_execution_ms >= 500 AND avg_execution_ms < 2000) as slow_count,
          COUNT(*) FILTER (WHERE avg_execution_ms >= 2000) as very_slow_count,
          AVG(avg_execution_ms) as avg_execution
        FROM command_analytics
        WHERE team_id = ${teamId} AND updated_at > ${cutoffDate}
      `;

      const row = result[0] as any;
      return {
        fast: parseInt(row.fast_count, 10) || 0,
        normal: parseInt(row.normal_count, 10) || 0,
        slow: parseInt(row.slow_count, 10) || 0,
        verySlowCount: parseInt(row.very_slow_count, 10) || 0,
        avgMs: parseFloat(row.avg_execution) || 0,
      };
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get command execution distribution:', error);
      return { fast: 0, normal: 0, slow: 0, verySlowCount: 0, avgMs: 0 };
    }
  }

  /**
   * NEW: Get feature adoption timeline
   */
  async getFeatureAdoptionTimeline(
    teamId: string | undefined,
    days: number = 90
  ): Promise<
    Array<{
      date: Date;
      newAdoptions: number;
      activeFeatures: number;
      cumulativeAdoptions: number;
    }>
  > {
    if (!teamId) return [];
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.db`
        SELECT
          DATE(first_used_at) as adoption_date,
          COUNT(*) as new_adoptions,
          SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_count
        FROM feature_adoption
        WHERE team_id = ${teamId} AND first_used_at > ${cutoffDate}
        GROUP BY DATE(first_used_at)
        ORDER BY adoption_date ASC
      `;

      let cumulative = 0;
      return result.map((row: any) => {
        cumulative += parseInt(row.new_adoptions, 10);
        return {
          date: new Date(row.adoption_date),
          newAdoptions: parseInt(row.new_adoptions, 10),
          activeFeatures: parseInt(row.active_count, 10),
          cumulativeAdoptions: cumulative,
        };
      });
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get feature adoption timeline:', error);
      return [];
    }
  }

  /**
   * NEW: Get user engagement distribution
   */
  async getUserEngagementDistribution(teamId: string | undefined): Promise<{
    inactive: number;
    light: number;
    moderate: number;
    heavy: number;
    powerUser: number;
  }> {
    const empty = { inactive: 0, light: 0, moderate: 0, heavy: 0, powerUser: 0 };
    if (!teamId) return empty;
    try {
      const result = await this.db`
        SELECT
          COUNT(*) FILTER (WHERE user_type = 'inactive') as inactive_count,
          COUNT(*) FILTER (WHERE user_type = 'light') as light_count,
          COUNT(*) FILTER (WHERE user_type = 'moderate') as moderate_count,
          COUNT(*) FILTER (WHERE user_type = 'heavy') as heavy_count,
          COUNT(*) FILTER (WHERE user_type = 'power_user') as power_user_count
        FROM user_behavior_profiles
        WHERE team_id = ${teamId}
      `;

      const row = result[0] as any;
      return {
        inactive: parseInt(row.inactive_count, 10) || 0,
        light: parseInt(row.light_count, 10) || 0,
        moderate: parseInt(row.moderate_count, 10) || 0,
        heavy: parseInt(row.heavy_count, 10) || 0,
        powerUser: parseInt(row.power_user_count, 10) || 0,
      };
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get user engagement distribution:', error);
      return empty;
    }
  }

  /**
   * NEW: Get performance trends (latency, throughput, stability)
   */
  async getPerformanceTrends(
    teamId: string | undefined,
    days: number = 30
  ): Promise<{
    latencyTrend: 'improving' | 'degrading' | 'stable';
    throughputTrend: 'improving' | 'degrading' | 'stable';
    stabilityScore: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    commandsPerSec: number;
  }> {
    const empty = {
      latencyTrend: 'stable' as const,
      throughputTrend: 'stable' as const,
      stabilityScore: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      commandsPerSec: 0,
    };
    if (!teamId) return empty;
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const midDate = new Date(Date.now() - (days / 2) * 24 * 60 * 60 * 1000);

      const [firstHalf, secondHalf] = await Promise.all([
        this.db`
          SELECT
            AVG(avg_response_time_ms) as avg_latency,
            AVG(p95_response_time_ms) as p95_latency,
            AVG(commands_per_second) as avg_commands_per_sec,
            AVG(request_success_rate) as avg_success_rate
          FROM performance_metrics
          WHERE team_id = ${teamId} AND measured_at BETWEEN ${cutoffDate} AND ${midDate}
        `,
        this.db`
          SELECT
            AVG(avg_response_time_ms) as avg_latency,
            AVG(p95_response_time_ms) as p95_latency,
            AVG(commands_per_second) as avg_commands_per_sec,
            AVG(request_success_rate) as avg_success_rate
          FROM performance_metrics
          WHERE team_id = ${teamId} AND measured_at > ${midDate}
        `,
      ]);

      const first = firstHalf[0] as any;
      const second = secondHalf[0] as any;

      const firstLatency = parseFloat(first?.avg_latency) || 0;
      const secondLatency = parseFloat(second?.avg_latency) || 0;
      const firstThroughput = parseFloat(first?.avg_commands_per_sec) || 0;
      const secondThroughput = parseFloat(second?.avg_commands_per_sec) || 0;
      const stabilityScore = parseFloat(second?.avg_success_rate) || 0;

      return {
        latencyTrend: secondLatency < firstLatency * 0.9 ? 'improving' : secondLatency > firstLatency * 1.1 ? 'degrading' : 'stable',
        throughputTrend: secondThroughput > firstThroughput * 1.1 ? 'improving' : secondThroughput < firstThroughput * 0.9 ? 'degrading' : 'stable',
        stabilityScore,
        avgLatencyMs: secondLatency,
        p95LatencyMs: parseFloat(second?.p95_latency) || 0,
        commandsPerSec: secondThroughput,
      };
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get performance trends:', error);
      return empty;
    }
  }

  /**
   * NEW: Detect and get active anomalies with context
   */
  async detectActiveAnomalies(teamId: string | undefined): Promise<
    Array<{
      id: string;
      type: string;
      severity: string;
      description: string;
      context: string;
      affectedUsers?: number;
      suggestedAction?: string;
    }>
  > {
    if (!teamId) return [];
    try {
      const result = await this.db`
        SELECT
          id,
          anomaly_type as type,
          severity,
          description,
          details,
          created_at
        FROM anomalies
        WHERE team_id = ${teamId} AND is_resolved = FALSE
        ORDER BY created_at DESC
        LIMIT 50
      `;

      return result.map((row: any) => {
        const details = row.details || {};
        return {
          id: row.id,
          type: row.type,
          severity: row.severity,
          description: row.description || 'Anomaly detected',
          context: details.context || 'Unknown',
          affectedUsers: details.affectedUsers || undefined,
          suggestedAction: details.suggestedAction || undefined,
        };
      });
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to detect active anomalies:', error);
      return [];
    }
  }

  /**
   * NEW: Get users at churn risk with context
   */
  async getChurnRiskUsersWithContext(
    teamId: string | undefined,
    minRiskScore: number = 60
  ): Promise<
    Array<{
      userId: string;
      riskScore: number;
      riskLevel: string;
      daysSinceActivity: number;
      engagementTrend: string;
      sessionDropPercentage: number;
      recommendedAction: string;
    }>
  > {
    if (!teamId) return [];
    try {
      const result = await this.db`
        SELECT
          user_id as "userId",
          risk_score as "riskScore",
          risk_level as "riskLevel",
          days_since_last_activity as "daysSinceActivity",
          engagement_trend as "engagementTrend",
          session_drop_rate as "sessionDropRate",
          outreach_reasons as "outreachReasons"
        FROM churn_risk_assessments
        WHERE team_id = ${teamId} AND risk_score >= ${minRiskScore}
        ORDER BY risk_score DESC
        LIMIT 50
      `;

      return result.map((row: any) => {
        let recommendedAction = 'Monitor';
        if (row.riskScore > 80) {
          recommendedAction = 'Immediate outreach required';
        } else if (row.riskScore > 70) {
          recommendedAction = 'Schedule engagement call';
        } else if (row.riskScore > 60) {
          recommendedAction = 'Send re-engagement email';
        }

        return {
          userId: row.userId,
          riskScore: row.riskScore,
          riskLevel: row.riskLevel,
          daysSinceActivity: row.daysSinceActivity,
          engagementTrend: row.engagementTrend,
          sessionDropPercentage: row.sessionDropRate || 0,
          recommendedAction,
        };
      });
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get churn risk users with context:', error);
      return [];
    }
  }

  /**
   * NEW: Get command success rate by category
   */
  async getCommandSuccessByCategory(
    teamId: string | undefined,
    days: number = 30
  ): Promise<
    Array<{
      category: string;
      totalCommands: number;
      successRate: number;
      avgExecutionMs: number;
      failureReason?: string;
    }>
  > {
    if (!teamId) return [];
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.db`
        SELECT
          COALESCE(command_category, 'unknown') as category,
          SUM(total_executions) as total_executions,
          SUM(successful_executions) as successful_executions,
          AVG(success_rate) as avg_success_rate,
          AVG(avg_execution_ms) as avg_execution_ms
        FROM command_analytics
        WHERE team_id = ${teamId} AND updated_at > ${cutoffDate}
        GROUP BY command_category
        ORDER BY total_executions DESC
      `;

      return result.map((row: any) => ({
        category: row.category,
        totalCommands: parseInt(row.total_executions, 10) || 0,
        successRate: parseFloat(row.avg_success_rate) || 0,
        avgExecutionMs: parseFloat(row.avg_execution_ms) || 0,
        failureReason: undefined,
      }));
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get command success by category:', error);
      return [];
    }
  }

  /**
   * NEW: Get session activity comparison across time periods
   */
  async getSessionActivityComparison(
    teamId: string | undefined,
    period1Days: number = 7,
    period2Days: number = 7
  ): Promise<{
    period1: { sessionCount: number; totalDuration: number; avgDuration: number };
    period2: { sessionCount: number; totalDuration: number; avgDuration: number };
    changePercent: number;
  }> {
    const emptyPeriod = { sessionCount: 0, totalDuration: 0, avgDuration: 0 };
    if (!teamId) return { period1: emptyPeriod, period2: emptyPeriod, changePercent: 0 };
    try {
      const now = Date.now();
      const period2Start = new Date(now - period2Days * 24 * 60 * 60 * 1000);
      const period2End = new Date(now - period1Days * 24 * 60 * 60 * 1000);
      const period1Start = new Date(now - period1Days * 24 * 60 * 60 * 1000);

      const [p1, p2] = await Promise.all([
        this.db`
          SELECT
            COUNT(*) as session_count,
            SUM(duration_seconds) as total_duration,
            AVG(duration_seconds) as avg_duration
          FROM session_metrics
          WHERE team_id = ${teamId} AND created_at > ${period1Start}
        `,
        this.db`
          SELECT
            COUNT(*) as session_count,
            SUM(duration_seconds) as total_duration,
            AVG(duration_seconds) as avg_duration
          FROM session_metrics
          WHERE team_id = ${teamId} AND created_at BETWEEN ${period2Start} AND ${period2End}
        `,
      ]);

      const period1 = p1[0] as any;
      const period2 = p2[0] as any;

      const p1Count = parseInt(period1?.session_count, 10) || 0;
      const p2Count = parseInt(period2?.session_count, 10) || 0;

      return {
        period1: {
          sessionCount: p1Count,
          totalDuration: parseInt(period1?.total_duration, 10) || 0,
          avgDuration: parseFloat(period1?.avg_duration) || 0,
        },
        period2: {
          sessionCount: p2Count,
          totalDuration: parseInt(period2?.total_duration, 10) || 0,
          avgDuration: parseFloat(period2?.avg_duration) || 0,
        },
        changePercent: p2Count > 0 ? ((p1Count - p2Count) / p2Count) * 100 : 0,
      };
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get session activity comparison:', error);
      return { period1: emptyPeriod, period2: emptyPeriod, changePercent: 0 };
    }
  }

  /**
   * NEW: Get hourly session distribution
   */
  async getHourlySessionDistribution(
    teamId: string | undefined,
    days: number = 7
  ): Promise<
    Array<{
      hour: number;
      sessionCount: number;
      avgCommandsPerSession: number;
      avgDurationSeconds: number;
    }>
  > {
    if (!teamId) return [];
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.db`
        SELECT
          EXTRACT(HOUR FROM s.created_at)::int as hour,
          COUNT(s.id) as session_count,
          AVG(sm.command_count) as avg_commands,
          AVG(sm.duration_seconds) as avg_duration
        FROM sessions s
        LEFT JOIN session_metrics sm ON s.id = sm.session_id
        WHERE s.team_id = ${teamId} AND s.created_at > ${cutoffDate}
        GROUP BY EXTRACT(HOUR FROM s.created_at)
        ORDER BY hour ASC
      `;

      return result.map((row: any) => ({
        hour: row.hour,
        sessionCount: parseInt(row.session_count, 10),
        avgCommandsPerSession: parseFloat(row.avg_commands) || 0,
        avgDurationSeconds: parseFloat(row.avg_duration) || 0,
      }));
    } catch (error) {
      console.error('[SessionAnalyticsService] Failed to get hourly session distribution:', error);
      return [];
    }
  }
}
