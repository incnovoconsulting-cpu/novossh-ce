import { Code2, Copy, Trash2 } from '@/lib/icons';
import { useState } from 'react';
import { useStore } from '../lib/store';
import type { Snippet } from '../lib/types';
import { ConfirmDialog } from './ConfirmDialog';

export function SnippetListItem({ snippet }: { snippet: Snippet }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteSnippet = useStore((s) => s.deleteSnippet);

  return (
    <div className="group rounded-md border border-transparent px-2 py-2 hover:border-white/[0.04] hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5 text-slate-500" />
            <span className="truncate text-sm font-medium text-slate-100">{snippet.label}</span>
          </div>
          <code className="mt-1 block truncate font-mono text-[11px] text-slate-400">
            {snippet.command}
          </code>
          {snippet.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {snippet.tags.map((t) => (
                <span key={t} className="chip">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0.5 opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
          <button
            onClick={() => navigator.clipboard?.writeText(snippet.command)}
            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-200"
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete snippet"
        message={`Are you sure you want to delete "${snippet.label}"? This action cannot be undone.`}
        onConfirm={() => { deleteSnippet(snippet.id); setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
