import { X } from '@/lib/icons';
import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, description, children, size = 'md', footer, className }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={clsx(
          'relative z-10 w-full overflow-hidden border border-white/[0.06] bg-ink-800 shadow-2xl animate-slide-up flex flex-col',
          'mx-0 max-h-[85vh] rounded-t-2xl sm:mx-4 sm:rounded-xl sm:max-h-[80vh]',
          size === 'sm' && 'sm:max-w-sm',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-3xl',
        )}
      >
        {(title || description) && (
          <div className="flex-shrink-0 flex items-start justify-between border-b border-white/[0.04] px-5 py-3.5">
            <div>
              {title && <h2 className="text-sm font-semibold text-slate-100">{title}</h2>}
              {description && <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>}
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className={clsx("flex-1 overflow-y-auto px-5 py-4", className)}>{children}</div>
        {footer && <div className="flex-shrink-0 border-t border-white/[0.04] bg-ink-900/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
