import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ConnectionChartProps {
  data: Array<{ date: string; total: number; successful: number; failed: number }>;
  connectionTypes?: { direct: number; relay: number; tailscale: number };
}

type ViewMode = 'success-failure' | 'by-type';

export default function ConnectionChart({ data, connectionTypes }: ConnectionChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('success-failure');

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const chartData = data.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Connection History</h3>
        <div className="flex gap-1 rounded-md bg-ink-900 p-0.5">
          <button
            onClick={() => setViewMode('success-failure')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'success-failure'
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Success/Failure
          </button>
          <button
            onClick={() => setViewMode('by-type')}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === 'by-type'
                ? 'bg-white/10 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            By Type
          </button>
        </div>
      </div>

      {viewMode === 'success-failure' ? (
        <div className="h-64">
          {chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              No connection data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: 12,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  name="Total"
                />
                <Line
                  type="monotone"
                  dataKey="successful"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  name="Successful"
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  name="Failed"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {connectionTypes ? (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Direct', value: connectionTypes.direct, color: 'bg-indigo-500' },
                { label: 'Relay', value: connectionTypes.relay, color: 'bg-amber-500' },
                { label: 'Tailscale', value: connectionTypes.tailscale, color: 'bg-cyan-500' },
              ].map((item) => {
                const total = connectionTypes.direct + connectionTypes.relay + connectionTypes.tailscale;
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={item.label} className="rounded-lg bg-ink-900 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-400">{item.label}</span>
                      <span className="text-lg font-bold text-white">{item.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{pct.toFixed(1)}% of total</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-sm text-slate-500">
              No connection type data available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
