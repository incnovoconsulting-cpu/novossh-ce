import { Server, Code2, KeyRound, Network, History, Settings, LogOut, BarChart3, BookOpen, FolderOpen, Wifi, Shield, Play, Lock, ShieldCheck } from '@/lib/icons';
import { AppLogo } from './AppLogo';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import type { ViewKey } from '../lib/types';

const items: { key: ViewKey; label: string; icon: typeof Server }[] = [
  { key: 'hosts', label: 'Hosts', icon: Server },
  { key: 'snippets', label: 'Snippets', icon: Code2 },
  { key: 'keys', label: 'Keychain', icon: KeyRound },
  { key: 'portforwarding', label: 'Port Forwarding', icon: Network },
  { key: 'sftp', label: 'SFTP Browser', icon: FolderOpen },
  { key: 'vault', label: 'Vault', icon: Lock },
  { key: 'history', label: 'History', icon: History },
  { key: 'sessions', label: 'Sessions', icon: Play },
  { key: 'logs', label: 'Logs', icon: BookOpen },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'p2p', label: 'P2P Sync', icon: Wifi },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'wiki', label: 'Docs', icon: BookOpen },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export function NavRail() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const clearAuth = useStore((s) => s.clearAuth);
  const isOwner = useStore((s) => s.isOwner);

  const handleLogout = () => {
    localStorage.removeItem('novossh-auth');
    clearAuth();
    window.location.reload();
  };

  return (
    <aside className="flex h-full w-[52px] flex-col items-center border-r border-white/[0.04] bg-ink-900 py-3 gap-1">
      <div className="mb-3">
        <AppLogo className="h-9 w-9" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = view === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setView(it.key)}
              className={clsx(
                'has-tip relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150',
                active
                  ? 'bg-neon/10 text-neon shadow-glow-sm'
                  : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300',
              )}
              aria-label={it.label}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-neon" />
              )}
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
              <span className="tip">{it.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1">
        {isOwner && (
          <button
            onClick={() => setView('admin')}
            className={clsx(
              'has-tip relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150',
              view === 'admin'
                ? 'bg-neon/10 text-neon shadow-glow-sm'
                : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300',
            )}
            aria-label="Admin"
          >
            {view === 'admin' && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-neon" />
            )}
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.5} />
            <span className="tip">Admin</span>
          </button>
        )}
        <button
          onClick={handleLogout}
          className="has-tip relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-terminal-red/10 hover:text-terminal-red transition-all duration-150"
          aria-label="Logout"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
          <span className="tip">Logout</span>
        </button>
      </div>
    </aside>
  );
}
