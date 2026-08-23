import { useEffect, useMemo, useState } from 'react';
import { Server, Plus, Code2, Search, Command } from '@/lib/icons';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import type { Host } from '../lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onConnect: (h: Host) => void;
  onNewHost: () => void;
}

interface PaletteItem {
  key: string;
  label: string;
  hint?: string;
  icon: typeof Server;
  onSelect: () => void;
}

export function CommandPalette({ open, onClose, onConnect, onNewHost }: Props) {
  const hosts = useStore((s) => s.hosts);
  const setView = useStore((s) => s.setView);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [
      ...hosts.map<PaletteItem>((h) => ({
        key: `host-${h.id}`,
        label: `Connect: ${h.label}`,
        hint: `${h.username}@${h.address}:${h.port}`,
        icon: Server,
        onSelect: () => {
          onConnect(h);
          onClose();
        },
      })),
      {
        key: 'action-new-host',
        label: 'New host...',
        hint: 'Shift+Cmd+N',
        icon: Plus,
        onSelect: () => {
          onNewHost();
          onClose();
        },
      },
      {
        key: 'action-view-snippets',
        label: 'View snippets',
        icon: Code2,
        onSelect: () => {
          setView('snippets');
          onClose();
        },
      },
      {
        key: 'action-view-hosts',
        label: 'View hosts',
        icon: Server,
        onSelect: () => {
          setView('hosts');
          onClose();
        },
      },
    ];
    if (!q) return list;
    const ql = q.toLowerCase();
    return list.filter((it) => it.label.toLowerCase().includes(ql) || (it.hint?.toLowerCase().includes(ql) ?? false));
  }, [hosts, q, setView, onConnect, onClose, onNewHost]);

  useEffect(() => {
    if (idx >= items.length) setIdx(0);
  }, [items.length, idx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        items[idx]?.onSelect();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, idx, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-white/[0.06] bg-ink-800 shadow-2xl animate-slide-up">
        <div className="flex items-center gap-3 border-b border-white/[0.04] px-4 py-3">
          <Search className="h-4 w-4 text-neon/60" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search hosts, run commands..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500/60"
          />
          <span className="inline-flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">
            <Command className="h-2.5 w-2.5" /> K
          </span>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto py-1">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <li key={it.key}>
                <button
                  onClick={it.onSelect}
                  onMouseEnter={() => setIdx(i)}
                  className={clsx(
                    'flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors duration-100',
                    i === idx ? 'bg-neon/[0.08] text-slate-100' : 'text-slate-400 hover:bg-white/[0.03]',
                  )}
                >
                  <Icon className="h-4 w-4 text-slate-500" strokeWidth={1.5} />
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="text-[10px] text-slate-600 font-mono">{it.hint}</span>}
                </button>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-slate-600 font-mono">No matches</li>
          )}
        </ul>
      </div>
    </div>
  );
}
export default CommandPalette;
