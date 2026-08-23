import { getDb } from '../db/connection.js';

export interface ResourceUsage {
  hosts: number;
  snippets: number;
  vaults: number;
  keys: number;
  tabs: number;
  limits: {
    hosts: number;
    snippets: number;
    vaults: number;
    keys: number;
    tabs: number;
  };
}

export interface UsageHistory {
  date: string;
  hosts: number;
  snippets: number;
  vaults: number;
  keys: number;
}

export interface ApiUsageStats {
  endpoint: string;
  method: string;
  requestCount: number;
  avgResponseTimeMs: number;
  errorCount: number;
  successRate: number;
}

export interface AnalyticsSummary {
  resourceUsage: ResourceUsage;
  usageHistory: UsageHistory[];
  topEndpoints: ApiUsageStats[];
  sessionsCreated: number;
  commandsExecuted: number;
  recordedSessions: number;
  bytesTransferred: number;
}

export class UsageAnalyticsService {
  private db = getDb();

  async getResourceUsage(userId: string): Promise<ResourceUsage> {
    try {
      const resources = ['hosts', 'snippets', 'vaults', 'keys', 'tabs'];
      const counts: Record<string, number> = {};
      const limits: Record<string, number> = {};

      const subscription = await this.db`
        SELECT plan FROM subscriptions WHERE user_id = ${userId} LIMIT 1
      `;
      const plan = subscription[0]?.plan ?? 'free';

      // Plan limits
      const planLimits: Record<string, Record<string, number>> = {
        free: { hosts: 3, snippets: 5, vaults: 1, keys: 1, tabs: 2 },
        starter: { hosts: 25, snippets: 50, vaults: 10, keys: 10, tabs: 10 },
        pro: { hosts: 999999, snippets: 999999, vaults: 999999, keys: 999999, tabs: 999999 },
      };

      for (const resource of resources) {
        const countRows = await this.db`
          SELECT count FROM usage_counts
          WHERE user_id = ${userId} AND resource_type = ${resource}
        `;
        counts[resource] = countRows[0]?.count ?? 0;
        limits[resource] = planLimits[plan][resource];
      }

      return {
        hosts: counts.hosts,
        snippets: counts.snippets,
        vaults: counts.vaults,
        keys: counts.keys,
        tabs: counts.tabs,
        limits: {
          hosts: limits.hosts,
          snippets: limits.snippets,
          vaults: limits.vaults,
          keys: limits.keys,
          tabs: limits.tabs,
        },
      };
    } catch (error) {
      console.error('[UsageAnalyticsService] Failed to get resource usage:', error);
      throw error;
    }
  }

  async getUsageHistory(userId: string, days: number = 30): Promise<UsageHistory[]> {
    try {
      const resources = ['hosts', 'snippets', 'vaults', 'keys'];
      const history: UsageHistory[] = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const counts: Record<string, number> = {};
        for (const resource of resources) {
          const rows = await this.db`
            SELECT count FROM usage_counts
            WHERE user_id = ${userId} AND resource_type = ${resource}
          `;
          counts[resource] = rows[0]?.count ?? 0;
        }

        history.push({
          date: dateStr,
          hosts: counts.hosts,
          snippets: counts.snippets,
          vaults: counts.vaults,
          keys: counts.keys,
        });
      }

      return history;
    } catch (error) {
      console.error('[UsageAnalyticsService] Failed to get usage history:', error);
      return [];
    }
  }

  async getApiUsageStats(userId: string, hours: number = 24): Promise<ApiUsageStats[]> {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      const stats = await this.db`
        SELECT
          endpoint,
          method,
          COUNT(*) as request_count,
          AVG(EXTRACT(EPOCH FROM (response_time))) * 1000 as avg_response_time_ms,
          SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count,
          ROUND(
            (COUNT(*) - SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)) * 100.0 / COUNT(*),
            2
          ) as success_rate
        FROM api_requests
        WHERE user_id = ${userId} AND created_at > ${cutoffTime}
        GROUP BY endpoint, method
        ORDER BY request_count DESC
        LIMIT 10
      `;

      return stats.map(row => ({
        endpoint: row.endpoint,
        method: row.method,
        requestCount: parseInt(row.request_count, 10),
        avgResponseTimeMs: parseFloat(row.avg_response_time_ms) || 0,
        errorCount: parseInt(row.error_count, 10) || 0,
        successRate: parseFloat(row.success_rate) || 100,
      }));
    } catch (error) {
      console.error('[UsageAnalyticsService] Failed to get API usage stats:', error);
      return [];
    }
  }

  async getSessionStats(userId: string): Promise<{ created: number; recorded: number; commands: number }> {
    try {
      const sessionStats = await this.db`
        SELECT
          COUNT(DISTINCT id) as session_count,
          COUNT(DISTINCT CASE WHEN is_recording THEN id END) as recorded_count,
          COUNT(id) as total_commands
        FROM sessions
        WHERE created_by = ${userId}
      `;

      return {
        created: parseInt(sessionStats[0]?.session_count ?? 0, 10),
        recorded: parseInt(sessionStats[0]?.recorded_count ?? 0, 10),
        commands: parseInt(sessionStats[0]?.total_commands ?? 0, 10),
      };
    } catch (error) {
      console.error('[UsageAnalyticsService] Failed to get session stats:', error);
      return { created: 0, recorded: 0, commands: 0 };
    }
  }

  async getAnalyticsSummary(userId: string): Promise<AnalyticsSummary> {
    try {
      const [resourceUsage, usageHistory, topEndpoints, sessionStats] = await Promise.all([
        this.getResourceUsage(userId),
        this.getUsageHistory(userId, 30),
        this.getApiUsageStats(userId, 24),
        this.getSessionStats(userId),
      ]);

      let bytesTransferred = 0;
      try {
        const bytesResult = await this.db`
          SELECT COALESCE(SUM(bytes_transferred), 0) as total_bytes
          FROM api_requests
          WHERE user_id = ${userId}
        `;
        bytesTransferred = parseInt(bytesResult[0]?.total_bytes ?? 0, 10);
      } catch {
        // bytes_transferred column might not exist
      }

      return {
        resourceUsage,
        usageHistory,
        topEndpoints,
        sessionsCreated: sessionStats.created,
        commandsExecuted: sessionStats.commands,
        recordedSessions: sessionStats.recorded,
        bytesTransferred,
      };
    } catch (error) {
      console.error('[UsageAnalyticsService] Failed to get analytics summary:', error);
      throw error;
    }
  }
}
