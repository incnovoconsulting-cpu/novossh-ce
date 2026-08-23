import { useState, useCallback } from 'react';

/**
 * Represents a pending change waiting to be synced
 */
export interface PendingChange {
  /** Unique identifier for the change */
  id: string;
  /** Type of change: 'create', 'update', or 'delete' */
  type: 'create' | 'update' | 'delete';
  /** Resource type being changed */
  resourceType: string;
  /** Resource identifier */
  resourceId: string;
  /** The changed data */
  data: Record<string, unknown>;
  /** Status of the change */
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  /** Timestamp when change was created */
  createdAt: number;
  /** Timestamp of last sync attempt */
  lastAttemptAt?: number;
  /** Number of retry attempts */
  retries: number;
  /** Error message if syncing failed */
  error?: string;
}

/**
 * State interface for optimistic updates
 */
export interface UseOptimisticUpdateState {
  /** Map of pending changes indexed by resource ID */
  pendingChanges: Map<string, PendingChange>;
  /**
   * Check if a resource has a pending change
   * @param id - Resource identifier
   */
  isPending(id: string): boolean;
  /**
   * Get the last sync attempt time for a resource
   * @param id - Resource identifier
   */
  lastAttemptAt(id: string): number | undefined;
}

/**
 * Methods interface for optimistic update operations
 */
export interface UseOptimisticUpdateMethods {
  /**
   * Mark a change as pending
   * @param id - Unique change identifier
   * @param type - Type of change
   * @param resourceType - Resource type
   * @param resourceId - Resource identifier
   * @param data - Change data
   */
  markPending(
    id: string,
    type: 'create' | 'update' | 'delete',
    resourceType: string,
    resourceId: string,
    data: Record<string, unknown>
  ): void;

  /**
   * Mark a change as synced and auto-clear it
   * @param id - Change identifier to mark as synced
   */
  markSynced(id: string): void;

  /**
   * Mark a change as failed with optional error message
   * @param id - Change identifier
   * @param error - Optional error message
   */
  markFailed(id: string, error?: string): void;

  /**
   * Retry syncing a failed change
   * @param id - Change identifier to retry
   */
  retrySyncFor(id: string): void;

  /**
   * Get all pending changes
   */
  getAllPending(): PendingChange[];

  /**
   * Get pending changes for a specific resource
   * @param resourceId - Resource identifier
   */
  getPendingFor(resourceId: string): PendingChange | undefined;

  /**
   * Clear all pending changes
   */
  clearAll(): void;

  /**
   * Clear a specific pending change
   * @param id - Change identifier
   */
  clear(id: string): void;
}

/**
 * Combined state and methods for optimistic updates
 */
export type UseOptimisticUpdateResult = UseOptimisticUpdateState & UseOptimisticUpdateMethods;

/**
 * Custom hook for tracking optimistic updates and pending changes
 *
 * This hook manages local pending changes that are waiting to be synced.
 * It provides state tracking for multiple pending changes and automatically
 * clears synced entries. Useful for implementing optimistic UI updates
 * that feel instant while the sync happens in the background.
 *
 * @returns State and methods for managing optimistic updates
 *
 * @example
 * ```tsx
 * const {
 *   pendingChanges,
 *   markPending,
 *   markSynced,
 *   isPending,
 *   retrySyncFor
 * } = useOptimisticUpdate();
 *
 * // When user makes a change
 * const changeId = 'change-123';
 * markPending(changeId, 'update', 'entry', 'entry-456', { title: 'New Title' });
 *
 * // Check if pending
 * if (isPending('entry-456')) {
 *   // Show loading state
 * }
 *
 * // After sync succeeds
 * markSynced(changeId);
 *
 * // If sync fails
 * markFailed(changeId, 'Network error');
 *
 * // Retry
 * await retrySyncFor(changeId);
 * ```
 */
export function useOptimisticUpdate(): UseOptimisticUpdateResult {
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(
    new Map()
  );

  /**
   * Mark a change as pending
   */
  const markPending = useCallback(
    (
      id: string,
      type: 'create' | 'update' | 'delete',
      resourceType: string,
      resourceId: string,
      data: Record<string, unknown>
    ): void => {
      const change: PendingChange = {
        id,
        type,
        resourceType,
        resourceId,
        data,
        status: 'pending',
        createdAt: Date.now(),
        retries: 0,
      };

      setPendingChanges((prev) => {
        const newMap = new Map(prev);
        newMap.set(id, change);
        return newMap;
      });
    },
    []
  );

  /**
   * Mark a change as synced and auto-clear after a delay
   */
  const markSynced = useCallback((id: string): void => {
    setPendingChanges((prev) => {
      const newMap = new Map(prev);
      const change = newMap.get(id);

      if (change) {
        change.status = 'synced';
        newMap.set(id, change);
      }

      return newMap;
    });

    // Auto-clear synced changes after a short delay to avoid flickering
    setTimeout(() => {
      setPendingChanges((prev) => {
        const newMap = new Map(prev);
        const change = newMap.get(id);

        if (change && change.status === 'synced') {
          newMap.delete(id);
        }

        return newMap;
      });
    }, 1000);
  }, []);

  /**
   * Mark a change as failed
   */
  const markFailed = useCallback((id: string, error?: string): void => {
    setPendingChanges((prev) => {
      const newMap = new Map(prev);
      const change = newMap.get(id);

      if (change) {
        change.status = 'failed';
        change.error = error;
        change.lastAttemptAt = Date.now();
        newMap.set(id, change);
      }

      return newMap;
    });
  }, []);

  /**
   * Retry syncing a failed change
   */
  const retrySyncFor = useCallback((id: string): void => {
    setPendingChanges((prev) => {
      const newMap = new Map(prev);
      const change = newMap.get(id);

      if (change) {
        change.status = 'pending';
        change.retries += 1;
        change.lastAttemptAt = Date.now();
        change.error = undefined;
        newMap.set(id, change);
      }

      return newMap;
    });
  }, []);

  /**
   * Get all pending changes
   */
  const getAllPending = useCallback((): PendingChange[] => {
    const result: PendingChange[] = [];
    pendingChanges.forEach((change) => {
      result.push(change);
    });
    return result;
  }, [pendingChanges]);

  /**
   * Get pending changes for a specific resource
   */
  const getPendingFor = useCallback(
    (resourceId: string): PendingChange | undefined => {
      let result: PendingChange | undefined;
      pendingChanges.forEach((change) => {
        if (change.resourceId === resourceId) {
          result = change;
        }
      });
      return result;
    },
    [pendingChanges]
  );

  /**
   * Check if a resource has pending changes
   */
  const isPending = useCallback(
    (id: string): boolean => {
      const change = getPendingFor(id);
      return change !== undefined && change.status !== 'synced';
    },
    [getPendingFor]
  );

  /**
   * Get last attempt time for a resource
   */
  const lastAttemptAt = useCallback(
    (id: string): number | undefined => {
      const change = getPendingFor(id);
      return change?.lastAttemptAt;
    },
    [getPendingFor]
  );

  /**
   * Clear all pending changes
   */
  const clearAll = useCallback((): void => {
    setPendingChanges(new Map());
  }, []);

  /**
   * Clear a specific pending change
   */
  const clear = useCallback((id: string): void => {
    setPendingChanges((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  return {
    pendingChanges,
    isPending,
    lastAttemptAt,
    markPending,
    markSynced,
    markFailed,
    retrySyncFor,
    getAllPending,
    getPendingFor,
    clearAll,
    clear,
  };
}
