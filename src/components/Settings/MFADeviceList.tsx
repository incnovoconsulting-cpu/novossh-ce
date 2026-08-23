import { useState } from 'react';
import { Trash2, Edit3, Check, X, Loader, Monitor, Smartphone, Usb, Shield } from '@/lib/icons';
import clsx from 'clsx';
import type { MFACredential } from '../../hooks/useMFA';

interface MFADeviceListProps {
  credentials: MFACredential[];
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
}

function getDeviceIcon(transports?: string[]) {
  if (!transports || transports.length === 0) return Shield;
  if (transports.includes('usb')) return Usb;
  if (transports.includes('internal')) return Monitor;
  return Smartphone;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MFADeviceList({ credentials, onDelete, onRename }: MFADeviceListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleStartEdit = (cred: MFACredential) => {
    setEditingId(cred.id);
    setEditName(cred.name);
  };

  const handleSaveRename = async () => {
    if (!editingId || !editName.trim()) return;
    setSavingId(editingId);
    try {
      await onRename(editingId, editName.trim());
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (credentials.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/[0.08] bg-ink-900/50 px-4 py-8 text-center">
        <Shield className="mx-auto mb-3 h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-400">No devices registered yet</p>
        <p className="mt-1 text-xs text-slate-500">Add a security key or biometric device to enable MFA</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {credentials.map((cred) => {
        const Icon = getDeviceIcon(cred.transports);
        const isEditing = editingId === cred.id;
        const isDeleting = deletingId === cred.id;
        const isConfirmingDelete = confirmDeleteId === cred.id;

        return (
          <div
            key={cred.id}
            className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-ink-900 px-4 py-3"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ink-800">
              <Icon className="h-4 w-4 text-slate-400" />
            </div>

            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="input flex-1 py-1 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveRename}
                    disabled={savingId === cred.id}
                    className="rounded p-1 text-green-400 hover:bg-white/5"
                  >
                    {savingId === cred.id ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded p-1 text-slate-400 hover:bg-white/5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="truncate text-sm font-medium text-slate-200">{cred.name}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Added {formatDate(cred.created_at)}</span>
                    {cred.last_used_at && (
                      <>
                        <span className="text-slate-700">|</span>
                        <span>Last used {formatDate(cred.last_used_at)}</span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-center gap-1">
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1">
                    <span className="text-[11px] text-red-400">Delete?</span>
                    <button
                      onClick={() => handleDelete(cred.id)}
                      disabled={isDeleting}
                      className="rounded p-0.5 text-red-400 hover:bg-red-500/20"
                    >
                      {isDeleting ? (
                        <Loader className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded p-0.5 text-slate-400 hover:bg-white/5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleStartEdit(cred)}
                      className="rounded p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-300"
                      title="Rename"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(cred.id)}
                      className="rounded p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
