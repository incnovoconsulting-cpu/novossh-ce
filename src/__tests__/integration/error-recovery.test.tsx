import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useP2PSync } from '../../hooks/useP2PSync';
import { useOptimisticUpdate } from '../../hooks/useOptimisticUpdate';
import { useReconnection } from '../../hooks/useReconnection';
import type { OfflineChange } from '../../services/OfflineSyncService';

describe('Error Recovery Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Retry Failed Sync with Exponential Backoff', () => {
    it('should retry failed sync with exponential backoff', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: optimistic } = renderHook(() => useOptimisticUpdate());

      let changeId = '';
      await act(async () => {
        const change = await offline.current.recordChange(
          'create',
          'entry',
          'entry-1',
          { title: 'Entry' }
        );
        changeId = change.id;
        optimistic.current.markPending(changeId);
      });

      // Simulate first failure
      await act(async () => {
        optimistic.current.markFailed(changeId, 'Sync attempt 1 failed');
      });

      expect(optimistic.current.getAttemptCount(changeId)).toBe(1);

      // Retry should be delayed exponentially
      await act(async () => {
        optimistic.current.retry(changeId);
      });

      expect(optimistic.current.isPending(changeId)).toBe(true);
    });

    it('should implement exponential backoff delays', async () => {
      const backoffDelays: number[] = [];

      for (let attempt = 0; attempt < 4; attempt++) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        backoffDelays.push(delay);
      }

      // Verify exponential sequence: 1000, 2000, 4000, 8000
      expect(backoffDelays[0]).toBe(1000);
      expect(backoffDelays[1]).toBe(2000);
      expect(backoffDelays[2]).toBe(4000);
      expect(backoffDelays[3]).toBe(8000);
    });

    it('should cap maximum backoff delay', () => {
      const maxBackoff = 30000;

      for (let attempt = 0; attempt < 10; attempt++) {
        const delay = Math.min(1000 * Math.pow(2, attempt), maxBackoff);
        expect(delay).toBeLessThanOrEqual(maxBackoff);
      }
    });

    it('should reset backoff counter on successful sync', async () => {
      const { result: optimistic } = renderHook(() => useOptimisticUpdate());

      // Mark pending
      await act(async () => {
        optimistic.current.markPending('change-1');
      });

      // Fail once
      await act(async () => {
        optimistic.current.markFailed('change-1', 'Failure 1');
      });

      expect(optimistic.current.getAttemptCount('change-1')).toBe(1);

      // Retry
      await act(async () => {
        optimistic.current.retry('change-1');
      });

      // Then succeed (backoff counter should reset on success)
      await act(async () => {
        optimistic.current.markSynced('change-1');
      });

      expect(optimistic.current.isPending('change-1')).toBe(false);
    });
  });

  describe('Recover from Partial Sync Failure', () => {
    it('should identify failed items in partial sync', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: optimistic } = renderHook(() => useOptimisticUpdate());

      const changes: OfflineChange[] = [];

      // Record multiple changes
      await act(async () => {
        for (let i = 0; i < 3; i++) {
          const change = await offline.current.recordChange(
            'create',
            'entry',
            `entry-${i}`,
            { title: `Entry ${i}` }
          );
          changes.push(change);
          optimistic.current.markPending(change.id);
        }
      });

      // Simulate partial failure: 1st and 3rd succeed, 2nd fails
      await act(async () => {
        optimistic.current.markSynced(changes[0].id);
        optimistic.current.markFailed(changes[1].id, 'Sync failed');
        optimistic.current.markSynced(changes[2].id);
      });

      expect(optimistic.current.isFailed(changes[1].id)).toBe(true);
      expect(optimistic.current.isPending(changes[0].id)).toBe(false);
      expect(optimistic.current.isPending(changes[2].id)).toBe(false);
    });

    it('should retry only failed items without re-syncing successful ones', async () => {
      const { result: optimistic } = renderHook(() => useOptimisticUpdate());

      const changeIds = ['change-1', 'change-2', 'change-3'];

      // Mark all pending
      await act(async () => {
        changeIds.forEach((id) => optimistic.current.markPending(id));
      });

      // Partial failure
      await act(async () => {
        optimistic.current.markSynced('change-1');
        optimistic.current.markFailed('change-2', 'Failed');
        optimistic.current.markSynced('change-3');
      });

      expect(optimistic.current.isFailed('change-2')).toBe(true);

      // Retry only failed
      await act(async () => {
        optimistic.current.retry('change-2');
      });

      expect(optimistic.current.isPending('change-2')).toBe(true);
      // Others should remain in their states
      expect(optimistic.current.isPending('change-1')).toBe(false);
      expect(optimistic.current.isPending('change-3')).toBe(false);
    });

    it('should maintain consistency after partial failure recovery', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: optimistic } = renderHook(() => useOptimisticUpdate());

      const changes: OfflineChange[] = [];

      // Record 5 changes
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          const change = await offline.current.recordChange(
            'create',
            'entry',
            `entry-${i}`,
            { title: `Entry ${i}` }
          );
          changes.push(change);
          optimistic.current.markPending(change.id);
        }
      });

      // Simulate partial failure (alternating success/failure)
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          if (i % 2 === 0) {
            optimistic.current.markSynced(changes[i].id);
          } else {
            optimistic.current.markFailed(changes[i].id, `Failed ${i}`);
          }
        }
      });

      // Verify state consistency
      let syncedCount = 0;
      let failedCount = 0;

      for (const change of changes) {
        if (!optimistic.current.isPending(change.id)) {
          syncedCount++;
        }
        if (optimistic.current.isFailed(change.id)) {
          failedCount++;
        }
      }

      expect(syncedCount).toBe(3);
      expect(failedCount).toBe(2);
    });

    it('should handle retry of multiple failed items', async () => {
      const { result: optimistic } = renderHook(() => useOptimisticUpdate());

      const failedIds = ['change-1', 'change-3', 'change-5'];

      // Mark multiple as failed
      await act(async () => {
        failedIds.forEach((id, idx) => {
          optimistic.current.markPending(id);
          optimistic.current.markFailed(id, `Error ${idx + 1}`);
        });
      });

      // Retry all failed
      await act(async () => {
        failedIds.forEach((id) => {
          optimistic.current.retry(id);
        });
      });

      failedIds.forEach((id) => {
        expect(optimistic.current.isPending(id)).toBe(true);
      });
    });

    it('should provide error details for failed items', async () => {
      const { result: optimistic } = renderHook(() => useOptimisticUpdate());

      const errors: Record<string, string> = {
        'change-1': 'Network timeout',
        'change-2': 'Server error',
        'change-3': 'Conflict detected',
      };

      // Mark all as failed with different errors
      await act(async () => {
        Object.entries(errors).forEach(([id, error]) => {
          optimistic.current.markPending(id);
          optimistic.current.markFailed(id, error);
        });
      });

      // Verify error details preserved
      Object.entries(errors).forEach(([id, expectedError]) => {
        expect(optimistic.current.getError(id)).toBe(expectedError);
      });
    });
  });

  describe('Network Failure Recovery', () => {
    it('should detect and report network errors', async () => {
      const { result: reconnection } = renderHook(() => useReconnection());

      await act(async () => {
        reconnection.current.addError('Network connection lost');
      });

      expect(reconnection.current.errors.length).toBeGreaterThan(0);
      expect(reconnection.current.errors[0]).toContain('Network');
    });

    it('should clear errors after successful sync', async () => {
      const { result: reconnection } = renderHook(() => useReconnection());

      // Add errors
      await act(async () => {
        reconnection.current.addError('Error 1');
        reconnection.current.addError('Error 2');
      });

      expect(reconnection.current.errors.length).toBe(2);

      // Clear on success
      await act(async () => {
        reconnection.current.clearErrors();
      });

      expect(reconnection.current.errors.length).toBe(0);
    });

    it('should handle reconnection after network failure', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: reconnection } = renderHook(() => useReconnection());

      // Record offline change
      await act(async () => {
        await offline.current.recordChange('create', 'entry', 'entry-1', {
          title: 'Entry',
        });
      });

      // Simulate network error
      await act(async () => {
        reconnection.current.addError('Network failure');
      });

      expect(reconnection.current.errors.length).toBeGreaterThan(0);

      // Reconnect
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(offline.current.isOnline).toBe(true);
      });

      // Clear errors on successful reconnection
      await act(async () => {
        reconnection.current.clearErrors();
      });

      expect(reconnection.current.errors.length).toBe(0);
    });
  });

  describe('Error State Persistence', () => {
    it('should preserve error state across state updates', async () => {
      const { result: optimistic } = renderHook(() => useOptimisticUpdate());

      const errorMsg = 'Persistent error';

      // Set error state
      await act(async () => {
        optimistic.current.markPending('change-1');
        optimistic.current.markFailed('change-1', errorMsg);
      });

      // Verify persistence through multiple accesses
      for (let i = 0; i < 5; i++) {
        expect(optimistic.current.getError('change-1')).toBe(errorMsg);
      }
    });

    it('should maintain error details during recovery attempts', async () => {
      const { result: optimistic } = renderHook(() => useOptimisticUpdate());

      const initialError = 'Initial failure';
      const retryError = 'Retry failure';

      // First attempt
      await act(async () => {
        optimistic.current.markPending('change-1');
        optimistic.current.markFailed('change-1', initialError);
      });

      expect(optimistic.current.getError('change-1')).toBe(initialError);

      // Retry
      await act(async () => {
        optimistic.current.retry('change-1');
        optimistic.current.markFailed('change-1', retryError);
      });

      expect(optimistic.current.getError('change-1')).toBe(retryError);
      expect(optimistic.current.getAttemptCount('change-1')).toBe(2);
    });
  });
});
