import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../lib/store';
import { getAnalyticsApi } from '../lib/analyticsApi';

interface AnalyticsOverview {
  connections: {
    totalConnections: number;
    successfulConnections: number;
    failedConnections: number;
    successRate: number;
    connectionsByDay: Array<{ date: string; total: number; successful: number; failed: number }>;
    connectionsByType: { direct: number; relay: number; tailscale: number };
  };
  sessions: {
    avgDurationSeconds: number;
    medianDurationSeconds: number;
    totalSessions: number;
    totalDurationSeconds: number;
    durationDistribution: Array<{ range: string; count: number }>;
  };
  commands: {
    totalCommands: number;
    avgCommandsPerSession: number;
    commandsByDay: Array<{ date: string; count: number }>;
    topCommands: Array<{ command: string; count: number; successRate: number }>;
  };
  storage: {
    vaults: { count: number; totalEntries: number };
    snippets: { count: number };
    keys: { count: number };
  };
  team: {
    memberCount: number;
    activeMembers: number;
    memberActivity: Array<{ userId: string; sessionsCount: number; commandsCount: number; lastActiveAt: string | null }>;
    teamSessions: number;
    teamCommands: number;
  } | null;
  period: number;
}

interface ConnectionHistoryEntry {
  date: string;
  total: number;
  successful: number;
  failed: number;
  avgDuration: number;
}

interface HostUsageEntry {
  hostId: string;
  hostName: string;
  hostAddress: string;
  connectionCount: number;
  lastConnectedAt: string | null;
  avgDurationSeconds: number;
  totalDurationSeconds: number;
  successRate: number;
}

interface UseAnalyticsState {
  overview: AnalyticsOverview | null;
  connectionHistory: ConnectionHistoryEntry[];
  hostUsage: HostUsageEntry[];
  loading: boolean;
  error: string | null;
  period: number;
  setPeriod: (days: number) => void;
  refresh: () => void;
  exportCsv: () => Promise<void>;
}

export function useAnalytics(initialPeriod: number = 30): UseAnalyticsState {
  const { auth } = useStore();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistoryEntry[]>([]);
  const [hostUsage, setHostUsage] = useState<HostUsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(initialPeriod);

  const fetchData = useCallback(async () => {
    if (!auth.isAuthenticated || !auth.accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const api = getAnalyticsApi();
      api.setToken(auth.accessToken);

      const teamId = localStorage.getItem('teamId') || undefined;

      const [overviewData, historyData, hostsData] = await Promise.all([
        api.getOverview(teamId, period),
        api.getConnectionHistory(period),
        api.getHostUsage(period),
      ]);

      setOverview(overviewData);
      setConnectionHistory(historyData);
      setHostUsage(hostsData);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [auth.isAuthenticated, auth.accessToken, period]);

  useEffect(() => {
    const controller = new AbortController();
    fetchData();
    return () => controller.abort();
  }, [fetchData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const exportCsv = useCallback(async () => {
    if (!auth.accessToken) return;
    const api = getAnalyticsApi();
    api.setToken(auth.accessToken);
    await api.exportCsv(period);
  }, [auth.accessToken, period]);

  return {
    overview,
    connectionHistory,
    hostUsage,
    loading,
    error,
    period,
    setPeriod,
    refresh,
    exportCsv,
  };
}
