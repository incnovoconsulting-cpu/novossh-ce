import { X, Plus } from '@/lib/icons';
import { AppLogo } from './AppLogo';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import type { TerminalStatus } from '../lib/types';

function StatusDot({ status }: { status: TerminalStatus }) {
  const map: Record<TerminalStatus, { color: string; glow: string; pulse?: boolean }> = {
    idle: { color: 'bg-slate-500', glow: '' },
    connecting: { color: 'bg-terminal-amber', glow: 'shadow-neon-amber', pulse: true },
    connected: { color: 'bg-terminal-green', glow: 'shadow-neon-green' },
    error: { color: 'bg-terminal-red', glow: 'shadow-neon-red' },
    disconnected: { color: 'bg-slate-600', glow: '' },
  };
  const { color, glow, pulse } = map[status];
  return (
    <span
      className={clsx(
        'h-2 w-2 rounded-full flex-shrink-0',
        color,
        glow,
        pulse && 'animate-pulse-neon',
      )}
    />
  );
}

export function TabBar() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const closeTab = useStore((s) => s.closeTab);
  const openTab = useStore((s) => s.openTab);

  return (
    <div className="flex h-9 items-center gap-1 border-b border-white/[0.04] bg-ink-900/80 px-2 backdrop-blur-sm">
      <div className="flex flex-1 items-center gap-px overflow-x-auto">
        {tabs.map((t) => {
          const active = t.id === activeTabId;
          return (
            <div
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'group flex h-7 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-all duration-150',
                active
                  ? 'border-neon/10 bg-ink-800 text-slate-200 shadow-glow-sm'
                  : 'border-transparent text-slate-500 hover:bg-white/[0.03] hover:text-slate-300',
              )}
            >
              <StatusDot status={t.status} />
              <AppLogo className="h-3 w-3 opacity-50" />
              <span className="max-w-[160px] truncate">{t.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(t.id);
                }}
                className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-white/[0.08] group-hover:opacity-100"
                aria-label="Close tab"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}

        <button
          onClick={() => openTab()}
          className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-600 hover:bg-white/[0.04] hover:text-slate-400 transition-colors"
          title="New tab"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
