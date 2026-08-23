import { Activity, Zap, Clock, Server, Database, Download, RefreshCw } from '@/lib/icons';
import ConnectionChart from './ConnectionChart';
import HostUsageTable from './HostUsageTable';

interface OverviewData {
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

interface AnalyticsDashboardProps {
  overview: OverviewData | null;
  hostUsage: HostUsageEntry[];
  period: number;
  onPeriodChange: (days: number) => void;
  onRefresh: () => void;
  onExport: () => void;
  loading: boolean;
  error: string | null;
}

const PERIOD_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.04] bg-ink-800 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function AnalyticsDashboard({
  overview,
  hostUsage,
  period,
  onPeriodChange,
  onRefresh,
  onExport,
  loading,
  error,
}: AnalyticsDashboardProps) {
  if (loading && !overview) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-40 rounded bg-ink-700 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-48 rounded-lg bg-ink-700 animate-pulse" />
            <div className="h-8 w-8 rounded-lg bg-ink-700 animate-pulse" />
            <div className="h-8 w-24 rounded-lg bg-ink-700 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.04] bg-ink-800 p-5 animate-pulse">
              <div className="h-9 w-9 rounded-lg bg-ink-700 mb-3" />
              <div className="h-8 w-16 rounded bg-ink-700 mb-2" />
              <div className="h-3 w-24 rounded bg-ink-700" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/[0.04] bg-ink-800 p-6 animate-pulse">
          <div className="h-40 rounded bg-ink-700" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button onClick={onRefresh} className="text-xs text-neon hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const conn = overview?.connections;
  const sess = overview?.sessions;
  const cmd = overview?.commands;
  const storage = overview?.storage;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Usage analytics</h2>
          <p className="text-sm text-slate-400">Overview of your SSH connections and activity</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-ink-900 p-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onPeriodChange(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === opt.value
                    ? 'bg-neon text-ink-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={onRefresh}
            className="rounded-lg border border-white/[0.04] bg-ink-800 p-2 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-2 rounded-lg bg-neon px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-neon-600 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV

          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <OverviewCard
          icon={Zap}
          label="Total connections"
          value={conn?.totalConnections ?? 0}
          sub={`${conn?.successRate?.toFixed(1) ?? 100}% success rate`}
          color="bg-neon/10"
        />
        <OverviewCard
          icon={Clock}
          label="Avg session duration"
          value={sess ? formatDuration(sess.avgDurationSeconds) : '0s'}
          sub={`${sess?.totalSessions ?? 0} total sessions`}
          color="bg-terminal-amber/10"
        />
        <OverviewCard
          icon={Activity}
          label="Total commands"
          value={cmd?.totalCommands ?? 0}
          sub={`${cmd?.avgCommandsPerSession?.toFixed(1) ?? 0} avg per session`}
          color="bg-terminal-green/10"
        />
        <OverviewCard
          icon={Server}
          label="Active hosts"
          value={hostUsage.length}
          sub={`${hostUsage.reduce((s, h) => s + h.connectionCount, 0)} total connections`}
          color="bg-neon/[0.08]"
        />
      </div>

      <div className="rounded-xl border border-white/[0.04] bg-ink-800 p-6">
        <ConnectionChart
          data={conn?.connectionsByDay ?? []}
          connectionTypes={conn?.connectionsByType}
        />
      </div>

      <div className="rounded-xl border border-white/[0.04] bg-ink-800 p-6">
        <HostUsageTable hosts={hostUsage} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/[0.04] bg-ink-800 p-6">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Storage usage</h3>
          <div className="space-y-4">
            {storage && [
              { label: 'Vaults', count: storage.vaults.count, detail: `${storage.vaults.totalEntries} entries`, icon: Database },
              { label: 'Snippets', count: storage.snippets.count, detail: null, icon: Activity },
              { label: 'Keys', count: storage.keys.count, detail: null, icon: Zap },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-300">{item.label}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-white">{item.count}</span>
                  {item.detail && (
                    <span className="ml-2 text-xs text-slate-500">{item.detail}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.04] bg-ink-800 p-6">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Top commands</h3>
          <div className="space-y-3">
            {cmd?.topCommands && cmd.topCommands.length > 0 ? (
              cmd.topCommands.slice(0, 8).map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                    <code className="text-xs text-slate-300 font-mono truncate">{c.command}</code>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-xs text-slate-400">{c.count}x</span>
                    <span className={`text-xs ${c.successRate >= 95 ? 'text-green-400' : c.successRate >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {c.successRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No command data for this period</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
