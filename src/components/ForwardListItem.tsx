import { Network, Trash2 } from '@/lib/icons';
import { useState } from 'react';
import { useStore } from '../lib/store';
import type { PortForward } from '../lib/types';
import { ConfirmDialog } from './ConfirmDialog';

export function ForwardListItem({ forward }: { forward: PortForward }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hosts = useStore((s) => s.hosts);
  const deleteForward = useStore((s) => s.deleteForward);
  const host = hosts.find((h) => h.id === forward.hostId);

  const summary =
    forward.type === 'dynamic'
      ? `SOCKS on ${forward.bindAddress}:${forward.bindPort}`
      : `${forward.bindAddress}:${forward.bindPort} → ${forward.destinationHost}:${forward.destinationPort}`;

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.04]">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300">
        <Network className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-slate-100">{forward.label}</span>
          <span className="chip uppercase">{forward.type}</span>
        </div>
        <div className="truncate text-[11px] text-slate-500">
          {summary} {host ? `· via ${host.label}` : ''}
        </div>
      </div>
      <button
        onClick={() => setConfirmDelete(true)}
        className="opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete port forward"
        message={`Are you sure you want to delete "${forward.label}"? This action cannot be undone.`}
        onConfirm={() => { deleteForward(forward.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
