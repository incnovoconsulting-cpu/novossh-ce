import { getDb } from '../db/connection.js';

export interface ConnectionStats {
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  successRate: number;
  connectionsByDay: Array<{ date: string; total: number; successful: number; failed: number }>;
  connectionsByType: { direct: number; relay: number; tailscale: number };
}

export interface HostUsage {
  hostId: string;
  hostName: string;
  hostAddress: string;
  connectionCount: number;
  lastConnectedAt: string | null;
  avgDurationSeconds: number;
  totalDurationSeconds: number;
  successRate: number;
}

export interface SessionDurationStats {
  avgDurationSeconds: number;
  medianDurationSeconds: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  totalSessions: number;
  totalDurationSeconds: number;
  durationDistribution: Array<{ range: string; count: number }>;
}

export interface CommandCountStats {
  totalCommands: number;
  avgCommandsPerSession: number;
  commandsByDay: Array<{ date: string; count: number }>;
  topCommands: Array<{ command: string; count: number; successRate: number }>;
}

export interface StorageUsage {
  vaults: { count: number; totalEntries: number };
  snippets: { count: number };
  keys: { count: number };
  totalBytes: number;
}

export interface TeamActivity {
  memberCount: number;
  activeMembers: number;
  memberActivity: Array<{ userId: string; sessionsCount: number; commandsCount: number; lastActiveAt: string | null }>;
  teamSessions: number;
  teamCommands: number;
}

export interface AnalyticsOverview {
  connections: ConnectionStats;
  sessions: SessionDurationStats;
  commands: CommandCountStats;
  storage: StorageUsage;
  team: TeamActivity | null;
  period: number;
}

export interface ConnectionHistoryEntry {
  date: string;
  total: number;
  successful: number;
  failed: number;
  avgDuration: number;
}

export class AnalyticsService {
  private db = getDb();

  async getConnectionStats(userId: string, teamId: string, days: number = 30): Promise<ConnectionStats> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const [totalResult, byDayResult, byTypeResult] = await Promise.all([
        this.db`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'connected') as successful,
            COUNT(*) FILTER (WHERE status IN ('error', 'disconnected')) as failed
          FROM ssh_session_logs
          WHERE user_id = ${userId} AND started_at >= ${cutoff}
        `,
        this.db`
          SELECT
            DATE(started_at) as date,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'connected') as successful,
            COUNT(*) FILTER (WHERE status IN ('error', 'disconnected')) as failed
          FROM ssh_session_logs
          WHERE user_id = ${userId} AND started_at >= ${cutoff}
          GROUP BY DATE(started_at)
          ORDER BY date ASC
        `,
        this.db`
          SELECT
            COALESCE(connection_mode, 'relay') as mode,
            COUNT(*) as count
          FROM ssh_session_logs
          WHERE user_id = ${userId} AND started_at >= ${cutoff}
          GROUP BY connection_mode
        `,
      ]);

      const total = parseInt((totalResult[0] as any)?.total || '0', 10);
      const successful = parseInt((totalResult[0] as any)?.successful || '0', 10);
      const failed = parseInt((totalResult[0] as any)?.failed || '0', 10);

      const connectionsByType = { direct: 0, relay: 0, tailscale: 0 };
      for (const row of byTypeResult as any[]) {
        const mode = row.mode || 'direct';
        if (mode in connectionsByType) {
          connectionsByType[mode as keyof typeof connectionsByType] = parseInt(row.count, 10);
        }
      }

      return {
        totalConnections: total,
        successfulConnections: successful,
        failedConnections: failed,
        successRate: total > 0 ? (successful / total) * 100 : 100,
        connectionsByDay: (byDayResult as any[]).map(row => ({
          date: row.date,
          total: parseInt(row.total, 10),
          successful: parseInt(row.successful, 10),
          failed: parseInt(row.failed, 10),
        })),
        connectionsByType,
      };
    } catch (error) {
      console.error('[AnalyticsService] Failed to get connection stats:', error);
      return {
        totalConnections: 0,
        successfulConnections: 0,
        failedConnections: 0,
        successRate: 100,
        connectionsByDay: [],
        connectionsByType: { direct: 0, relay: 0, tailscale: 0 },
      };
    }
  }

  async getHostUsage(userId: string, days: number = 30): Promise<HostUsage[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const result = await this.db`
        SELECT
          s.host_id as "hostId",
          COALESCE(h.label, s.host_address) as "hostName",
          s.host_address as "hostAddress",
          COUNT(*) as "connectionCount",
          MAX(s.started_at) as "lastConnectedAt",
          AVG(EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))) as "avgDurationSeconds",
          SUM(EXTRACT(EPOCH FROM (COALESCE(s.ended_at, NOW()) - s.started_at))) as "totalDurationSeconds",
          ROUND(
            COUNT(*) FILTER (WHERE s.status = 'connected') * 100.0 / NULLIF(COUNT(*), 0),
            1
          ) as "successRate"
        FROM ssh_session_logs s
        LEFT JOIN ssh_hosts h ON s.host_id = h.id AND h.user_id = ${userId}
        WHERE s.user_id = ${userId} AND s.started_at >= ${cutoff}
        GROUP BY s.host_id, h.label, s.host_address
        ORDER BY "connectionCount" DESC
      `;

      return (result as any[]).map(row => ({
        hostId: row.hostId,
        hostName: row.hostName,
        hostAddress: row.hostAddress,
        connectionCount: parseInt(row.connectionCount, 10),
        lastConnectedAt: row.lastConnectedAt ? new Date(row.lastConnectedAt).toISOString() : null,
        avgDurationSeconds: parseFloat(row.avgDurationSeconds) || 0,
        totalDurationSeconds: parseFloat(row.totalDurationSeconds) || 0,
        successRate: parseFloat(row.successRate) || 100,
      }));
    } catch (error) {
      console.error('[AnalyticsService] Failed to get host usage:', error);
      return [];
    }
  }

  async getSessionDurationStats(userId: string, days: number = 30): Promise<SessionDurationStats> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const [statsResult, distributionResult] = await Promise.all([
        this.db`
          SELECT
            COUNT(*) as "totalSessions",
            COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))), 0) as "avgDuration",
            COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))), 0) as "medianDuration",
            COALESCE(MIN(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))), 0) as "minDuration",
            COALESCE(MAX(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))), 0) as "maxDuration",
            COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))), 0) as "totalDuration"
          FROM ssh_session_logs
          WHERE user_id = ${userId} AND started_at >= ${cutoff}
        `,
        this.db`
          SELECT
            CASE
              WHEN EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) < 60 THEN '< 1 min'
              WHEN EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) < 300 THEN '1-5 min'
              WHEN EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) < 900 THEN '5-15 min'
              WHEN EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) < 3600 THEN '15-60 min'
              ELSE '60+ min'
            END as range,
            COUNT(*) as count
          FROM ssh_session_logs
          WHERE user_id = ${userId} AND started_at >= ${cutoff}
          GROUP BY range
          ORDER BY MIN(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)))
        `,
      ]);

      const stats = statsResult[0] as any;
      return {
        avgDurationSeconds: parseFloat(stats?.avgDuration) || 0,
        medianDurationSeconds: parseFloat(stats?.medianDuration) || 0,
        minDurationSeconds: parseFloat(stats?.minDuration) || 0,
        maxDurationSeconds: parseFloat(stats?.maxDuration) || 0,
        totalSessions: parseInt(stats?.totalSessions, 10) || 0,
        totalDurationSeconds: parseFloat(stats?.totalDuration) || 0,
        durationDistribution: (distributionResult as any[]).map(row => ({
          range: row.range,
          count: parseInt(row.count, 10),
        })),
      };
    } catch (error) {
      console.error('[AnalyticsService] Failed to get session duration stats:', error);
      return {
        avgDurationSeconds: 0,
        medianDurationSeconds: 0,
        minDurationSeconds: 0,
        maxDurationSeconds: 0,
        totalSessions: 0,
        totalDurationSeconds: 0,
        durationDistribution: [],
      };
    }
  }

  async getCommandCountStats(userId: string, days: number = 30): Promise<CommandCountStats> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const [totalsResult, byDayResult, topCommandsResult] = await Promise.all([
        this.db`
          SELECT
            COUNT(*) as "totalCommands",
            COUNT(DISTINCT session_id) as "sessionCount"
          FROM ssh_command_logs
          WHERE user_id = ${userId} AND logged_at >= ${cutoff}
        `,
        this.db`
          SELECT
            DATE(logged_at) as date,
            COUNT(*) as count
          FROM ssh_command_logs
          WHERE user_id = ${userId} AND logged_at >= ${cutoff}
          GROUP BY DATE(logged_at)
          ORDER BY date ASC
        `,
        this.db`
          SELECT
            command,
            COUNT(*) as count,
            100 as "successRate"
          FROM ssh_command_logs
          WHERE user_id = ${userId} AND logged_at >= ${cutoff}
          GROUP BY command
          ORDER BY count DESC
          LIMIT 10
        `,
      ]);

      const totals = totalsResult[0] as any;
      const totalCmds = parseInt(totals?.totalCommands, 10) || 0;
      const sessionCount = parseInt(totals?.sessionCount, 10) || 1;
      return {
        totalCommands: totalCmds,
        avgCommandsPerSession: totalCmds / sessionCount,
        commandsByDay: (byDayResult as any[]).map(row => ({
          date: row.date,
          count: parseInt(row.count, 10),
        })),
        topCommands: (topCommandsResult as any[]).map(row => ({
          command: row.command,
          count: parseInt(row.count, 10),
          successRate: parseFloat(row.successRate) || 100,
        })),
      };
    } catch (error) {
      console.error('[AnalyticsService] Failed to get command count stats:', error);
      return {
        totalCommands: 0,
        avgCommandsPerSession: 0,
        commandsByDay: [],
        topCommands: [],
      };
    }
  }

  async getStorageUsage(userId: string): Promise<StorageUsage> {
    try {
      const [vaultsResult, snippetsResult, keysResult] = await Promise.all([
        this.db`
          SELECT
            COUNT(DISTINCT v.id) as vault_count,
            COALESCE(SUM(entry_count), 0) as total_entries
          FROM vaults v
          LEFT JOIN (
            SELECT vault_id, COUNT(*) as entry_count
            FROM vault_entries
            WHERE user_id = ${userId}
            GROUP BY vault_id
          ) e ON v.id = e.vault_id
          WHERE v.user_id = ${userId}
        `,
        this.db`
          SELECT COUNT(*) as count
          FROM user_snippets
          WHERE user_id = ${userId}
        `,
        this.db`
          SELECT COUNT(*) as count
          FROM ssh_keys
          WHERE user_id = ${userId}
        `,
      ]);

      return {
        vaults: {
          count: parseInt((vaultsResult[0] as any)?.vault_count || '0', 10),
          totalEntries: parseInt((vaultsResult[0] as any)?.total_entries || '0', 10),
        },
        snippets: { count: parseInt((snippetsResult[0] as any)?.count || '0', 10) },
        keys: { count: parseInt((keysResult[0] as any)?.count || '0', 10) },
        totalBytes: 0,
      };
    } catch (error) {
      console.error('[AnalyticsService] Failed to get storage usage:', error);
      return { vaults: { count: 0, totalEntries: 0 }, snippets: { count: 0 }, keys: { count: 0 }, totalBytes: 0 };
    }
  }

  async getTeamActivity(userId: string, teamId: string, days: number = 30): Promise<TeamActivity | null> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const [membersResult, activityResult, teamStatsResult] = await Promise.all([
        this.db`
          SELECT COUNT(*) as count FROM team_members WHERE team_id = ${teamId}
        `,
        this.db`
          SELECT
            s.user_id as "userId",
            COUNT(DISTINCT s.id) as "sessionsCount",
            COALESCE(cmd.command_count, 0) as "commandsCount",
            MAX(s.started_at) as "lastActiveAt"
          FROM ssh_session_logs s
          JOIN team_members tm ON tm.user_id = s.user_id AND tm.team_id = ${teamId}
          LEFT JOIN (
            SELECT user_id, COUNT(*) as command_count
            FROM ssh_command_logs
            WHERE logged_at >= ${cutoff}
            GROUP BY user_id
          ) cmd ON cmd.user_id = s.user_id
          WHERE s.started_at >= ${cutoff}
          GROUP BY s.user_id, cmd.command_count
          ORDER BY "sessionsCount" DESC
        `,
        this.db`
          SELECT
            COUNT(DISTINCT s.id) as sessions,
            COALESCE(SUM(cmd.cnt), 0) as commands
          FROM ssh_session_logs s
          JOIN team_members tm ON tm.user_id = s.user_id AND tm.team_id = ${teamId}
          LEFT JOIN (
            SELECT session_id, COUNT(*) as cnt FROM ssh_command_logs GROUP BY session_id
          ) cmd ON cmd.session_id = s.id
          WHERE s.started_at >= ${cutoff}
        `,
      ]);

      const memberCount = parseInt((membersResult[0] as any)?.count || '0', 10);
      const teamStats = teamStatsResult[0] as any;
      const memberActivity = (activityResult as any[]).map(row => ({
        userId: row.userId,
        sessionsCount: parseInt(row.sessionsCount, 10),
        commandsCount: parseInt(row.commandsCount, 10),
        lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt).toISOString() : null,
      }));

      return {
        memberCount,
        activeMembers: memberActivity.length,
        memberActivity,
        teamSessions: parseInt(teamStats?.sessions, 10) || 0,
        teamCommands: parseInt(teamStats?.commands, 10) || 0,
      };
    } catch (error) {
      console.error('[AnalyticsService] Failed to get team activity:', error);
      return null;
    }
  }

  async getOverview(userId: string, teamId: string, days: number = 30): Promise<AnalyticsOverview> {
    const [connections, sessions, commands, storage, team] = await Promise.all([
      this.getConnectionStats(userId, teamId, days),
      this.getSessionDurationStats(userId, days),
      this.getCommandCountStats(userId, days),
      this.getStorageUsage(userId),
      this.getTeamActivity(userId, teamId, days).catch(() => null),
    ]);

    return { connections, sessions, commands, storage, team, period: days };
  }

  async getConnectionHistory(userId: string, days: number = 30): Promise<ConnectionHistoryEntry[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      const result = await this.db`
        SELECT
          DATE(started_at) as date,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'connected') as successful,
          COUNT(*) FILTER (WHERE status IN ('error', 'disconnected')) as failed,
          COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))), 0) as "avgDuration"
        FROM ssh_session_logs
        WHERE user_id = ${userId} AND started_at >= ${cutoff}
        GROUP BY DATE(started_at)
        ORDER BY date ASC
      `;

      return (result as any[]).map(row => ({
        date: row.date,
        total: parseInt(row.total, 10),
        successful: parseInt(row.successful, 10),
        failed: parseInt(row.failed, 10),
        avgDuration: parseFloat(row.avgDuration) || 0,
      }));
    } catch (error) {
      console.error('[AnalyticsService] Failed to get connection history:', error);
      return [];
    }
  }

  async exportCsv(userId: string, days: number = 30): Promise<string> {
    const history = await this.getConnectionHistory(userId, days);
    const hosts = await this.getHostUsage(userId, days);

    const lines: string[] = [];
    lines.push('=== CONNECTION HISTORY ===');
    lines.push('Date,Total,Successful,Failed,Avg Duration (s)');
    for (const row of history) {
      lines.push(`${row.date},${row.total},${row.successful},${row.failed},${row.avgDuration.toFixed(1)}`);
    }

    lines.push('');
    lines.push('=== HOST USAGE ===');
    lines.push('Host,Address,Connections,Last Connected,Avg Duration (s),Success Rate (%)');
    for (const host of hosts) {
      const lastConnected = host.lastConnectedAt ? new Date(host.lastConnectedAt).toISOString().split('T')[0] : 'never';
      lines.push(`${host.hostName},${host.hostAddress},${host.connectionCount},${lastConnected},${host.avgDurationSeconds.toFixed(1)},${host.successRate}`);
    }

    return lines.join('\n');
  }
}
