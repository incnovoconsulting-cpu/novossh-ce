import { useState, useCallback, useEffect, useRef } from 'react';
import { OfflineSyncService } from '../services/OfflineSyncService';
import { P2PSyncService } from '../services/P2PSyncService';

/**
 * State interface for reconnection sync operations
 */
export interface UseReconnectionState {
  /** Whether the application is currently online */
  isOnline: boolean;
  /** Whether a reconnection sync is currently in progress */
  isReconnecting: boolean;
  /** Progress of the reconnection sync (0-100) */
  reconnectionProgress: number;
  /** Number of changes that haven't been synced yet */
  unsyncedChanges: number;
  /** Array of errors encountered during reconnection */
  errors: string[];
  /** Timestamp of the last reconnection attempt */
  lastReconnectAt: number | null;
}

/**
 * Methods interface for reconnection operations
 */
export interface UseReconnectionMethods {
  /**
   * Manually trigger a sync operation
   */
  manualSync(): Promise<void>;

  /**
   * Cancel an ongoing sync operation
   */
  cancelSync(): void;

  /**
   * Dismiss an error from the errors array
   * @param index - Index of the error to dismiss
   */
  dismissError(index: number): void;
}

/**
 * Combined state and methods for reconnection
 */
export type UseReconnectionResult = UseReconnectionState & UseReconnectionMethods;

/**
 * Custom hook for orchestrating reconnection and offline sync
 *
 * This hook combines the capabilities of OfflineSyncService and P2PSyncService
 * to provide a complete reconnection sync experience. It automatically detects
 * when the application comes back online and can trigger automatic sync, while
 * also providing manual sync control and error management.
 *
 * @param offlineSync - OfflineSyncService instance for offline sync operations
 * @param p2pSync - Optional P2PSyncService instance for peer sync
 * @param autoSyncOnReconnect - Whether to automatically sync when coming online (default: true)
 * @returns State and methods for managing reconnection sync
 *
 * @example
 * ```tsx
 * const {
 *   isOnline,
 *   isReconnecting,
 *   reconnectionProgress,
 *   unsyncedChanges,
 *   errors,
 *   manualSync,
 *   dismissError
 * } = useReconnection(offlineSync, p2pSync, true);
 *
 * // Listen for changes
 * useEffect(() => {
 *   if (isOnline && !isReconnecting && unsyncedChanges > 0) {
 *     // Show notification that sync is ready
 *   }
 * }, [isOnline, isReconnecting, unsyncedChanges]);
 *
 * // Manual sync trigger
 * const handleSync = async () => {
 *   try {
 *     await manualSync();
 *   } catch (error) {
 *     console.error('Sync failed:', error);
 *   }
 * };
 * ```
 */
export function useReconnection(
  offlineSync: OfflineSyncService,
  p2pSync?: P2PSyncService,
  autoSyncOnReconnect: boolean = true
): UseReconnectionResult {
  const [state, setState] = useState<UseReconnectionState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isReconnecting: false,
    reconnectionProgress: 0,
    unsyncedChanges: 0,
    errors: [],
    lastReconnectAt: null,
  });

  const syncInProgressRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Update unsynced changes count
   */
  const updateUnsyncedCount = useCallback(async (): Promise<void> => {
    try {
      await offlineSync.initialize();
      const changes = await offlineSync.getUnsyncedChanges();
      setState((prev) => ({
        ...prev,
        unsyncedChanges: changes.length,
      }));
    } catch (error) {
      console.error('Failed to get unsynced changes:', error);
    }
  }, [offlineSync]);

  /**
   * Perform manual sync
   */
  const manualSync = useCallback(async (): Promise<void> => {
    if (syncInProgressRef.current) {
      console.warn('Sync already in progress');
      return;
    }

    syncInProgressRef.current = true;
    abortControllerRef.current = new AbortController();

    setState((prev) => ({
      ...prev,
      isReconnecting: true,
      reconnectionProgress: 0,
      errors: [],
      lastReconnectAt: Date.now(),
    }));

    try {
      const changes = await offlineSync.getUnsyncedChanges();
      const totalChanges = changes.length;

      if (totalChanges === 0) {
        setState((prev) => ({
          ...prev,
          isReconnecting: false,
          reconnectionProgress: 100,
        }));
        return;
      }

      // Simulate sync progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress > 90) progress = 90; // Don't go over 90% until complete

        setState((prev) => ({
          ...prev,
          reconnectionProgress: Math.min(progress, 90),
        }));
      }, 500);

      // Process changes
      for (let i = 0; i < totalChanges; i++) {
        if (abortControllerRef.current?.signal.aborted) {
          clearInterval(progressInterval);
          throw new Error('Sync cancelled');
        }

        const change = changes[i];

        try {
          // Mark as synced - in a real implementation, this would be done
          // after successful server/peer sync
          await offlineSync.markAsSynced(change.id);

          const percentComplete = ((i + 1) / totalChanges) * 100;
          setState((prev) => ({
            ...prev,
            reconnectionProgress: Math.max(percentComplete, prev.reconnectionProgress),
          }));
        } catch (error) {
          console.error(`Failed to sync change ${change.id}:`, error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          setState((prev) => ({
            ...prev,
            errors: [...prev.errors, errorMsg],
          }));
        }
      }

      clearInterval(progressInterval);

      // Mark P2P sync if service is available
      if (p2pSync) {
        try {
          // In a real implementation, broadcast synced changes to peers
          setState((prev) => ({
            ...prev,
            reconnectionProgress: 95,
          }));
        } catch (error) {
          console.error('P2P sync error:', error);
        }
      }

      setState((prev) => ({
        ...prev,
        isReconnecting: false,
        reconnectionProgress: 100,
      }));

      await updateUnsyncedCount();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Sync failed';
      setState((prev) => ({
        ...prev,
        isReconnecting: false,
        errors: [...prev.errors, errorMsg],
      }));
      console.error('Reconnection sync error:', error);
    } finally {
      syncInProgressRef.current = false;
      abortControllerRef.current = null;
    }
  }, [offlineSync, p2pSync, updateUnsyncedCount]);

  /**
   * Cancel ongoing sync
   */
  const cancelSync = useCallback((): void => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    syncInProgressRef.current = false;

    setState((prev) => ({
      ...prev,
      isReconnecting: false,
    }));
  }, []);

  /**
   * Dismiss an error
   */
  const dismissError = useCallback((index: number): void => {
    setState((prev) => ({
      ...prev,
      errors: prev.errors.filter((_, i) => i !== index),
    }));
  }, []);

  /**
   * Initialize - load initial unsynced count and set up event listeners
   */
  useEffect(() => {
    const initialize = async () => {
      await updateUnsyncedCount();
    };

    initialize();
  }, [updateUnsyncedCount]);

  /**
   * Set up event listeners for online/offline changes
   */
  useEffect(() => {
    const handleOnline = async () => {
      setState((prev) => ({
        ...prev,
        isOnline: true,
      }));

      if (autoSyncOnReconnect) {
        // Small delay to ensure service is ready
        await new Promise((resolve) => setTimeout(resolve, 100));
        await manualSync();
      }
    };

    const handleOffline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: false,
      }));
      cancelSync();
    };

    const handleOfflineSyncOnline = async () => {
      setState((prev) => ({
        ...prev,
        isOnline: true,
      }));

      if (autoSyncOnReconnect) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await manualSync();
      }
    };

    const handleOfflineSyncOffline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: false,
      }));
      cancelSync();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offlineSync:online', handleOfflineSyncOnline);
    window.addEventListener('offlineSync:offline', handleOfflineSyncOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offlineSync:online', handleOfflineSyncOnline);
      window.removeEventListener('offlineSync:offline', handleOfflineSyncOffline);
    };
  }, [manualSync, cancelSync, autoSyncOnReconnect]);

  /**
   * Listen for offline sync changes to update unsynced count
   */
  useEffect(() => {
    const handleChangeRecorded = () => {
      updateUnsyncedCount();
    };

    window.addEventListener('offlineSync:changeRecorded', handleChangeRecorded);

    return () => {
      window.removeEventListener('offlineSync:changeRecorded', handleChangeRecorded);
    };
  }, [updateUnsyncedCount]);

  return {
    ...state,
    manualSync,
    cancelSync,
    dismissError,
  };
}
