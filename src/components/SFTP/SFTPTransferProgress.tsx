import { X, Upload, Download } from '@/lib/icons';
import type { SFTPTransferJob } from '../../lib/sftpApi';

interface SFTPTransferProgressProps {
  transfers: SFTPTransferJob[];
  onCancel: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
}

export default function SFTPTransferProgress({ transfers, onCancel }: SFTPTransferProgressProps) {
  if (transfers.length === 0) return null;

  return (
    <div className="border-t border-white/[0.04] bg-ink-800/50 px-3 py-2">
      <div className="text-xs font-medium text-slate-400 mb-1">
        Transfers ({transfers.length})
      </div>
      {transfers.map((t) => (
        <div key={t.id} className="flex items-center gap-3 py-1">
          <div className="flex-shrink-0">
            {t.type === 'upload' ? (
              <Upload className="h-3 w-3 text-emerald-400" />
            ) : (
              <Download className="h-3 w-3 text-sky-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-300 truncate">{t.fileName}</div>
            <div className="mt-0.5 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500/80 transition-all"
                style={{ width: `${t.progress}%` }}
              />
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500">
              {formatBytes(t.bytesTransferred)} / {formatBytes(t.bytesTotal)}
            </div>
          </div>
          {t.status === 'in-progress' && (
            <button
              onClick={() => onCancel(t.id)}
              className="flex-shrink-0 rounded p-0.5 text-slate-500 hover:text-red-400"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
