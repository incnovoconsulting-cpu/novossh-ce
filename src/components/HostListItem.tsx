import { Pencil, PlayCircle, MoreVertical, Trash2, Plus, Wifi, Globe, Server } from '@/lib/icons';
import { useState } from 'react';
import type { Host } from '../lib/types';
import { initials, colorFor, timeAgo } from '../lib/format';
import { useStore } from '../lib/store';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  host: Host;
  onConnect: () => void;
  onEdit: () => void;
}

export function HostListItem({ host, onConnect, onEdit }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteHost = useStore((s) => s.deleteHost);
  const openTab = useStore((s) => s.openTab);
  const color = host.color ?? colorFor(host.label);

  return (
    <div
      className="group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-white/[0.03] transition-colors duration-100"
      onDoubleClick={onConnect}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white/90 ring-1 ring-white/[0.06]"
        style={{ background: color }}
      >
        {initials(host.label)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-200">{host.label}</span>
          {host.connectionMode === 'tailscale' && (
            <span title="Tailscale"><Wifi className="h-3 w-3 text-green-400 flex-shrink-0" /></span>
          )}
          {host.connectionMode === 'direct' && (
            <span title="Direct"><Globe className="h-3 w-3 text-blue-400 flex-shrink-0" /></span>
          )}
          {host.connectionMode === 'relay' && (
            <span title="Relay"><Server className="h-3 w-3 text-amber-400 flex-shrink-0" /></span>
          )}
        </div>
        <div className="flex items-center gap-1 truncate text-[10px] text-slate-500/70 font-mono">
          <span className="truncate">
            {host.username}@{host.address}:{host.port}
          </span>
          {host.lastConnectedAt && (
            <>
              <span className="text-slate-700/50 mx-0.5">/</span>
              <span className="text-slate-500/50">{timeAgo(host.lastConnectedAt)}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
        <button
          onClick={onConnect}
          className="rounded p-1 text-slate-400 hover:bg-neon/10 hover:text-neon transition-colors"
          title="Connect"
        >
          <PlayCircle className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onEdit}
          className="rounded p-1 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 transition-colors"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-1 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 transition-colors"
            title="More"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg bg-ink-700 p-1 shadow-xl ring-1 ring-white/[0.08]">
                <button
                  onClick={() => { openTab(host.id); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.06] transition-colors"
                >
                  <Plus className="h-3 w-3" /> Open in new tab
                </button>
                <button
                  onClick={() => { onConnect(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.06] transition-colors"
                >
                  <PlayCircle className="h-3 w-3" /> Quick Connect
                </button>
                <button
                  onClick={() => { onEdit(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/[0.06] transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Edit host
                </button>
                <div className="my-1 h-px bg-white/[0.06]" />
                <button
                  onClick={() => {
                    setConfirmDelete(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-terminal-red hover:bg-terminal-red/10 transition-colors"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete host"
        message={`Are you sure you want to delete "${host.label}"? This action cannot be undone.`}
        onConfirm={() => { deleteHost(host.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
