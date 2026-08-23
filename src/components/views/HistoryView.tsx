import { History } from '@/lib/icons';
import { useStore } from '../../lib/store';
import { colorFor, initials, timeAgo } from '../../lib/format';

export function HistoryView() {
  const hosts = useStore((s) => s.hosts);
  const openTab = useStore((s) => s.openTab);

  const recent = [...hosts]
    .filter((h) => h.lastConnectedAt)
    .sort((a, b) => (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">History</h1>
          <p className="text-sm text-slate-400">Hosts you've connected to recently.</p>
        </div>
      </div>

      <div className="mt-8 space-y-2">
        {recent.map((h) => {
          const color = h.color ?? colorFor(h.label);
          return (
            <button
              key={h.id}
              onClick={() => openTab(h.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-white/[0.04] bg-ink-800 p-3 text-left transition-colors hover:bg-ink-750"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold text-white"
                style={{ background: color }}
              >
                {initials(h.label)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-100">{h.label}</div>
                <div className="text-xs text-slate-500">
                  {h.username}@{h.address}:{h.port}
                </div>
              </div>
              <div className="text-sm text-slate-500">{timeAgo(h.lastConnectedAt)}</div>
            </button>
          );
        })}
        {recent.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History className="h-12 w-12 text-slate-600 mb-4" />
            <h2 className="text-lg text-slate-400 font-medium mb-1">No session history yet</h2>
            <p className="text-sm text-slate-500">Connect to a host to start building history</p>
          </div>
        )}
      </div>
    </div>
  );
}
