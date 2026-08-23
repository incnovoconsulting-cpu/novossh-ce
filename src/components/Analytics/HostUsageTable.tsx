import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from '@/lib/icons';

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

interface HostUsageTableProps {
  hosts: HostUsageEntry[];
}

type SortKey = 'hostName' | 'connectionCount' | 'lastConnectedAt' | 'avgDurationSeconds' | 'successRate';
type SortDir = 'asc' | 'desc';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HostUsageTable({ hosts }: HostUsageTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('connectionCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let result = [...hosts];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (h) =>
          h.hostName.toLowerCase().includes(q) ||
          h.hostAddress.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let aVal: string | number | null = a[sortKey];
      let bVal: string | number | null = b[sortKey];
      if (sortKey === 'lastConnectedAt') {
        aVal = aVal ? new Date(aVal as string).getTime() : 0;
        bVal = bVal ? new Date(bVal as string).getTime() : 0;
      }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      const aNum = (aVal ?? 0) as number;
      const bNum = (bVal ?? 0) as number;
      if (aNum < bNum) return sortDir === 'asc' ? -1 : 1;
      if (aNum > bNum) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [hosts, sortKey, sortDir, search]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-neon" />
    ) : (
      <ArrowDown className="h-3 w-3 text-neon" />
    );
  };

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: 'hostName', label: 'Host' },
    { key: 'connectionCount', label: 'Connections' },
    { key: 'lastConnectedAt', label: 'Last Connected' },
    { key: 'avgDurationSeconds', label: 'Avg Duration' },
    { key: 'successRate', label: 'Success Rate' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Host Usage</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search hosts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded-md bg-ink-900 border border-white/[0.04] pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-neon/30"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/[0.04]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.04] bg-ink-900/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="cursor-pointer select-none px-4 py-2.5 text-left text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    <SortIcon column={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  {search ? 'No hosts match your search' : 'No host data for this period'}
                </td>
              </tr>
            ) : (
              filtered.map((host) => (
                <tr
                  key={host.hostId}
                  className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{host.hostName}</p>
                      <p className="text-xs text-slate-500 font-mono">{host.hostAddress}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-200 font-semibold">
                    {host.connectionCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {formatDate(host.lastConnectedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {formatDuration(host.avgDurationSeconds)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 overflow-hidden rounded-full bg-ink-700">
                        <div
                          className={`h-full rounded-full ${
                            host.successRate >= 95
                              ? 'bg-green-500'
                              : host.successRate >= 80
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${host.successRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{host.successRate.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
