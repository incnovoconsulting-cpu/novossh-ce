import { useRef, ChangeEvent } from 'react';
import {
  Upload,
  Download,
  FolderPlus,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowLeft,
} from '@/lib/icons';

interface SFTPToolbarProps {
  onUpload: (files: File[]) => Promise<void>;
  onDownload: () => void;
  onDelete: () => void;
  onCreateFolder: () => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
  currentPath: string;
  onPathNavigate: (path: string) => Promise<void>;
  isConnected: boolean;
  loading: boolean;
  canDelete: boolean;
  canDownload: boolean;
}

export default function SFTPToolbar({
  onUpload,
  onDownload,
  onDelete,
  onCreateFolder,
  onRefresh,
  onToggleHidden,
  currentPath,
  onPathNavigate,
  isConnected,
  loading,
  canDelete,
  canDownload,
}: SFTPToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) await onUpload(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      onPathNavigate('/' + parts.join('/') || '/');
    }
  };

  return (
    <div className="flex items-center gap-1 border-b border-white/[0.04] bg-ink-800 px-3 py-2">
      <button
        onClick={goUp}
        disabled={!isConnected || loading || currentPath === '/'}
        className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Go up one level"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-white/[0.06]" />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={!isConnected || loading}
        className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Upload"
      >
        <Upload className="h-4 w-4" />
      </button>

      <button
        onClick={onDownload}
        disabled={!isConnected || loading || !canDownload}
        className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Download"
      >
        <Download className="h-4 w-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-white/[0.06]" />

      <button
        onClick={onCreateFolder}
        disabled={!isConnected || loading}
        className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
        title="New folder"
      >
        <FolderPlus className="h-4 w-4" />
      </button>

      <button
        onClick={onDelete}
        disabled={!isConnected || loading || !canDelete}
        className="rounded p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="mx-1 h-4 w-px bg-white/[0.06]" />

      <button
        onClick={onRefresh}
        disabled={!isConnected || loading}
        className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Refresh"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </button>

      <button
        onClick={onToggleHidden}
        disabled={!isConnected || loading}
        className="rounded p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Toggle hidden files"
      >
        <EyeOff className="h-4 w-4" />
      </button>

      <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
        <span
          className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-slate-600'}`}
        />
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={!isConnected || loading}
      />
    </div>
  );
}
