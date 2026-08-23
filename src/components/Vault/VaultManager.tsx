import { useState, useRef, FC } from 'react';
import { useVaultApi } from '../../hooks/useVaultApi';
import { useSyncApi } from '../../hooks/useSyncApi';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useReconnection } from '../../hooks/useReconnection';
import { useConflictResolution } from '../../hooks/useConflictResolution';
import { useP2PSync } from '../../hooks/useP2PSync';
import { VaultList } from './VaultList';
import { VaultDetail } from './VaultDetail';
import { VaultUnlock } from './VaultUnlock';
import { CreateVaultDialog } from './CreateVaultDialog';
import { useVaultKey } from '../../contexts/VaultKeyContext';
import { SyncStatus } from './SyncStatus';
import { OfflineIndicator } from '../Status/OfflineIndicator';
import { ReconnectionBanner } from '../Status/ReconnectionBanner';
import { SyncProgressPanel } from '../Sync/SyncProgressPanel';
import { ConflictResolver } from './ConflictResolver';
import { PeerList } from '../P2P/PeerList';
import { OfflineSyncService } from '../../services/OfflineSyncService';
import { P2PSyncService } from '../../services/P2PSyncService';
import styles from './VaultManager.module.css';

interface VaultManagerProps {
  userId: string;
  organizationId: string;
  deviceId: string;
}

export const VaultManager: FC<VaultManagerProps> = ({
  userId,
  organizationId,
  deviceId,
}) => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [dismissedReconnectionErrors, setDismissedReconnectionErrors] = useState<string[]>([]);

  const apiCtx = { userId, orgId: organizationId, deviceId };
  const vaultApi = useVaultApi(apiCtx);
  const vaultKey = useVaultKey();
  const syncApi = useSyncApi(vaultApi.activeVault?.id ?? null, apiCtx);

  // Initialize offline sync and related services (once per mount, not per render)
  const offlineSyncServiceRef = useRef<OfflineSyncService | null>(null);
  if (!offlineSyncServiceRef.current) offlineSyncServiceRef.current = new OfflineSyncService();
  const offlineSyncService = offlineSyncServiceRef.current;

  const p2pSyncServiceRef = useRef<P2PSyncService | null>(null);
  if (!p2pSyncServiceRef.current) p2pSyncServiceRef.current = new P2PSyncService(deviceId);
  const p2pSyncService = p2pSyncServiceRef.current;

  // Call new Phase 3 hooks
  const offlineSync = useOfflineSync(offlineSyncService);
  const reconnection = useReconnection(offlineSyncService, p2pSyncService, true);
  const conflictResolution = useConflictResolution(offlineSyncService);
  const p2pSync = useP2PSync(p2pSyncService, offlineSyncService);

  const handleSelectVault = async (vaultId: string) => {
    await vaultApi.selectVault(vaultId);
  };

  const handleCreateVault = async (name: string, description?: string) => {
    const newVault = await vaultApi.createVault(name, description);
    await vaultKey.createVaultDek(newVault.id);
    await vaultApi.selectVault(newVault.id);
    setShowCreateDialog(false);
  };

  const handleSync = async () => {
    setShowSyncPanel(true);
    try {
      // If offline, trigger reconnection sync instead
      if (!offlineSync.isOnline) {
        await reconnection.manualSync();
      } else {
        await syncApi.sync();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  // Handle manual sync from offline indicator
  const handleTapToSync = async () => {
    await reconnection.manualSync();
  };

  // Handle auto-resolve conflicts
  const handleAutoResolveConflicts = async () => {
    await conflictResolution.autoResolveAll('local');
  };

  // Handle P2P sync with peer
  const handleSyncWithPeer = async (peerId: string) => {
    try {
      const result = await p2pSync.syncWithPeer(peerId);
      if (result.success) {
        // Sync successful
      }
    } catch (error) {
      console.error(`Failed to sync with peer ${peerId}:`, error);
    }
  };

  // Handle reconnection retry
  const handleRetryReconnection = async () => {
    setDismissedReconnectionErrors([]);
    await reconnection.manualSync();
  };

  // Handle reconnection banner dismiss
  const handleDismissReconnectionBanner = () => {
    setDismissedReconnectionErrors(reconnection.errors);
  };

  // Adapt ApiVault shape to what VaultList/VaultListItem expect
  const adaptedVaults = vaultApi.vaults.map((v) => ({
    ...v,
    lastModifiedAt: v.last_modified_at,
    isShared: v.is_shared,
  }));

  const syncStatusProps = {
    syncState: vaultApi.activeVault
      ? {
          vaultId: vaultApi.activeVault.id,
          lastSyncAt: syncApi.lastSyncAt,
          isSyncing: syncApi.isSyncing,
          syncProgress: syncApi.syncProgress,
          pendingChanges: syncApi.pendingChanges,
          conflicts: syncApi.conflicts,
        }
      : null,
    conflicts: syncApi.conflicts,
  };

  return (
    <VaultUnlock>
    <div className={styles.container}>
      {/* Header with offline indicator */}
      <div className={styles.header}>
        <h1>Secure Vault</h1>
        <div className={styles.headerActions}>
          <OfflineIndicator
            isOnline={offlineSync.isOnline}
            unsavedChanges={offlineSync.unsavedChanges.length}
            onTapToSync={handleTapToSync}
          />
          <SyncStatus {...syncStatusProps} />
          <button
            className={styles.createButton}
            onClick={() => setShowCreateDialog(true)}
          >
            + New Vault
          </button>
        </div>
      </div>

      {/* Reconnection banner - shows when reconnecting or on error */}
      {(reconnection.isReconnecting || reconnection.errors.length > 0) && (
        <ReconnectionBanner
          isReconnecting={reconnection.isReconnecting}
          progress={reconnection.reconnectionProgress}
          errors={reconnection.errors.filter((e) => !dismissedReconnectionErrors.includes(e))}
          onRetry={handleRetryReconnection}
          onDismiss={handleDismissReconnectionBanner}
        />
      )}

      {/* Sync progress panel - shows when syncing */}
      {showSyncPanel && syncApi.isSyncing && (
        <SyncProgressPanel
          progress={syncApi.syncProgress}
          syncedCount={Math.floor(
            (syncApi.syncProgress / 100) * (syncApi.pendingChanges.length || 1)
          )}
          totalCount={syncApi.pendingChanges.length || 1}
          status={syncApi.isSyncing ? 'syncing' : 'idle'}
          onDismiss={() => setShowSyncPanel(false)}
        />
      )}

      <div className={styles.content}>
        <div className={styles.sidebar}>
          {/* Vault list */}
          <VaultList
            vaults={adaptedVaults}
            selectedVaultId={vaultApi.activeVault?.id ?? null}
            onSelectVault={handleSelectVault}
            loading={vaultApi.loading}
          />

          {/* P2P peer list - show when offline */}
          {!offlineSync.isOnline && (
            <PeerList
              peers={p2pSync.peers.map((peer) => ({
                id: peer.id,
                name: peer.name,
                connectionStatus: peer.isConnected ? 'connected' : 'disconnected',
                lastSyncedAt: peer.lastSeen,
              }))}
              isSyncing={p2pSync.isSyncing}
              onSyncWithPeer={handleSyncWithPeer}
            />
          )}
        </div>

        <div className={styles.main}>
          {vaultApi.activeVault ? (
            <VaultDetail
              vault={vaultApi.activeVault}
              entries={vaultApi.entries}
              shares={vaultApi.shares}
              loading={vaultApi.loading}
              isSyncing={syncApi.isSyncing || reconnection.isReconnecting}
              syncProgress={syncApi.syncProgress}
              conflicts={syncApi.conflicts}
              error={vaultApi.error}
              onSync={handleSync}
              onAddEntry={async (type, name, plaintext) => {
                const encryptedData = await vaultKey.encryptForVault(vaultApi.activeVault!.id, plaintext);
                return vaultApi.createEntry(vaultApi.activeVault!.id, type, name, encryptedData);
              }}
              onUpdateEntry={async (entryId, updates) => {
                const encryptedUpdates = updates.encryptedData
                  ? { ...updates, encryptedData: await vaultKey.encryptForVault(vaultApi.activeVault!.id, updates.encryptedData) }
                  : updates;
                return vaultApi.updateEntry(vaultApi.activeVault!.id, entryId, encryptedUpdates);
              }}
              onDeleteEntry={(entryId) =>
                vaultApi.deleteEntry(vaultApi.activeVault!.id, entryId)
              }
              onDecryptEntry={(encryptedData) =>
                vaultKey.decryptForVault(vaultApi.activeVault!.id, encryptedData)
              }
              onShare={async (userIdToShare, level) => {
                const share = await vaultApi.shareWithUser(vaultApi.activeVault!.id, userIdToShare, level);
                try {
                  const { getUserPublicKey, setShareWrappedDek } = await import('../../lib/vaultApi');
                  const recipientPublicKey = await getUserPublicKey(userIdToShare);
                  if (recipientPublicKey) {
                    const dek = await vaultKey.getVaultDek(vaultApi.activeVault!.id);
                    const { VaultKeyService } = await import('../../services/VaultKeyService');
                    const wrapped = await VaultKeyService.wrapDek(dek, recipientPublicKey);
                    await setShareWrappedDek(share.id, wrapped);
                  }
                } catch (err) {
                  console.error('Failed to wrap vault key for grantee:', err);
                }
                return share;
              }}
              onGenerateLink={(level, expiresIn) =>
                vaultApi.generateShareLink(vaultApi.activeVault!.id, level, expiresIn)
              }
              onResolveConflict={syncApi.resolveConflict}
              onAutoResolve={syncApi.autoResolveAll}
            />
          ) : (
            <div className={styles.emptyState}>
              <h2>No Vault Selected</h2>
              <p>
                {vaultApi.error
                  ? `Error: ${vaultApi.error}`
                  : 'Create a new vault or select one from the list to get started.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Conflict resolver modal */}
      {conflictResolution.conflicts && conflictResolution.conflicts.length > 0 && (
        <ConflictResolver
          isOpen={true}
          conflicts={conflictResolution.conflicts}
          onResolve={async (conflictId, strategy) => {
            await conflictResolution.resolveConflict(conflictId, strategy);
          }}
          onAutoResolve={handleAutoResolveConflicts}
          onClose={() => {
            // Conflicts will be cleared when all are resolved
          }}
        />
      )}

      {/* Create vault dialog */}
      {showCreateDialog && (
        <CreateVaultDialog
          onCreate={handleCreateVault}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
    </VaultUnlock>
  );
};
