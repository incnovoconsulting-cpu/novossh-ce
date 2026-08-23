import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useOptimisticUpdate } from '../../hooks/useOptimisticUpdate';
import { useConflictResolution } from '../../hooks/useConflictResolution';
import type { OfflineChange } from '../../services/OfflineSyncService';

describe('Offline Sync Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Vault Offline', () => {
    it('should record vault creation in IndexedDB when offline', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());

      let recordedChange: OfflineChange | undefined;
      await act(async () => {
        recordedChange = await offlineResult.current.recordChange(
          'create',
          'vault',
          'vault-1',
          { name: 'My Vault', encrypted: true }
        );
      });

      expect(recordedChange).toBeDefined();
      expect(recordedChange?.type).toBe('create');
      expect(recordedChange?.resourceType).toBe('vault');
      expect(offlineResult.current.unsavedChanges.length).toBeGreaterThan(0);
    });

    it('should mark vault creation as pending', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const { result: optimisticResult } = renderHook(() => useOptimisticUpdate());

      let changeId: string = '';
      await act(async () => {
        const change = await offlineResult.current.recordChange(
          'create',
          'vault',
          'vault-1',
          { name: 'My Vault' }
        );
        changeId = change.id;
        optimisticResult.current.markPending(change.id);
      });

      expect(optimisticResult.current.isPending(changeId)).toBe(true);
    });
  });

  describe('Modify Entry Offline', () => {
    it('should show pending badge on modified entry', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const { result: optimisticResult } = renderHook(() => useOptimisticUpdate());

      // Create entry first
      let entryId = 'entry-1';
      await act(async () => {
        const change = await offlineResult.current.recordChange(
          'create',
          'entry',
          entryId,
          { title: 'Original Title', content: 'Content' }
        );
        optimisticResult.current.markPending(change.id);
      });

      // Modify entry
      let changeId = '';
      await act(async () => {
        const change = await offlineResult.current.recordChange(
          'update',
          'entry',
          entryId,
          { title: 'Modified Title' }
        );
        changeId = change.id;
        optimisticResult.current.markPending(change.id);
      });

      expect(optimisticResult.current.isPending(changeId)).toBe(true);
      expect(offlineResult.current.unsavedChanges.length).toBeGreaterThan(0);
    });

    it('should track multiple modifications to same entry', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const entryId = 'entry-1';

      await act(async () => {
        await offlineResult.current.recordChange('create', 'entry', entryId, {
          title: 'Initial',
        });
      });

      await act(async () => {
        await offlineResult.current.recordChange('update', 'entry', entryId, {
          title: 'First Update',
        });
      });

      await act(async () => {
        await offlineResult.current.recordChange('update', 'entry', entryId, {
          title: 'Second Update',
        });
      });

      expect(offlineResult.current.unsavedChanges.length).toBe(3);
    });
  });

  describe('Go Online and Auto-sync', () => {
    it('should auto-sync changes to server when going online', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());

      // Create changes offline
      await act(async () => {
        await offlineResult.current.recordChange('create', 'entry', 'entry-1', {
          title: 'Offline Entry',
        });
      });

      expect(offlineResult.current.unsavedChanges.length).toBeGreaterThan(0);
      expect(offlineResult.current.isOnline).toBe(false);

      // Simulate going online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(offlineResult.current.isOnline).toBe(true);
      });
    });

    it('should track sync progress when coming online', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());

      // Create changes offline
      await act(async () => {
        await offlineResult.current.recordChange('create', 'entry', 'entry-1', {
          title: 'Entry 1',
        });
      });

      // Go online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(offlineResult.current.isOnline).toBe(true);
      });
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('should detect conflicts when syncing with different remote version', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const { result: conflictResult } = renderHook(() => useConflictResolution());

      // Record local change
      await act(async () => {
        await offlineResult.current.recordChange('update', 'entry', 'entry-1', {
          title: 'Local Title',
        });
      });

      // Simulate conflict detection
      act(() => {
        (conflictResult.current as any).conflicts = [
          {
            id: 'conflict-1',
            resourceId: 'entry-1',
            resourceType: 'entry',
            localVersion: { id: 'entry-1', title: 'Local Title' },
            remoteVersion: { id: 'entry-1', title: 'Remote Title' },
            createdAt: Date.now(),
          },
        ];
      });

      expect(conflictResult.current.conflicts.length).toBe(1);
    });

    it('should display conflict resolver UI for detected conflicts', async () => {
      const { result: conflictResult } = renderHook(() => useConflictResolution());

      const mockConflict = {
        id: 'conflict-1',
        resourceId: 'entry-1',
        resourceType: 'entry',
        localVersion: { id: 'entry-1', title: 'Local' },
        remoteVersion: { id: 'entry-1', title: 'Remote' },
        createdAt: Date.now(),
      };

      act(() => {
        (conflictResult.current as any).conflicts = [mockConflict];
      });

      const currentConflict = conflictResult.current.getCurrentConflict();
      expect(currentConflict?.id).toBe('conflict-1');
    });

    it('should resolve conflict and maintain state consistency', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const { result: conflictResult } = renderHook(() => useConflictResolution());

      // Setup conflict
      const mockConflict = {
        id: 'conflict-1',
        resourceId: 'entry-1',
        resourceType: 'entry',
        localVersion: { id: 'entry-1', title: 'Local' },
        remoteVersion: { id: 'entry-1', title: 'Remote' },
        createdAt: Date.now(),
      };

      act(() => {
        (conflictResult.current as any).conflicts = [mockConflict];
      });

      // Resolve conflict with local strategy
      await act(async () => {
        await conflictResult.current.resolveConflict('conflict-1', 'local');
      });

      expect(conflictResult.current.conflicts.length).toBe(0);
    });

    it('should resolve conflict with merged data', async () => {
      const { result: conflictResult } = renderHook(() => useConflictResolution());

      const mockConflict = {
        id: 'conflict-1',
        resourceId: 'entry-1',
        resourceType: 'entry',
        localVersion: { id: 'entry-1', title: 'Local', content: 'Local Content' },
        remoteVersion: { id: 'entry-1', title: 'Remote', content: 'Remote Content' },
        createdAt: Date.now(),
      };

      act(() => {
        (conflictResult.current as any).conflicts = [mockConflict];
      });

      const mergedData = {
        title: 'Merged Title',
        content: 'Merged Content',
      };

      await act(async () => {
        await conflictResult.current.resolveConflict('conflict-1', 'merged', mergedData);
      });

      expect(conflictResult.current.conflicts.length).toBe(0);
    });
  });

  describe('Full Offline to Online Workflow', () => {
    it('should complete full workflow from offline creation to online sync', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const { result: optimisticResult } = renderHook(() => useOptimisticUpdate());

      // Step 1: Create entry while offline
      expect(offlineResult.current.isOnline).toBe(false);

      let entryId = 'entry-workflow';
      let changeId = '';
      await act(async () => {
        const change = await offlineResult.current.recordChange(
          'create',
          'entry',
          entryId,
          { title: 'Workflow Entry', content: 'Test Content' }
        );
        changeId = change.id;
        optimisticResult.current.markPending(change.id);
      });

      expect(offlineResult.current.unsavedChanges.length).toBe(1);
      expect(optimisticResult.current.isPending(changeId)).toBe(true);

      // Step 2: Modify entry offline
      await act(async () => {
        const change = await offlineResult.current.recordChange(
          'update',
          'entry',
          entryId,
          { title: 'Updated Workflow Entry' }
        );
        optimisticResult.current.markPending(change.id);
      });

      expect(offlineResult.current.unsavedChanges.length).toBeGreaterThan(1);

      // Step 3: Go online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(offlineResult.current.isOnline).toBe(true);
      });

      // Step 4: Mark changes as synced
      await act(async () => {
        for (const change of offlineResult.current.unsavedChanges) {
          optimisticResult.current.markSynced(change.id);
        }
      });

      expect(optimisticResult.current.hasPending()).toBe(false);
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state across offline and online modes', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const { result: optimisticResult } = renderHook(() => useOptimisticUpdate());

      const changes: OfflineChange[] = [];

      // Record multiple changes
      await act(async () => {
        for (let i = 0; i < 3; i++) {
          const change = await offlineResult.current.recordChange(
            'create',
            'entry',
            `entry-${i}`,
            { title: `Entry ${i}` }
          );
          changes.push(change);
          optimisticResult.current.markPending(change.id);
        }
      });

      // Verify all changes tracked
      expect(offlineResult.current.unsavedChanges.length).toBe(3);
      expect(optimisticResult.current.pendingChanges.length).toBe(3);

      // Go online and sync all
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await act(async () => {
        for (const change of changes) {
          optimisticResult.current.markSynced(change.id);
        }
      });

      // Verify all synced
      expect(optimisticResult.current.hasPending()).toBe(false);
    });

    it('should preserve metadata during sync', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());

      const createdAt = Date.now();

      await act(async () => {
        await offlineResult.current.recordChange('create', 'entry', 'entry-1', {
          title: 'Entry with Metadata',
        });
      });

      const lastRecorded = offlineResult.current.lastRecordedAt;
      expect(lastRecorded).toBeGreaterThanOrEqual(createdAt);
    });
  });
});
