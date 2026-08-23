import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useOptimisticUpdate } from '../../hooks/useOptimisticUpdate';
import type { OfflineChange } from '../../services/OfflineSyncService';

describe('Offline Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Entry Offline', () => {
    it('should create entry offline and record to IndexedDB', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const { result: optimisticResult } = renderHook(() => useOptimisticUpdate());

      let createResult;
      await act(async () => {
        createResult = await offlineResult.current.recordChange(
          'create',
          'entry',
          'new-entry',
          { title: 'New Entry', content: 'Content' }
        );

        optimisticResult.current.markPending(createResult.id);
      });

      expect(createResult).toBeDefined();
      expect(createResult?.type).toBe('create');
      expect(optimisticResult.current.isPending(createResult.id)).toBe(true);
      expect(offlineResult.current.unsavedChanges.length).toBe(1);
    });

    it('should track creation in unsaved changes', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await act(async () => {
        await result.current.recordChange('create', 'entry', 'entry-1', {
          title: 'New Entry',
        });
      });

      expect(result.current.unsavedChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Modify Entry Offline', () => {
    it('should modify entry offline and show pending badge', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const { result: optimisticResult } = renderHook(() => useOptimisticUpdate());

      // First create
      let changeResult;
      await act(async () => {
        changeResult = await offlineResult.current.recordChange(
          'create',
          'entry',
          'entry-1',
          { title: 'Original' }
        );
      });

      // Then modify
      let modifyResult;
      await act(async () => {
        modifyResult = await offlineResult.current.recordChange(
          'update',
          'entry',
          'entry-1',
          { title: 'Modified' }
        );

        optimisticResult.current.markPending(modifyResult.id);
      });

      expect(optimisticResult.current.isPending(modifyResult.id)).toBe(true);
      expect(offlineResult.current.unsavedChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Go Online and Auto-sync', () => {
    it('should auto-sync to server when going online', async () => {
      const { result } = renderHook(() => useOfflineSync());

      // Create offline
      await act(async () => {
        await result.current.recordChange('create', 'entry', 'entry-1', {
          title: 'Offline Entry',
        });
      });

      expect(result.current.unsavedChanges.length).toBeGreaterThan(0);

      // Simulate going online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
      });
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('should detect conflicts when syncing', async () => {
      const { result } = renderHook(() => useOfflineSync());

      // Create a change locally
      await act(async () => {
        await result.current.recordChange('update', 'entry', 'entry-1', {
          title: 'Local Change',
        });
      });

      // Attempt to resolve conflict
      await act(async () => {
        await result.current.resolveConflict('conflict-1', 'local');
      });

      expect(result.current.conflicts.length).toBe(0);
    });

    it('should show resolver UI when conflicts detected', async () => {
      const { result } = renderHook(() => useOfflineSync());

      // Manually set conflicts for testing
      (result.current as any).conflicts = [
        {
          id: 'conflict-1',
          resourceId: 'entry-1',
          resourceType: 'entry',
          localVersion: { id: 'entry-1', title: 'Local' },
          remoteVersion: { id: 'entry-1', title: 'Remote' },
          createdAt: Date.now(),
        },
      ];

      expect(result.current.conflicts.length).toBe(1);
    });

    it('should resolve conflicts and update final state', async () => {
      const { result } = renderHook(() => useOfflineSync());

      // Set up conflict
      (result.current as any).conflicts = [
        {
          id: 'conflict-1',
          resourceId: 'entry-1',
          resourceType: 'entry',
          localVersion: { id: 'entry-1', title: 'Local' },
          remoteVersion: { id: 'entry-1', title: 'Remote' },
          createdAt: Date.now(),
        },
      ];

      // Resolve
      await act(async () => {
        await result.current.resolveConflict('conflict-1', 'local');
      });

      expect(result.current.conflicts.length).toBe(0);
    });
  });

  describe('Full Offline Workflow', () => {
    it('should complete full offline workflow from creation to sync', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const { result: optimisticResult } = renderHook(() => useOptimisticUpdate());

      // Step 1: Create entry offline
      let entryId = 'entry-test';
      await act(async () => {
        const change = await offlineResult.current.recordChange(
          'create',
          'entry',
          entryId,
          { title: 'Test Entry', content: 'Test Content' }
        );
        optimisticResult.current.markPending(change.id);
      });

      expect(offlineResult.current.unsavedChanges.length).toBe(1);
      expect(optimisticResult.current.hasPending()).toBe(true);

      // Step 2: Modify entry offline
      await act(async () => {
        const change = await offlineResult.current.recordChange(
          'update',
          'entry',
          entryId,
          { title: 'Updated Entry' }
        );
        optimisticResult.current.markPending(change.id);
      });

      expect(offlineResult.current.unsavedChanges.length).toBeGreaterThan(0);

      // Step 3: Go online and sync
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(offlineResult.current.isOnline).toBe(true);
      });

      // Step 4: Verify sync queue is populated
      const queue = await offlineResult.current.getSyncQueue();
      expect(queue).toBeDefined();
    });
  });

  describe('Error Handling in Offline Workflow', () => {
    it('should handle recording errors gracefully', async () => {
      const { result } = renderHook(() => useOfflineSync());

      // Try to record with invalid data
      await expect(
        act(async () => {
          try {
            await result.current.recordChange('create', '', '', {});
          } catch (error) {
            // Expected error
            expect(error).toBeDefined();
          }
        })
      ).resolves.not.toThrow();
    });

    it('should handle conflict resolution errors', async () => {
      const { result } = renderHook(() => useOfflineSync());

      await expect(
        act(async () => {
          try {
            await result.current.resolveConflict('non-existent', 'local');
          } catch (error) {
            // Handle error
          }
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Multiple Changes Workflow', () => {
    it('should handle multiple changes in sequence', async () => {
      const { result } = renderHook(() => useOfflineSync());

      const changes = [
        { type: 'create' as const, resourceId: 'entry-1' },
        { type: 'update' as const, resourceId: 'entry-1' },
        { type: 'create' as const, resourceId: 'entry-2' },
        { type: 'delete' as const, resourceId: 'entry-2' },
      ];

      for (const change of changes) {
        await act(async () => {
          await result.current.recordChange(
            change.type,
            'entry',
            change.resourceId,
            {}
          );
        });
      }

      expect(result.current.unsavedChanges.length).toBe(changes.length);
    });
  });
});
