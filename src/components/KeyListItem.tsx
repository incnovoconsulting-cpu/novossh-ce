import { KeyRound, Trash2 } from '@/lib/icons';
import { useState } from 'react';
import { useStore } from '../lib/store';
import type { IdentityKey } from '../lib/types';
import { timeAgo } from '../lib/format';
import { ConfirmDialog } from './ConfirmDialog';

export function KeyListItem({ k }: { k: IdentityKey }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteKey = useStore((s) => s.deleteKey);
  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/[0.04]">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-500/15 text-violet-300">
        <KeyRound className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-100">{k.label}</div>
        <div className="text-[11px] text-slate-500">
          {k.hasPassphrase ? 'Encrypted' : 'Unencrypted'} · added {timeAgo(k.createdAt)}
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
        title="Delete key"
        message={`Are you sure you want to delete "${k.label}"? This action cannot be undone.`}
        onConfirm={() => { deleteKey(k.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
