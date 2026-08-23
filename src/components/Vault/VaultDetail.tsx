import { useState, FC } from 'react';
import type { ApiVault, ApiVaultEntry, ApiVaultShare } from '../../lib/vaultApi';
import type { SyncConflict } from '../../hooks/useSyncApi';
import { EntryList } from './EntryList';
import { CreateEntryDialog } from './CreateEntryDialog';
import { ShareVaultDialog } from './ShareVaultDialog';
import { ConflictResolver } from './ConflictResolver';
import styles from './VaultDetail.module.css';

interface VaultDetailProps {
  vault: ApiVault;
  entries: ApiVaultEntry[];
  shares: ApiVaultShare[];
  loading: boolean;
  isSyncing: boolean;
  syncProgress: number;
  conflicts: SyncConflict[];
  error: string | null;
  onSync: () => Promise<void>;
  onAddEntry: (type: string, name: string, plaintextData: string) => Promise<ApiVaultEntry>;
  onUpdateEntry: (entryId: string, updates: { name?: string; encryptedData?: string }) => Promise<ApiVaultEntry>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onDecryptEntry: (encryptedData: string) => Promise<string>;
  onShare: (userId: string, accessLevel: string) => Promise<ApiVaultShare>;
  onGenerateLink: (accessLevel: string, expiresIn?: number) => Promise<{ shareUrl: string; shareToken: string; expiresAt?: string }>;
  onResolveConflict: (entryId: string, resolution: 'local' | 'remote' | 'merge' | 'last-write-wins') => Promise<void>;
  onAutoResolve: () => Promise<void>;
}

export const VaultDetail: FC<VaultDetailProps> = ({
  vault,
  entries,
  shares: _shares,
  loading,
  isSyncing,
  syncProgress,
  conflicts,
  error,
  onSync,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onDecryptEntry,
  onShare,
  onGenerateLink,
  onResolveConflict,
  onAutoResolve,
}) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showConflictResolver, setShowConflictResolver] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync();
      if (conflicts.length > 0) setShowConflictResolver(true);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateEntry = async (type: string, name: string, plaintextData: string) => {
    await onAddEntry(type, name, plaintextData);
    setShowCreateDialog(false);
  };

  // Adapt server-snake_case fields to component expectations
  const adaptedEntries = entries.map((e) => ({
    ...e,
    vaultId: e.vault_id,
    encryptedData: e.encrypted_data,
    localVersion: e.local_version,
    deviceSyncId: e.device_sync_id,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    syncedAt: e.synced_at,
  }));

  if (loading && entries.length === 0) {
    return <div className={styles.loading}>Loading vault...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <h2>{vault.name}</h2>
          {vault.description && (
            <p className={styles.description}>{vault.description}</p>
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.syncButton}
            onClick={handleSync}
            disabled={isSyncing || syncing}
          >
            {isSyncing || syncing ? 'Syncing...' : 'Sync'}
          </button>

          <button className={styles.shareButton} onClick={() => setShowShareDialog(true)}>
            Share
          </button>

          <button
            className={styles.createButton}
            onClick={() => setShowCreateDialog(true)}
          >
            + Add Entry
          </button>
        </div>
      </div>

      {(isSyncing || syncing) && syncProgress > 0 && syncProgress < 100 && (
        <div className={styles.progressBar}>
          <div className={styles.progress} style={{ width: `${syncProgress}%` }} />
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className={styles.conflictAlert}>
          <strong>⚠️ {conflicts.length} conflict(s) detected</strong>
          <button onClick={() => setShowConflictResolver(true)}>Resolve</button>
        </div>
      )}

      <EntryList
        entries={adaptedEntries}
        vaultId={vault.id}
        onDelete={onDeleteEntry}
        onUpdate={async (entryId, updates) => { await onUpdateEntry(entryId, updates); }}
        onDecrypt={onDecryptEntry}
      />

      {showCreateDialog && (
        <CreateEntryDialog
          onCreate={handleCreateEntry}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {showShareDialog && (
        <ShareVaultDialog
          vaultId={vault.id}
          onShare={onShare}
          onGenerateLink={onGenerateLink}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      {showConflictResolver && (
        <ConflictResolver
          isOpen={showConflictResolver}
          conflicts={conflicts as any}
          onResolve={async (entryId, strategy) => {
            await onResolveConflict(entryId, strategy as 'local' | 'remote' | 'merge' | 'last-write-wins');
          }}
          onAutoResolve={async () => {
            await onAutoResolve();
          }}
          onClose={() => setShowConflictResolver(false)}
        />
      )}
    </div>
  );
};
