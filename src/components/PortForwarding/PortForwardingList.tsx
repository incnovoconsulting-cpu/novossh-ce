import { useState } from 'react';
import {
  Network,
  Trash2,
  Play,
  Pause,
  Pencil,
  ArrowRight,
  Upload,
  Shield,
  ChevronDown,
  ChevronUp,
  Activity,
} from '@/lib/icons';
import type { PortForward, PortForwardingStatus } from '../../lib/types';
import { usePortForwarding } from '../../hooks/usePortForwarding';
import { useStore } from '../../lib/store';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function TypeIcon({ type }: { type: PortForward['type'] }) {
  if (type === 'remote') return <Upload className="h-3.5 w-3.5" />;
  if (type === 'dynamic') return <Shield className="h-3.5 w-3.5" />;
  return <ArrowRight className="h-3.5 w-3.5" />;
}

interface ForwardItemProps {
  forward: PortForward;
  status?: PortForwardingStatus;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (forward: PortForward) => void;
}

function ForwardItem({ forward, status, onToggle, onDelete, onEdit }: ForwardItemProps) {
  const hosts = useStore((s) => s.hosts);
  const host = hosts.find((h) => h.id === forward.hostId);
  const [expanded, setExpanded] = useState(false);

  const isDynamic = forward.type === 'dynamic';
  const summary = isDynamic
    ? `SOCKS on ${forward.bindAddress}:${forward.bindPort}`
    : `${forward.bindAddress}:${forward.bindPort} → ${forward.destinationHost}:${forward.destinationPort}`;

  return (
    <div className="rounded-lg border border-white/[0.04] bg-ink-800 transition-colors hover:border-white/[0.08]">
      <div className="flex items-center gap-3 p-3">
        {/* Status dot */}
        <div className="relative">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-md ${
              forward.active
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-white/[0.04] text-slate-500'
            }`}
          >
            <TypeIcon type={forward.type} />
          </div>
          {forward.active && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-100">{forward.label}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                forward.type === 'local'
                  ? 'bg-blue-500/15 text-blue-300'
                  : forward.type === 'remote'
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-purple-500/15 text-purple-300'
              }`}
            >
              {forward.type}
            </span>
            {forward.autoStart && (
              <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-400">
                auto
              </span>
            )}
          </div>
          <div className="truncate text-[11px] text-slate-500">
            {summary} {host ? `· ${host.label}` : ''}
          </div>
        </div>

        {/* Stats (when active) */}
        {status && forward.active && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400 hover:bg-white/[0.06]"
          >
            <Activity className="h-3 w-3 text-emerald-400" />
            {status.connections} conn
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle(forward.id, forward.active ?? false)}
            className={`rounded-md p-1.5 transition-colors ${
              forward.active
                ? 'text-emerald-400 hover:bg-emerald-500/10'
                : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
            }`}
            title={forward.active ? 'Stop' : 'Start'}
          >
            {forward.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onEdit(forward)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(forward.id)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded stats */}
      {expanded && status && forward.active && (
        <div className="grid grid-cols-4 gap-4 border-t border-white/[0.04] px-4 py-2.5">
          <div>
            <span className="text-[10px] text-slate-500">Connections</span>
            <p className="text-xs font-medium text-slate-200">{status.connections}</p>
          </div>
          <div>
            <span className="text-[10px] text-slate-500">Bytes In</span>
            <p className="text-xs font-medium text-slate-200">{formatBytes(status.bytesIn)}</p>
          </div>
          <div>
            <span className="text-[10px] text-slate-500">Bytes Out</span>
            <p className="text-xs font-medium text-slate-200">{formatBytes(status.bytesOut)}</p>
          </div>
          <div>
            <span className="text-[10px] text-slate-500">Status</span>
            <p className="text-xs font-medium text-emerald-400">Active</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function PortForwardingList() {
  const {
    forwards,
    activateForward,
    deactivateForward,
    deleteForward,
    getStatus,
    error,
  } = usePortForwarding();
  const [editingForward, setEditingForward] = useState<PortForward | null>(null);

  const handleToggle = async (id: string, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        await deactivateForward(id);
      } else {
        await activateForward(id);
      }
    } catch {
      // Error handled by hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteForward(id);
    } catch {
      // Error handled by hook
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-400">{error}</div>
      )}

      {forwards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Network className="mb-4 h-12 w-12 text-slate-600" />
          <h3 className="mb-1 text-base font-medium text-slate-400">No forwards configured</h3>
          <p className="text-sm text-slate-500">
            Use the wizard or templates to set up port forwarding
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Active Forwards ({forwards.filter((f) => f.active).length}/{forwards.length})
            </h3>
          </div>
          <div className="space-y-2">
            {forwards.map((f) => (
              <ForwardItem
                key={f.id}
                forward={f}
                status={getStatus(f.id)}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onEdit={setEditingForward}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
