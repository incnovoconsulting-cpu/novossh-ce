import { Server, Code2, KeyRound, History, Plus } from '@/lib/icons';
import clsx from 'clsx';
import type { ViewKey } from '../lib/types';

const navItems: { key: ViewKey; label: string; icon: typeof Server }[] = [
  { key: 'hosts', label: 'Hosts', icon: Server },
  { key: 'snippets', label: 'Snippets', icon: Code2 },
  { key: 'keys', label: 'Keys', icon: KeyRound },
  { key: 'history', label: 'History', icon: History },
];

interface Props {
  currentView: ViewKey;
  onViewChange: (v: ViewKey) => void;
  onNewHost: () => void;
}

export function MobileNav({ currentView, onViewChange, onNewHost }: Props) {
  return (
    <nav className="flex h-14 items-center justify-around border-t border-white/[0.04] bg-ink-900 px-2 safe-area-bottom">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = currentView === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onViewChange(item.key)}
            className={clsx(
              'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 transition-colors min-w-[56px]',
              active ? 'text-neon' : 'text-slate-500',
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
      <button
        onClick={onNewHost}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-neon text-ink-950 shadow-lg shadow-neon/20"
        aria-label="Add host"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </nav>
  );
}
