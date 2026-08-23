import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOfflineSync } from '../useOfflineSync';

describe('useOfflineSync Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useOfflineSync());

      expect(result.current.isOnline).toBeDefined();
      expect(Array.isArray(result.current.unsavedChanges)).toBe(true);
      expect(Array.isArray(result.current.syncQueue)).toBe(true);
      expect(Array.isArray(result.current.conflicts)).toBe(true);
    });

    it('should start with recording enabled after initialization', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });
    });
  });

  describe('Recording Changes', () => {
    it('should record a create change', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      let changeResult;
      await act(async () => {
        changeResult = await result.current.recordChange(
          'create',
          'entry',
          'entry-123',
          { title: 'New Entry' }
        );
      });

      expect(changeResult).toBeDefined();
      expect(changeResult.type).toBe('create');
      expect(changeResult.resourceType).toBe('entry');
      expect(changeResult.resourceId).toBe('entry-123');
    });

    it('should record an update change', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      let changeResult;
      await act(async () => {
        changeResult = await result.current.recordChange(
          'update',
          'entry',
          'entry-456',
          { title: 'Updated' }
        );
      });

      expect(changeResult?.type).toBe('update');
    });

    it('should record a delete change', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      let changeResult;
      await act(async () => {
        changeResult = await result.current.recordChange(
          'delete',
          'entry',
          'entry-789',
          {}
        );
      });

      expect(changeResult?.type).toBe('delete');
    });

    it('should update lastRecordedAt on each change', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      const before = Date.now();

      await act(async () => {
        await result.current.recordChange('create', 'entry', 'e1', {});
      });

      expect(result.current.lastRecordedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('Getting Changes', () => {
    it('should get all changes', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      // Record a change
      await act(async () => {
        await result.current.recordChange('create', 'entry', 'e1', {});
      });

      // Get changes
      let changes;
      await act(async () => {
        changes = await result.current.getChanges();
      });

      expect(Array.isArray(changes)).toBe(true);
      expect(changes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Sync Queue Management', () => {
    it('should get sync queue', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      let queue;
      await act(async () => {
        queue = await result.current.getSyncQueue();
      });

      expect(Array.isArray(queue)).toBe(true);
    });

    it('should clear sync queue', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      // Record a change first
      await act(async () => {
        await result.current.recordChange('create', 'entry', 'e1', {});
      });

      // Clear the queue
      await act(async () => {
        await result.current.clearSyncQueue();
      });

      expect(result.current.syncQueue.length).toBe(0);
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflict with local strategy', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      await expect(
        act(async () => {
          await result.current.resolveConflict('conflict-1', 'local');
        })
      ).resolves.not.toThrow();
    });

    it('should resolve conflict with remote strategy', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      await expect(
        act(async () => {
          await result.current.resolveConflict('conflict-1', 'remote');
        })
      ).resolves.not.toThrow();
    });

    it('should resolve conflict with merged strategy', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      await expect(
        act(async () => {
          await result.current.resolveConflict('conflict-1', 'merged', {
            title: 'Merged',
          });
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Online/Offline Events', () => {
    it('should detect offline event', async () => {
      const { result } = renderHook(() => useOfflineSync());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });
    });

    it('should detect online event', async () => {
      const { result } = renderHook(() => useOfflineSync());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
      });
    });
  });

  describe('Multiple Resource Types', () => {
    it('should handle different resource types', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      await act(async () => {
        await result.current.recordChange('create', 'entry', 'e1', {});
        await result.current.recordChange('create', 'vault', 'v1', {});
        await result.current.recordChange('create', 'key', 'k1', {});
      });

      expect(result.current.unsavedChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useOfflineSync());

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});
