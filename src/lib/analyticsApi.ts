import { apiFetch } from './apiFetch';

export interface SessionMetricsResponse {
  current: {
    sessionCount: number;
    avgDuration: number;
    totalCommands: number;
  };
  previous: {
    sessionCount: number;
    avgDuration: number;
    totalCommands: number;
  };
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
}

export interface UserAnalyticsResponse {
  profiles: any[];
  distribution: {
    inactive: number;
    light: number;
    moderate: number;
    heavy: number;
    powerUser: number;
  };
}

export interface CommandAnalyticsResponse {
  topCommands: any[];
  successAnalysis: {
    totalCommands: number;
    successfulCommands: number;
    failedCommands: number;
    successRate: number;
  };
  executionDistribution: {
    fast: number;
    normal: number;
    slow: number;
    verySlowCount: number;
    avgMs: number;
  };
  byCategory: any[];
}

export interface FeatureAnalyticsResponse {
  metrics: any[];
  timeline: any[];
  byStage: Record<string, number>;
}

export interface PerformanceAnalyticsResponse {
  metrics: any[];
  trends: {
    latencyTrend: 'improving' | 'degrading' | 'stable';
    throughputTrend: 'improving' | 'degrading' | 'stable';
    stabilityScore: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    commandsPerSec: number;
  };
}

export interface AnomalyAnalyticsResponse {
  anomalies: any[];
  bySeverity: Record<string, number>;
  active: any[];
}

export interface ChurnRiskResponse {
  assessments: any[];
  highRiskUsers: any[];
}

export interface AnalyticsSummaryResponse {
  period: string;
  totalSessions: number;
  totalCommands: number;
  avgSessionDuration: number;
  commandSuccessRate: number;
  topCommands: any[];
  topUsers: any[];
  performanceMetrics: any[];
  anomalies: any[];
  churnRisks: any[];
}

function teamQuery(teamId?: string): string {
  return teamId ? `teamId=${teamId}&` : '';
}

/**
 * Analytics API client for NovoSSH
 * Provides typed access to all analytics endpoints
 */
export class AnalyticsApi {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async fetch(path: string, init: RequestInit = {}): Promise<Response> {
    return apiFetch(path, this.token || '', {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  }

  /**
   * Get session metrics with trend analysis
   */
  async getSessionMetrics(
    teamId?: string,
    days: number = 30
  ): Promise<SessionMetricsResponse> {
    const response = await this.fetch(`/api/analytics/sessions?${teamQuery(teamId)}days=${days}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch session metrics: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Get user analytics and engagement distribution
   */
  async getUserAnalytics(
    teamId?: string,
    limit: number = 20
  ): Promise<UserAnalyticsResponse> {
    const response = await this.fetch(`/api/analytics/users?${teamQuery(teamId)}limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch user analytics: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Get command analytics with success rates
   */
  async getCommandAnalytics(
    teamId?: string,
    days: number = 30,
    limit: number = 15
  ): Promise<CommandAnalyticsResponse> {
    const response = await this.fetch(
      `/api/analytics/commands?${teamQuery(teamId)}days=${days}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch command analytics: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Get feature adoption metrics and timeline
   */
  async getFeatureAnalytics(
    teamId?: string,
    days: number = 30
  ): Promise<FeatureAnalyticsResponse> {
    const response = await this.fetch(`/api/analytics/features?${teamQuery(teamId)}days=${days}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch feature analytics: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Get performance metrics (latency, throughput, reliability)
   */
  async getPerformanceAnalytics(
    teamId?: string,
    hours: number = 24,
    days: number = 30
  ): Promise<PerformanceAnalyticsResponse> {
    const response = await this.fetch(
      `/api/analytics/performance?${teamQuery(teamId)}hours=${hours}&days=${days}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch performance analytics: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Get detected anomalies
   */
  async getAnomalies(
    teamId?: string,
    severity?: string,
    limit: number = 50
  ): Promise<AnomalyAnalyticsResponse> {
    let url = `/api/analytics/anomalies?${teamQuery(teamId)}limit=${limit}`;
    if (severity) {
      url += `&severity=${severity}`;
    }

    const response = await this.fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch anomalies: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Get churn risk assessments
   */
  async getChurnRisk(
    teamId?: string,
    minRiskScore: number = 60
  ): Promise<ChurnRiskResponse> {
    const response = await this.fetch(
      `/api/analytics/churn-risk?${teamQuery(teamId)}minRiskScore=${minRiskScore}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch churn risk data: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Get user activity heatmap
   */
  async getUserActivityHeatmap(
    teamId?: string,
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
    let url = `/api/analytics/heatmap?${teamQuery(teamId)}`;
    if (userId) {
      url += `userId=${userId}`;
    }

    const response = await this.fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch activity heatmap: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data.heatmap;
  }

  /**
   * Get hourly session distribution
   */
  async getHourlyDistribution(
    teamId?: string,
    days: number = 7
  ): Promise<
    Array<{
      hour: number;
      sessionCount: number;
      avgCommandsPerSession: number;
      avgDurationSeconds: number;
    }>
  > {
    const response = await this.fetch(
      `/api/analytics/hourly-distribution?${teamQuery(teamId)}days=${days}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch hourly distribution: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data.distribution;
  }

  /**
   * Get session activity comparison across time periods
   */
  async getActivityComparison(
    teamId?: string,
    period1Days: number = 7,
    period2Days: number = 7
  ): Promise<{
    period1: { sessionCount: number; totalDuration: number; avgDuration: number };
    period2: { sessionCount: number; totalDuration: number; avgDuration: number };
    changePercent: number;
  }> {
    const response = await this.fetch(
      `/api/analytics/activity-comparison?${teamQuery(teamId)}period1Days=${period1Days}&period2Days=${period2Days}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch activity comparison: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Get comprehensive analytics summary
   */
  async getSummary(
    teamId?: string,
    days: number = 30
  ): Promise<AnalyticsSummaryResponse> {
    const response = await this.fetch(`/api/analytics/summary?${teamQuery(teamId)}days=${days}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch analytics summary: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Flag user for churn outreach
   */
  async flagUserForOutreach(
    teamId: string,
    userId: string,
    reasons: string[]
  ): Promise<{ success: boolean; message: string }> {
    const response = await this.fetch(`/api/analytics/outreach-flag?teamId=${teamId}`, {
      method: 'POST',
      body: JSON.stringify({ userId, reasons }),
    });

    if (!response.ok) {
      throw new Error(`Failed to flag user for outreach: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get analytics overview (connections, sessions, commands, storage, team)
   */
  async getOverview(teamId?: string, days: number = 30): Promise<any> {
    const response = await this.fetch(`/api/analytics/overview?${teamQuery(teamId)}days=${days}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch analytics overview: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Get connection history (daily breakdown)
   */
  async getConnectionHistory(days: number = 30): Promise<any[]> {
    const response = await this.fetch(`/api/analytics/connections?days=${days}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch connection history: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Get host usage stats
   */
  async getHostUsage(days: number = 30): Promise<any[]> {
    const response = await this.fetch(`/api/analytics/hosts?days=${days}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch host usage: ${response.statusText}`);
    }

    const { data } = await response.json();
    return data;
  }

  /**
   * Export analytics as CSV and trigger download
   */
  async exportCsv(days: number = 30): Promise<void> {
    const response = await this.fetch(`/api/analytics/export?days=${days}`);

    if (!response.ok) {
      throw new Error(`Failed to export analytics: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novossh-analytics-${days}d.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

// Singleton instance
let analyticsApi: AnalyticsApi | null = null;

export function getAnalyticsApi(): AnalyticsApi {
  if (!analyticsApi) {
    analyticsApi = new AnalyticsApi();
  }
  return analyticsApi;
}

export default AnalyticsApi;
