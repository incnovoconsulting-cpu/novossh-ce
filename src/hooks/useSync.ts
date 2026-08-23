import { useState, useCallback, useEffect, useRef } from 'react';
import { SyncService, type SyncState, type SyncConflict, type SyncChange } from '../services/SyncService';

// Singleton instance so all components share the same sync state
let syncServiceSingleton: SyncService | null = null;
function getSyncService(): SyncService {
  if (!syncServiceSingleton) syncServiceSingleton = new SyncService();
  return syncServiceSingleton;
}

interface UseSyncState {
  syncState: SyncState | null;
  conflicts: SyncConflict[];
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncProgress: number;
  error: Error | null;
}

interface UseSyncMethods {
  // Sync operations
  sync: () => Promise<SyncState>;
  getChanges: (since: Date) => Promise<SyncChange[]>;
  applyChanges: (changes: SyncChange[]) => Promise<void>;

  // Conflict resolution
  resolveConflict: (entryId: string, strategy: 'local' | 'remote' | 'merge' | 'last-write-wins') => Promise<SyncConflict | null>;
  autoResolveConflicts: () => Promise<SyncConflict[]>;
  getConflicts: () => Promise<SyncConflict[]>;

  // State management
  isSyncNeeded: (maxAge?: number) => Promise<boolean>;
  clearSyncState: () => Promise<void>;
  recordChange: (entryId: string, change: SyncChange) => Promise<void>;
}

/**
 * Custom hook for managing vault synchronization across devices
 *
 * Usage:
 * const { syncState, conflicts, sync, resolveConflict } = useSync('vault-id', 'device-id');
 * await sync(); // Sync vault
 * if (conflicts.length > 0) {
 *   await resolveConflict(conflicts[0].entryId, 'last-write-wins');
 * }
 */
export function useSync(
  vaultId: string,
  deviceId: string
): UseSyncState & UseSyncMethods {
  const [state, setState] = useState<UseSyncState>({
    syncState: null,
    conflicts: [],
    isSyncing: false,
    lastSyncAt: null,
    syncProgress: 0,
    error: null,
  });

  const syncServiceRef = useRef<SyncService>(getSyncService());
  const syncService = syncServiceRef.current;

  // Initialize sync on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const syncState = await syncService.initializeSync(vaultId, deviceId);
        const conflicts = await syncService.getConflicts(vaultId);

        setState((prev) => ({
          ...prev,
          syncState,
          conflicts,
          lastSyncAt: syncState.lastSyncAt,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error : new Error('Failed to initialize sync'),
        }));
      }
    };

    initialize();

    // Subscribe to sync events
    const handleSyncStarted = () => {
      setState((prev) => ({ ...prev, isSyncing: true, error: null }));
    };

    const handleSyncProgress = (data: { progress: number }) => {
      setState((prev) => ({ ...prev, syncProgress: data.progress }));
    };

    const handleSyncCompleted = (syncState: SyncState) => {
      setState((prev) => ({
        ...prev,
        syncState,
        isSyncing: false,
        lastSyncAt: syncState.lastSyncAt,
      }));
    };

    const handleConflictDetected = (conflict: SyncConflict) => {
      setState((prev) => ({
        ...prev,
        conflicts: [...prev.conflicts, conflict],
      }));
    };

    const handleConflictResolved = (data: { conflict: SyncConflict }) => {
      setState((prev) => ({
        ...prev,
        conflicts: prev.conflicts.filter((c) => c.entryId !== data.conflict.entryId),
      }));
    };

    syncService.on('syncStarted', handleSyncStarted);
    syncService.on('syncProgress', handleSyncProgress);
    syncService.on('syncCompleted', handleSyncCompleted);
    syncService.on('conflictDetected', handleConflictDetected);
    syncService.on('conflictResolved', handleConflictResolved);

    return () => {
      syncService.removeListener('syncStarted', handleSyncStarted);
      syncService.removeListener('syncProgress', handleSyncProgress);
      syncService.removeListener('syncCompleted', handleSyncCompleted);
      syncService.removeListener('conflictDetected', handleConflictDetected);
      syncService.removeListener('conflictResolved', handleConflictResolved);
    };
  }, [vaultId, deviceId, syncService]);

  const sync = useCallback(async () => {
    try {
      await syncService.startSync(vaultId, deviceId);
      const syncState = await syncService.completeSync(vaultId, deviceId);

      setState((prev) => ({
        ...prev,
        syncState,
        lastSyncAt: syncState.lastSyncAt,
        isSyncing: false,
      }));

      return syncState;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Sync failed');
      setState((prev) => ({ ...prev, error: err, isSyncing: false }));
      throw err;
    }
  }, [vaultId, deviceId, syncService]);

  const getChanges = useCallback(
    async (since: Date) => {
      try {
        return await syncService.getChanges(vaultId, since);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to get changes');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [vaultId, syncService]
  );

  const applyChanges = useCallback(
    async (changes: SyncChange[]) => {
      try {
        for (const change of changes) {
          await syncService.recordChange(change.entryId, change);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to apply changes');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [syncService]
  );

  const resolveConflict = useCallback(
    async (
      entryId: string,
      strategy: 'local' | 'remote' | 'merge' | 'last-write-wins'
    ) => {
      try {
        const resolved = await syncService.resolveConflict(vaultId, entryId, strategy);
        setState((prev) => ({
          ...prev,
          conflicts: prev.conflicts.filter((c) => c.entryId !== entryId),
        }));
        return resolved;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to resolve conflict');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [vaultId, syncService]
  );

  const autoResolveConflicts = useCallback(async () => {
    try {
      const resolved = await syncService.autoResolveConflicts(vaultId);
      setState((prev) => ({
        ...prev,
        conflicts: [],
      }));
      return resolved;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to auto-resolve conflicts');
      setState((prev) => ({ ...prev, error: err }));
      throw err;
    }
  }, [vaultId, syncService]);

  const getConflicts = useCallback(async () => {
    try {
      const conflicts = await syncService.getConflicts(vaultId);
      setState((prev) => ({ ...prev, conflicts }));
      return conflicts;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to get conflicts');
      setState((prev) => ({ ...prev, error: err }));
      throw err;
    }
  }, [vaultId, syncService]);

  const isSyncNeeded = useCallback(
    async (maxAge?: number) => {
      try {
        return await syncService.isSyncNeeded(vaultId, deviceId, maxAge);
      } catch (error) {
        return true; // Default to syncing if check fails
      }
    },
    [vaultId, deviceId, syncService]
  );

  const clearSyncState = useCallback(async () => {
    try {
      await syncService.clearSyncState(vaultId, deviceId);
      setState((prev) => ({
        ...prev,
        syncState: null,
        conflicts: [],
        lastSyncAt: null,
      }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to clear sync state');
      setState((prev) => ({ ...prev, error: err }));
      throw err;
    }
  }, [vaultId, deviceId, syncService]);

  const recordChange = useCallback(
    async (entryId: string, change: SyncChange) => {
      try {
        await syncService.recordChange(entryId, change);
        await syncService.addPendingChange(vaultId, deviceId, change);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to record change');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [vaultId, deviceId, syncService]
  );

  return {
    ...state,
    sync,
    getChanges,
    applyChanges,
    resolveConflict,
    autoResolveConflicts,
    getConflicts,
    isSyncNeeded,
    clearSyncState,
    recordChange,
  };
}
