interface SFTPStatusBarProps {
  currentPath: string;
  fileCount: number;
  selectedCount: number;
  isConnected: boolean;
}

export default function SFTPStatusBar({
  currentPath,
  fileCount,
  selectedCount,
  isConnected,
}: SFTPStatusBarProps) {
  return (
    <div className="flex items-center justify-between border-t border-white/[0.04] bg-ink-800/50 px-3 py-1.5 text-xs text-slate-500">
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`}
        />
        <span className="truncate max-w-[200px]">{currentPath}</span>
      </div>
      <div className="flex items-center gap-3">
        {selectedCount > 0 && <span>{selectedCount} selected</span>}
        <span>{fileCount} items</span>
      </div>
    </div>
  );
}
