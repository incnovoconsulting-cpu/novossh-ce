import { useState, useRef, useEffect } from 'react';
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  FileArchive,
  FileJson,
  FileKey,
  ChevronUp,
  ChevronDown,
} from '@/lib/icons';
import type { SFTPFileEntry } from '../../lib/sftpApi';
import type { SortField, SortDirection } from '../../hooks/useSFTP';

interface SFTPFileListProps {
  files: SFTPFileEntry[];
  selectedFiles: SFTPFileEntry[];
  sortField: SortField;
  sortDir: SortDirection;
  onSelectFile: (file: SFTPFileEntry, multi: boolean) => void;
  onDoubleClick: (file: SFTPFileEntry) => void;
  onContextMenu: (e: React.MouseEvent, file: SFTPFileEntry) => void;
  renameTarget: string | null;
  renameValue: string;
  onRenameChange: (val: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
}

function getFileIcon(file: SFTPFileEntry) {
  if (file.isDirectory) return <Folder className="h-4 w-4 text-amber-400" />;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'c', 'cpp', 'h', 'sh', 'bash', 'zsh'].includes(ext))
    return <FileCode className="h-4 w-4 text-emerald-400" />;
  if (['json', 'yaml', 'yml', 'toml', 'xml', 'ini', 'conf', 'cfg'].includes(ext))
    return <FileJson className="h-4 w-4 text-sky-400" />;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext))
    return <FileImage className="h-4 w-4 text-pink-400" />;
  if (['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar'].includes(ext))
    return <FileArchive className="h-4 w-4 text-orange-400" />;
  if (['pem', 'key', 'crt', 'pub'].includes(ext))
    return <FileKey className="h-4 w-4 text-yellow-400" />;
  if (['md', 'txt', 'log', 'csv'].includes(ext))
    return <FileText className="h-4 w-4 text-blue-400" />;
  return <File className="h-4 w-4 text-slate-400" />;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SortButton({ field, current, dir, onClick }: { field: SortField; current: SortField; dir: SortDirection; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 hover:text-slate-200">
      {field === current && (dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  );
}

export default function SFTPFileList({
  files,
  selectedFiles,
  sortField,
  sortDir,
  onSelectFile,
  onDoubleClick,
  onContextMenu,
  renameTarget,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
}: SFTPFileListProps) {
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renameTarget && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameTarget]);

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-500">
        Empty directory
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-white/[0.04] bg-ink-800/50 px-3 py-1.5 text-xs font-medium text-slate-500">
        <div className="w-5" />
        <div className="flex-1">
          Name
          <SortButton field="name" current={sortField} dir={sortDir} onClick={() => {}} />
        </div>
        <div className="w-24 text-right">
          Size
          <SortButton field="size" current={sortField} dir={sortDir} onClick={() => {}} />
        </div>
        <div className="w-36 text-right">
          Modified
          <SortButton field="modifyTime" current={sortField} dir={sortDir} onClick={() => {}} />
        </div>
        <div className="w-24 text-right">Perms</div>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {files.map((file) => {
          const isSelected = selectedFiles.some((f) => f.path === file.path);
          const isRenaming = renameTarget === file.path;

          return (
            <div
              key={file.path}
              className={`flex items-center gap-3 border-b border-white/[0.02] px-3 py-2 text-sm transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-violet-500/10 border-l-2 border-l-violet-500'
                  : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
              }`}
              onClick={(e) => onSelectFile(file, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => onDoubleClick(file)}
              onContextMenu={(e) => onContextMenu(e, file)}
            >
              <div className="w-5 flex-shrink-0">
                {getFileIcon(file)}
              </div>

              <div className="min-w-0 flex-1">
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => onRenameChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onRenameSubmit();
                      if (e.key === 'Escape') onRenameCancel();
                    }}
                    onBlur={onRenameSubmit}
                    className="w-full rounded border border-violet-500/50 bg-ink-900 px-2 py-0.5 text-sm text-slate-100 outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={`truncate block ${file.isDirectory ? 'text-amber-300 font-medium' : 'text-slate-200'}`}>
                    {file.name}
                  </span>
                )}
              </div>

              <div className="w-24 text-right text-xs text-slate-500">
                {file.isDirectory ? '—' : formatSize(file.size)}
              </div>

              <div className="w-36 text-right text-xs text-slate-500">
                {formatDate(file.modifyTime)}
              </div>

              <div className="w-24 text-right text-xs font-mono text-slate-600">
                {file.permissions}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
