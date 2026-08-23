import { useState, useCallback, useEffect, useRef } from 'react';
import * as api from '../lib/vaultApi';
import type { ApiSyncChange } from '../lib/vaultApi';

// Mirrors server-side SyncConflict type (server/services/SyncService.ts)
export interface SyncConflict {
  entryId: string;
  localVersion: number;
  remoteVersion: number;
  localTimestamp: Date;
  remoteTimestamp: Date;
}

interface UseSyncState {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncProgress: number;
  conflicts: SyncConflict[];
  pendingChanges: ApiSyncChange[];
  error: string | null;
}

interface UseSyncMethods {
  sync: () => Promise<void>;
  pushChanges: (changes: ApiSyncChange[]) => Promise<void>;
  resolveConflict: (entryId: string, resolution: 'local' | 'remote' | 'merge' | 'last-write-wins') => Promise<void>;
  autoResolveAll: () => Promise<void>;
  recordChange: (change: ApiSyncChange) => void;
  clearError: () => void;
}

interface RequestContext {
  userId?: string;
  orgId?: string;
  deviceId?: string;
}

/**
 * Hook for managing sync state between client and backend for a specific vault.
 * Polls server for sync state; use WebSocket in production for push notifications.
 */
export function useSyncApi(
  vaultId: string | null,
  ctx?: RequestContext
): UseSyncState & UseSyncMethods {
  const [state, setState] = useState<UseSyncState>({
    isSyncing: false,
    lastSyncAt: null,
    syncProgress: 0,
    conflicts: [],
    pendingChanges: [],
    error: null,
  });

  const pendingRef = useRef<ApiSyncChange[]>([]);

  useEffect(() => {
    if (!vaultId) return;

    const loadSyncState = async () => {
      try {
        const syncState = await api.getSyncState(vaultId, undefined, ctx);
        setState((prev) => ({
          ...prev,
          lastSyncAt: new Date(syncState.lastSyncAt),
        }));
      } catch {
        // Silent - sync state is best-effort on mount
      }
    };

    loadSyncState();
  }, [vaultId]);

  const sync = useCallback(async () => {
    if (!vaultId) return;

    setState((prev) => ({ ...prev, isSyncing: true, syncProgress: 0, error: null }));

    try {
      setState((prev) => ({ ...prev, syncProgress: 20 }));
      const pending = [...pendingRef.current];

      if (pending.length > 0) {
        const result = await api.pushChanges(vaultId, pending, ctx);
        setState((prev) => ({ ...prev, syncProgress: 60 }));

        if (Array.isArray(result.conflicts) && result.conflicts.length > 0) {
          const conflicts = result.conflicts as SyncConflict[];
          setState((prev) => ({ ...prev, conflicts }));
        }
      }

      const syncState = await api.getSyncState(vaultId, undefined, ctx);
      setState((prev) => ({ ...prev, syncProgress: 100 }));

      pendingRef.current = [];

      setState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(syncState.lastSyncAt),
        pendingChanges: [],
        syncProgress: 0,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        syncProgress: 0,
        error: msg,
      }));
      throw err;
    }
  }, [vaultId]);

  const pushChanges = useCallback(
    async (changes: ApiSyncChange[]) => {
      if (!vaultId) return;

      try {
        await api.pushChanges(vaultId, changes, ctx);
        setState((prev) => ({
          ...prev,
          lastSyncAt: new Date(),
          pendingChanges: [],
        }));
        pendingRef.current = [];
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to push changes';
        setState((prev) => ({ ...prev, error: msg }));
        throw err;
      }
    },
    [vaultId]
  );

  const resolveConflict = useCallback(
    async (
      entryId: string,
      resolution: 'local' | 'remote' | 'merge' | 'last-write-wins',
      winningData?: string
    ) => {
      if (!vaultId) return;

      try {
        await api.resolveConflict(vaultId, entryId, resolution, winningData, ctx);
        setState((prev) => ({
          ...prev,
          conflicts: prev.conflicts.filter((c) => c.entryId !== entryId),
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to resolve conflict';
        setState((prev) => ({ ...prev, error: msg }));
        throw err;
      }
    },
    [vaultId]
  );

  const autoResolveAll = useCallback(async () => {
    if (!vaultId) return;

    const { conflicts } = state;
    try {
      for (const conflict of conflicts) {
        await api.resolveConflict(vaultId, conflict.entryId, 'last-write-wins', undefined, ctx);
      }
      setState((prev) => ({ ...prev, conflicts: [] }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to auto-resolve conflicts';
      setState((prev) => ({ ...prev, error: msg }));
      throw err;
    }
  }, [vaultId, state.conflicts]);

  const recordChange = useCallback((change: ApiSyncChange) => {
    pendingRef.current.push(change);
    setState((prev) => ({
      ...prev,
      pendingChanges: [...pendingRef.current],
    }));
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    sync,
    pushChanges,
    resolveConflict,
    autoResolveAll,
    recordChange,
    clearError,
  };
}
