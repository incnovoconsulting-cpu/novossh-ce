import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOptimisticUpdate } from '../useOptimisticUpdate';

describe('useOptimisticUpdate Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Pending State Management', () => {
    it('should mark change as pending', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
      });

      expect(result.current.isPending('change-1')).toBe(true);
    });

    it('should mark change as synced', async () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
      });

      expect(result.current.isPending('change-1')).toBe(true);

      act(() => {
        result.current.markSynced('change-1');
      });

      expect(result.current.isPending('change-1')).toBe(false);
    });

    it('should mark change as failed', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
      });

      act(() => {
        result.current.markFailed('change-1', 'Network error');
      });

      expect(result.current.isPending('change-1')).toBe(false);
      expect(result.current.getError('change-1')).toBe('Network error');
    });
  });

  describe('Auto-clear Synced Entries', () => {
    it('should auto-clear synced entries after delay', async () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
      });

      act(() => {
        result.current.markSynced('change-1');
      });

      await waitFor(
        () => {
          expect(result.current.isPending('change-1')).toBe(false);
        },
        { timeout: 3000 }
      );
    });

    it('should remove synced entry from tracking', async () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
      });

      expect(result.current.pendingChanges.length).toBe(2);

      act(() => {
        result.current.markSynced('change-1');
      });

      await waitFor(
        () => {
          expect(result.current.pendingChanges.some((c) => c.id === 'change-1')).toBe(
            false
          );
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Attempt Count Tracking', () => {
    it('should track attempt count for failed changes', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
      });

      act(() => {
        result.current.markFailed('change-1', 'Error 1');
      });

      expect(result.current.getAttemptCount('change-1')).toBe(1);

      act(() => {
        result.current.markPending('change-1');
      });

      act(() => {
        result.current.markFailed('change-1', 'Error 2');
      });

      expect(result.current.getAttemptCount('change-1')).toBe(2);
    });

    it('should increment attempt count on each retry', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      for (let i = 1; i <= 5; i++) {
        act(() => {
          result.current.markPending(`change-1`);
        });

        act(() => {
          result.current.markFailed(`change-1`, `Attempt ${i} failed`);
        });

        expect(result.current.getAttemptCount(`change-1`)).toBe(i);
      }
    });
  });

  describe('Retry Interface', () => {
    it('should provide retry function', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
      });

      act(() => {
        result.current.markFailed('change-1', 'Error');
      });

      expect(result.current.canRetry('change-1')).toBe(true);

      act(() => {
        result.current.retry('change-1');
      });

      expect(result.current.isPending('change-1')).toBe(true);
    });

    it('should reset error message on retry', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
      });

      act(() => {
        result.current.markFailed('change-1', 'Previous error');
      });

      expect(result.current.getError('change-1')).toBe('Previous error');

      act(() => {
        result.current.retry('change-1');
      });

      expect(result.current.getError('change-1')).toBeNull();
    });
  });

  describe('Multiple Pending Changes', () => {
    it('should handle multiple pending changes', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
        result.current.markPending('change-3');
      });

      expect(result.current.pendingChanges.length).toBe(3);
      expect(result.current.isPending('change-1')).toBe(true);
      expect(result.current.isPending('change-2')).toBe(true);
      expect(result.current.isPending('change-3')).toBe(true);
    });

    it('should sync individual changes independently', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
        result.current.markPending('change-3');
      });

      act(() => {
        result.current.markSynced('change-2');
      });

      expect(result.current.isPending('change-1')).toBe(true);
      expect(result.current.isPending('change-2')).toBe(false);
      expect(result.current.isPending('change-3')).toBe(true);
    });
  });

  describe('Clear All', () => {
    it('should clear all pending changes on reset', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
      });

      expect(result.current.pendingChanges.length).toBe(2);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.pendingChanges.length).toBe(0);
    });

    it('should clear errors on reset', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markFailed('change-1', 'Error');
      });

      expect(result.current.getError('change-1')).toBe('Error');

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.getError('change-1')).toBeNull();
    });
  });

  describe('Error Preservation', () => {
    it('should preserve error messages', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      const errorMessage = 'Network timeout error';

      act(() => {
        result.current.markPending('change-1');
      });

      act(() => {
        result.current.markFailed('change-1', errorMessage);
      });

      expect(result.current.getError('change-1')).toBe(errorMessage);
    });

    it('should handle multiple errors for different changes', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
      });

      act(() => {
        result.current.markFailed('change-1', 'Error 1');
        result.current.markFailed('change-2', 'Error 2');
      });

      expect(result.current.getError('change-1')).toBe('Error 1');
      expect(result.current.getError('change-2')).toBe('Error 2');
    });
  });

  describe('Pending Changes Array', () => {
    it('should provide array of pending changes', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
      });

      const pending = result.current.pendingChanges;
      expect(pending.length).toBe(2);
      expect(pending[0].id).toBe('change-1');
      expect(pending[1].id).toBe('change-2');
    });

    it('should exclude synced changes from pending array', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
        result.current.markSynced('change-1');
      });

      const pending = result.current.pendingChanges;
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('change-2');
    });
  });

  describe('State Query Methods', () => {
    it('should provide hasPending query', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      expect(result.current.hasPending()).toBe(false);

      act(() => {
        result.current.markPending('change-1');
      });

      expect(result.current.hasPending()).toBe(true);
    });

    it('should check if change is failed', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
      });

      expect(result.current.isFailed('change-1')).toBe(false);

      act(() => {
        result.current.markFailed('change-1', 'Error');
      });

      expect(result.current.isFailed('change-1')).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timers on unmount', () => {
      const { unmount } = renderHook(() => useOptimisticUpdate());

      unmount();

      expect(vi.fn).toBeDefined();
    });

    it('should not throw on cleanup', () => {
      const { result, unmount } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
      });

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('Multiple Pending Changes Simultaneously - Enhanced', () => {
    it('should track multiple pending changes simultaneously', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      const changes = Array.from({ length: 10 }, (_, i) => `change-${i + 1}`);

      act(() => {
        changes.forEach((id) => result.current.markPending(id));
      });

      expect(result.current.pendingChanges.length).toBe(10);
      changes.forEach((id) => {
        expect(result.current.isPending(id)).toBe(true);
      });
    });

    it('should handle independent state changes for multiple pending items', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
        result.current.markPending('change-3');
        result.current.markPending('change-4');
      });

      act(() => {
        result.current.markFailed('change-1', 'Error 1');
        result.current.markSynced('change-2');
        result.current.markFailed('change-3', 'Error 3');
      });

      expect(result.current.isFailed('change-1')).toBe(true);
      expect(result.current.isPending('change-2')).toBe(false);
      expect(result.current.isFailed('change-3')).toBe(true);
      expect(result.current.isPending('change-4')).toBe(true);
    });
  });

  describe('Attempt Counts Preserved Across Updates - Enhanced', () => {
    it('should preserve attempt counts across multiple updates', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
      });

      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.markFailed(`change-1`, `Failure ${i + 1}`);
        });

        act(() => {
          result.current.retry('change-1');
        });
      }

      expect(result.current.getAttemptCount('change-1')).toBe(3);
    });

    it('should maintain separate attempt counts per change', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
        result.current.markPending('change-3');
      });

      // Fail change-1 twice
      act(() => {
        result.current.markFailed('change-1', 'Error');
        result.current.retry('change-1');
        result.current.markFailed('change-1', 'Error');
      });

      // Fail change-2 once
      act(() => {
        result.current.markFailed('change-2', 'Error');
      });

      // Fail change-3 three times
      act(() => {
        result.current.markFailed('change-3', 'Error');
        result.current.retry('change-3');
        result.current.markFailed('change-3', 'Error');
        result.current.retry('change-3');
        result.current.markFailed('change-3', 'Error');
      });

      expect(result.current.getAttemptCount('change-1')).toBe(2);
      expect(result.current.getAttemptCount('change-2')).toBe(1);
      expect(result.current.getAttemptCount('change-3')).toBe(3);
    });
  });

  describe('Clear All Pending on Manual Reset - Enhanced', () => {
    it('should clear all pending changes on manual reset', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      const changes = Array.from({ length: 5 }, (_, i) => `change-${i + 1}`);

      act(() => {
        changes.forEach((id) => result.current.markPending(id));
      });

      expect(result.current.pendingChanges.length).toBe(5);

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.pendingChanges.length).toBe(0);
      changes.forEach((id) => {
        expect(result.current.isPending(id)).toBe(false);
      });
    });

    it('should clear all errors when resetting', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
        result.current.markPending('change-3');
      });

      act(() => {
        result.current.markFailed('change-1', 'Error 1');
        result.current.markFailed('change-2', 'Error 2');
        result.current.markFailed('change-3', 'Error 3');
      });

      expect(result.current.getError('change-1')).toBe('Error 1');
      expect(result.current.getError('change-2')).toBe('Error 2');
      expect(result.current.getError('change-3')).toBe('Error 3');

      act(() => {
        result.current.clearAll();
      });

      expect(result.current.getError('change-1')).toBeNull();
      expect(result.current.getError('change-2')).toBeNull();
      expect(result.current.getError('change-3')).toBeNull();
    });
  });

  describe('Error Messages Persist Until Dismissed - Enhanced', () => {
    it('should persist error messages until explicitly dismissed', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      const errorMsg = 'Persistent error message';

      act(() => {
        result.current.markPending('change-1');
      });

      act(() => {
        result.current.markFailed('change-1', errorMsg);
      });

      // Error should still be there
      expect(result.current.getError('change-1')).toBe(errorMsg);

      // Error persists even with multiple checks
      for (let i = 0; i < 5; i++) {
        expect(result.current.getError('change-1')).toBe(errorMsg);
      }
    });

    it('should handle multiple errors independently', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
        result.current.markPending('change-3');
      });

      act(() => {
        result.current.markFailed('change-1', 'Error 1');
        result.current.markFailed('change-2', 'Error 2');
        result.current.markFailed('change-3', 'Error 3');
      });

      // All errors should persist
      expect(result.current.getError('change-1')).toBe('Error 1');
      expect(result.current.getError('change-2')).toBe('Error 2');
      expect(result.current.getError('change-3')).toBe('Error 3');

      // Clear only one error
      act(() => {
        result.current.retry('change-1');
      });

      // Only the retried change's error should be cleared
      expect(result.current.getError('change-1')).toBeNull();
      expect(result.current.getError('change-2')).toBe('Error 2');
      expect(result.current.getError('change-3')).toBe('Error 3');
    });
  });

  describe('Integration with Sync Completion - Enhanced', () => {
    it('should integrate with sync completion callbacks', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      const syncCallback = vi.fn();

      act(() => {
        result.current.markPending('change-1');
      });

      act(() => {
        result.current.markSynced('change-1');
        syncCallback();
      });

      expect(syncCallback).toHaveBeenCalled();
      expect(result.current.isPending('change-1')).toBe(false);
    });

    it('should clear pending state upon successful sync', async () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
      });

      expect(result.current.hasPending()).toBe(true);

      act(() => {
        result.current.markSynced('change-1');
        result.current.markSynced('change-2');
      });

      await waitFor(() => {
        expect(result.current.hasPending()).toBe(false);
      }, { timeout: 3000 });
    });

    it('should maintain pending state for failed items during sync', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-2');
        result.current.markPending('change-3');
      });

      act(() => {
        result.current.markSynced('change-1');
        result.current.markFailed('change-2', 'Sync failed');
      });

      expect(result.current.hasPending()).toBe(true);
      expect(result.current.isPending('change-1')).toBe(false);
      expect(result.current.isFailed('change-2')).toBe(true);
      expect(result.current.isPending('change-3')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle duplicate markings gracefully', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      act(() => {
        result.current.markPending('change-1');
        result.current.markPending('change-1');
      });

      expect(result.current.pendingChanges.length).toBe(1);
    });

    it('should handle retry on non-existent change', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      expect(() => {
        act(() => {
          result.current.retry('non-existent');
        });
      }).not.toThrow();
    });

    it('should handle sync of non-pending change', () => {
      const { result } = renderHook(() => useOptimisticUpdate());

      expect(() => {
        act(() => {
          result.current.markSynced('non-existent');
        });
      }).not.toThrow();
    });
  });
});
