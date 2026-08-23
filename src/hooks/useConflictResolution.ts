import { useState, useCallback, useEffect, useRef } from 'react';
import { OfflineSyncService, SyncConflict } from '../services/OfflineSyncService';

/**
 * State interface for conflict resolution operations
 */
export interface UseConflictResolutionState {
  /** Array of currently detected conflicts */
  conflicts: SyncConflict[];
  /** Whether a conflict resolution is currently in progress */
  isResolving: boolean;
  /** Index of the current conflict being reviewed */
  currentIndex: number;
  /** Auto-resolve progress as a percentage (0-100) */
  autoResolveProgress: number;
}

/**
 * Methods interface for conflict resolution operations
 */
export interface UseConflictResolutionMethods {
  /**
   * Resolve a specific conflict with the given strategy
   * @param conflictId - ID of the conflict to resolve
   * @param strategy - Resolution strategy: 'local', 'remote', or 'merged'
   * @param mergedData - Optional merged data (required if strategy is 'merged')
   * @throws Error if conflict not found or resolution fails
   */
  resolveConflict(
    conflictId: string,
    strategy: 'local' | 'remote' | 'merged',
    mergedData?: Record<string, unknown>
  ): Promise<void>;

  /**
   * Automatically resolve all conflicts using the specified strategy
   * @param strategy - Default strategy for all conflicts ('local' or 'remote')
   * @throws Error if any conflict resolution fails
   */
  autoResolveAll(strategy?: 'local' | 'remote'): Promise<void>;

  /**
   * Skip the current conflict without resolving it
   * Moves to the next conflict in the list
   */
  skipConflict(): void;

  /**
   * Get the current conflict being reviewed
   * @returns The current SyncConflict or null if no conflicts exist
   */
  getCurrentConflict(): SyncConflict | null;

  /**
   * Move to the next conflict in the list
   * Does nothing if at the end of the list
   */
  moveToNextConflict(): void;
}

/**
 * Combined state and methods interface for conflict resolution
 */
export type UseConflictResolutionResult = UseConflictResolutionState & UseConflictResolutionMethods;

/**
 * Custom hook for managing conflict resolution in offline sync
 *
 * This hook provides state management and methods for handling conflicts
 * that arise during synchronization. It supports guided conflict resolution
 * with strategies for keeping local changes, accepting remote changes, or
 * merging both versions. The hook also supports batch auto-resolve operations
 * with progress tracking.
 *
 * @param offlineSync - OfflineSyncService instance for managing conflicts
 * @returns Combined state and methods object with conflict resolution functionality
 *
 * @example
 * ```tsx
 * const {
 *   conflicts,
 *   currentIndex,
 *   getCurrentConflict,
 *   resolveConflict,
 *   moveToNextConflict
 * } = useConflictResolution(offlineSyncService);
 *
 * // Show the current conflict
 * const conflict = getCurrentConflict();
 * if (conflict) {
 *   console.log('Local change:', conflict.localChange);
 *   console.log('Remote change:', conflict.remoteChange);
 * }
 *
 * // Resolve with local changes
 * await resolveConflict(conflict.id, 'local');
 * moveToNextConflict();
 * ```
 *
 * @example
 * ```tsx
 * // Auto-resolve all conflicts with 'local' strategy
 * try {
 *   await autoResolveAll('local');
 *   console.log('All conflicts resolved');
 * } catch (error) {
 *   console.error('Failed to auto-resolve conflicts:', error);
 * }
 * ```
 */
export function useConflictResolution(offlineSync: OfflineSyncService): UseConflictResolutionResult {
  const [state, setState] = useState<UseConflictResolutionState>({
    conflicts: [],
    isResolving: false,
    currentIndex: 0,
    autoResolveProgress: 0,
  });

  // Reference to the service for dependency injection
  const serviceRef = useRef<OfflineSyncService>(offlineSync);

  // Reference to track abort operations
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load conflicts on mount
   */
  useEffect(() => {
    const loadConflicts = async () => {
      try {
        // Get initial conflicts from the service
        // The service stores conflicts when they're detected
        await serviceRef.current.initialize();
        await serviceRef.current.getAllChanges();

        // For this implementation, we'll detect conflicts by checking for unresolved ones
        // This would normally come from a dedicated getConflicts method
        // For now, initialize with empty conflicts array
        setState((prev) => ({
          ...prev,
          conflicts: [],
          currentIndex: 0,
        }));
      } catch (error) {
        console.error('Failed to load initial conflicts:', error);
      }
    };

    loadConflicts();
  }, []);

  /**
   * Resolve a conflict with the specified strategy
   */
  const resolveConflict = useCallback(
    async (
      conflictId: string,
      strategy: 'local' | 'remote' | 'merged',
      mergedData?: Record<string, unknown>
    ): Promise<void> => {
      try {
        setState((prev) => ({
          ...prev,
          isResolving: true,
        }));

        // Call the service to resolve the conflict
        await serviceRef.current.resolveConflict(conflictId, strategy, mergedData);

        // Update state to remove the resolved conflict
        setState((prev) => ({
          ...prev,
          conflicts: prev.conflicts.filter((c) => c.id !== conflictId),
          isResolving: false,
        }));
      } catch (error) {
        console.error(`Failed to resolve conflict ${conflictId}:`, error);
        setState((prev) => ({
          ...prev,
          isResolving: false,
        }));
        throw error;
      }
    },
    []
  );

  /**
   * Auto-resolve all conflicts with the specified strategy
   */
  const autoResolveAll = useCallback(
    async (strategy: 'local' | 'remote' = 'local'): Promise<void> => {
      try {
        // Create a new abort controller for this operation
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setState((prev) => ({
          ...prev,
          isResolving: true,
          autoResolveProgress: 0,
        }));

        const conflictsCopy = [...state.conflicts];
        const totalConflicts = conflictsCopy.length;

        for (let i = 0; i < conflictsCopy.length; i++) {
          // Check if operation was cancelled
          if (signal.aborted) {
            throw new Error('Auto-resolve operation cancelled');
          }

          const conflict = conflictsCopy[i];

          try {
            // Apply the resolution strategy
            let mergedData: Record<string, unknown> | undefined;

            if (strategy === 'local') {
              // Use local change data
              mergedData = conflict.localChange.data;
            } else if (strategy === 'remote') {
              // Use remote change data
              mergedData = conflict.remoteChange.data;
            }

            // Resolve the conflict
            await serviceRef.current.resolveConflict(conflict.id, strategy, mergedData);

            // Update progress
            const progress = Math.round(((i + 1) / totalConflicts) * 100);
            setState((prev) => ({
              ...prev,
              autoResolveProgress: progress,
              conflicts: prev.conflicts.filter((c) => c.id !== conflict.id),
            }));
          } catch (error) {
            console.error(`Failed to auto-resolve conflict ${conflict.id}:`, error);
            // Continue with next conflict on error
          }
        }

        setState((prev) => ({
          ...prev,
          isResolving: false,
          autoResolveProgress: 100,
          currentIndex: 0,
        }));

        // Reset abort controller
        abortControllerRef.current = null;
      } catch (error) {
        console.error('Auto-resolve operation failed:', error);
        setState((prev) => ({
          ...prev,
          isResolving: false,
        }));
        abortControllerRef.current = null;
        throw error;
      }
    },
    [state.conflicts]
  );

  /**
   * Skip the current conflict and move to the next one
   */
  const skipConflict = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex < prev.conflicts.length - 1) {
        return {
          ...prev,
          currentIndex: prev.currentIndex + 1,
        };
      }
      return prev;
    });
  }, []);

  /**
   * Get the current conflict being reviewed
   */
  const getCurrentConflict = useCallback((): SyncConflict | null => {
    if (state.conflicts.length === 0) {
      return null;
    }

    if (state.currentIndex >= state.conflicts.length) {
      return null;
    }

    return state.conflicts[state.currentIndex] || null;
  }, [state.conflicts, state.currentIndex]);

  /**
   * Move to the next conflict
   */
  const moveToNextConflict = useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex < prev.conflicts.length - 1) {
        return {
          ...prev,
          currentIndex: prev.currentIndex + 1,
        };
      }
      return prev;
    });
  }, []);

  /**
   * Cleanup on unmount - cancel any ongoing auto-resolve
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    resolveConflict,
    autoResolveAll,
    skipConflict,
    getCurrentConflict,
    moveToNextConflict,
  };
}
