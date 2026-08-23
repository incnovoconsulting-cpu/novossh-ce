import { useState, useCallback, useEffect, useRef } from 'react';
import { OfflineSyncService, OfflineChange, SyncConflict, SyncQueueItem } from '../services/OfflineSyncService';

export interface UseOfflineSyncState {
  isOnline: boolean;
  unsavedChanges: OfflineChange[];
  syncQueue: SyncQueueItem[];
  conflicts: SyncConflict[];
  lastRecordedAt: number | null;
  isRecording: boolean;
}

export interface UseOfflineSyncMethods {
  recordChange(
    type: 'create' | 'update' | 'delete',
    resourceType: string,
    resourceId: string,
    data: Record<string, unknown>
  ): Promise<OfflineChange>;

  getChanges(): Promise<OfflineChange[]>;

  getSyncQueue(): Promise<SyncQueueItem[]>;

  getConflicts(): Promise<SyncConflict[]>;

  resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merged',
    mergedData?: Record<string, unknown>
  ): Promise<void>;

  clearSyncQueue(): Promise<void>;
}

export type UseOfflineSyncResult = UseOfflineSyncState & UseOfflineSyncMethods;

export function useOfflineSync(offlineSync?: OfflineSyncService): UseOfflineSyncResult {
  const [state, setState] = useState<UseOfflineSyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    unsavedChanges: [],
    syncQueue: [],
    conflicts: [],
    lastRecordedAt: null,
    isRecording: false,
  });

  const serviceRef = useRef<OfflineSyncService>(
    offlineSync || new OfflineSyncService()
  );
  const service = serviceRef.current;

  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;

    const initialize = async () => {
      try {
        await service.initialize();
        isInitializedRef.current = true;

        const changes = await service.getUnsyncedChanges();
        const queue = await service.getPendingSyncQueue();

        setState((prev) => ({
          ...prev,
          unsavedChanges: changes,
          syncQueue: queue,
          isRecording: true,
        }));
      } catch (error) {
        console.error('Failed to initialize offline sync:', error);
        setState((prev) => ({
          ...prev,
          isRecording: false,
        }));
      }
    };

    initialize();
  }, [service]);

  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: true,
      }));
    };

    const handleOffline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: false,
      }));
    };

    const handleSyncOnline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: true,
      }));
    };

    const handleSyncOffline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: false,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offlineSync:online', handleSyncOnline);
    window.addEventListener('offlineSync:offline', handleSyncOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offlineSync:online', handleSyncOnline);
      window.removeEventListener('offlineSync:offline', handleSyncOffline);
    };
  }, []);

  const recordChange = useCallback(
    async (
      type: 'create' | 'update' | 'delete',
      resourceType: string,
      resourceId: string,
      data: Record<string, unknown>
    ): Promise<OfflineChange> => {
      try {
        const change = await service.recordChange(type, resourceType, resourceId, data);

        setState((prev) => ({
          ...prev,
          unsavedChanges: [...prev.unsavedChanges, change],
          lastRecordedAt: Date.now(),
        }));

        return change;
      } catch (error) {
        console.error('Failed to record change:', error);
        throw error;
      }
    },
    [service]
  );

  const getChanges = useCallback(async (): Promise<OfflineChange[]> => {
    try {
      return await service.getAllChanges();
    } catch (error) {
      console.error('Failed to get changes:', error);
      throw error;
    }
  }, [service]);

  const getSyncQueue = useCallback(async (): Promise<SyncQueueItem[]> => {
    try {
      const queue = await service.getPendingSyncQueue();
      setState((prev) => ({
        ...prev,
        syncQueue: queue,
      }));
      return queue;
    } catch (error) {
      console.error('Failed to get sync queue:', error);
      throw error;
    }
  }, [service]);

  const getConflicts = useCallback(async (): Promise<SyncConflict[]> => {
    try {
      // OfflineSyncService doesn't have a public getConflicts method
      return [];
    } catch (error) {
      console.error('Failed to get conflicts:', error);
      throw error;
    }
  }, [service]);

  const resolveConflict = useCallback(
    async (
      conflictId: string,
      resolution: 'local' | 'remote' | 'merged',
      mergedData?: Record<string, unknown>
    ): Promise<void> => {
      try {
        await service.resolveConflict(conflictId, resolution, mergedData);

        setState((prev) => ({
          ...prev,
          conflicts: prev.conflicts.filter((c) => c.id !== conflictId),
        }));
      } catch (error) {
        console.error('Failed to resolve conflict:', error);
        throw error;
      }
    },
    [service]
  );

  const clearSyncQueue = useCallback(async (): Promise<void> => {
    try {
      await service.clearSyncedChanges();

      setState((prev) => ({
        ...prev,
        syncQueue: [],
        unsavedChanges: [],
      }));
    } catch (error) {
      console.error('Failed to clear sync queue:', error);
      throw error;
    }
  }, [service]);

  return {
    ...state,
    recordChange,
    getChanges,
    getSyncQueue,
    getConflicts,
    resolveConflict,
    clearSyncQueue,
  };
}
