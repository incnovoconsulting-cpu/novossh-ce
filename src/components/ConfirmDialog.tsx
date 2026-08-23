import { AlertTriangle } from '@/lib/icons';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClass =
    confirmVariant === 'danger'
      ? 'bg-terminal-red text-white hover:bg-terminal-red/80'
      : 'bg-terminal-amber text-ink-950 hover:bg-terminal-amber/80';

  return (
    <Dialog open={open} onClose={onCancel} title={title} size="sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terminal-red/10">
          <AlertTriangle className="h-4 w-4 text-terminal-red" />
        </div>
        <p className="text-sm text-slate-300">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-white/[0.08] bg-white/5 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
