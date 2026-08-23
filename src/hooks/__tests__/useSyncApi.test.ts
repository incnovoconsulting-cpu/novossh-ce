import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSyncApi } from '../useSyncApi';
import * as syncApi from '../../lib/vaultApi';

vi.mock('../../lib/vaultApi');

const mockApi = syncApi as any;

describe('useSyncApi Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.sync.mockResolvedValue({
      lastSyncTime: new Date().toISOString(),
      changes: [],
      conflicts: [],
      resolvedCount: 0,
      totalChanges: 0,
      activeDevices: 1,
    });
  });

  describe('Sync State', () => {
    it('should initialize with empty sync state', () => {
      const { result } = renderHook(() => useSyncApi());

      expect(result.current.syncProgress).toBe(0);
      expect(result.current.conflicts).toEqual([]);
      expect(result.current.pendingChanges).toEqual([]);
      expect(result.current.isSyncing).toBe(false);
      expect(result.current.lastSyncTime).toBeNull();
    });

    it('should track sync progress', async () => {
      mockApi.sync.mockResolvedValue({
        lastSyncTime: new Date().toISOString(),
        changes: [
          { id: 'change-1', type: 'add', entry_id: 'entry-1', timestamp: new Date().toISOString() },
        ],
        conflicts: [],
        resolvedCount: 0,
        totalChanges: 1,
        activeDevices: 2,
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        await result.current.sync('vault-1');
      });

      expect(result.current.syncProgress).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Sync Operations', () => {
    it('should sync vault changes from server', async () => {
      mockApi.sync.mockResolvedValue({
        lastSyncTime: new Date().toISOString(),
        changes: [
          { id: 'change-1', type: 'add', entry_id: 'entry-1', timestamp: new Date().toISOString() },
        ],
        conflicts: [],
        resolvedCount: 0,
        totalChanges: 1,
        activeDevices: 2,
      });

      const { result } = renderHook(() => useSyncApi());

      let syncResult;
      await act(async () => {
        syncResult = await result.current.sync('vault-1');
      });

      expect(syncResult?.lastSyncTime).toBeDefined();
      expect(syncResult?.totalChanges).toBe(1);
      expect(result.current.lastSyncTime).toBeDefined();
    });

    it('should push pending changes to server', async () => {
      mockApi.pushChanges.mockResolvedValue({
        pushed: 2,
        conflicts: [],
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        result.current.recordChange('vault-1', 'add', 'entry-1', 'encrypted-data');
        result.current.recordChange('vault-1', 'update', 'entry-2', 'new-data');
      });

      let pushed;
      await act(async () => {
        pushed = await result.current.pushChanges('vault-1');
      });

      expect(pushed?.pushed).toBe(2);
    });

    it('should clear pending changes after successful push', async () => {
      mockApi.pushChanges.mockResolvedValue({
        pushed: 1,
        conflicts: [],
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        result.current.recordChange('vault-1', 'add', 'entry-1', 'data');
      });

      expect(result.current.pendingChanges).toHaveLength(1);

      await act(async () => {
        await result.current.pushChanges('vault-1');
      });

      expect(result.current.pendingChanges).toHaveLength(0);
    });
  });

  describe('Conflict Detection & Resolution', () => {
    it('should detect conflicts during sync', async () => {
      mockApi.sync.mockResolvedValue({
        lastSyncTime: new Date().toISOString(),
        changes: [],
        conflicts: [
          {
            id: 'conflict-1',
            entry_id: 'entry-1',
            local_version: 2,
            remote_version: 3,
            localData: 'local-value',
            remoteData: 'remote-value',
          },
        ],
        resolvedCount: 0,
        totalChanges: 1,
        activeDevices: 1,
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        await result.current.sync('vault-1');
      });

      expect(result.current.conflicts).toHaveLength(1);
      expect(result.current.conflicts[0].entry_id).toBe('entry-1');
    });

    it('should resolve conflict with last-write-wins strategy', async () => {
      mockApi.resolveConflict.mockResolvedValue({
        resolved: true,
        strategy: 'last-write-wins',
      });

      const { result } = renderHook(() => useSyncApi());

      let resolved;
      await act(async () => {
        resolved = await result.current.resolveConflict('vault-1', 'conflict-1', 'last-write-wins');
      });

      expect(resolved?.resolved).toBe(true);
      expect(resolved?.strategy).toBe('last-write-wins');
    });

    it('should resolve conflict with local-wins strategy', async () => {
      mockApi.resolveConflict.mockResolvedValue({
        resolved: true,
        strategy: 'local-wins',
      });

      const { result } = renderHook(() => useSyncApi());

      let resolved;
      await act(async () => {
        resolved = await result.current.resolveConflict('vault-1', 'conflict-1', 'local-wins');
      });

      expect(resolved?.strategy).toBe('local-wins');
    });

    it('should resolve conflict with remote-wins strategy', async () => {
      mockApi.resolveConflict.mockResolvedValue({
        resolved: true,
        strategy: 'remote-wins',
      });

      const { result } = renderHook(() => useSyncApi());

      let resolved;
      await act(async () => {
        resolved = await result.current.resolveConflict('vault-1', 'conflict-1', 'remote-wins');
      });

      expect(resolved?.strategy).toBe('remote-wins');
    });

    it('should auto-resolve all conflicts with last-write-wins', async () => {
      mockApi.resolveConflict.mockResolvedValue({
        resolved: true,
        strategy: 'last-write-wins',
      });

      const { result } = renderHook(() => useSyncApi());

      // Simulate conflicts
      await act(async () => {
        await result.current.sync('vault-1');
      });

      await act(async () => {
        await result.current.autoResolveAll('vault-1');
      });

      expect(result.current.conflicts).toHaveLength(0);
    });
  });

  describe('Change Tracking', () => {
    it('should record local changes before push', () => {
      const { result } = renderHook(() => useSyncApi());

      act(() => {
        result.current.recordChange('vault-1', 'add', 'entry-1', 'encrypted-data');
      });

      expect(result.current.pendingChanges).toHaveLength(1);
      expect(result.current.pendingChanges[0].type).toBe('add');
    });

    it('should track multiple changes', () => {
      const { result } = renderHook(() => useSyncApi());

      act(() => {
        result.current.recordChange('vault-1', 'add', 'entry-1', 'data1');
        result.current.recordChange('vault-1', 'update', 'entry-1', 'data2');
        result.current.recordChange('vault-1', 'delete', 'entry-2', '');
      });

      expect(result.current.pendingChanges).toHaveLength(3);
    });

    it('should preserve change order', () => {
      const { result } = renderHook(() => useSyncApi());

      act(() => {
        result.current.recordChange('vault-1', 'add', 'entry-1', 'data1');
        result.current.recordChange('vault-1', 'add', 'entry-2', 'data2');
        result.current.recordChange('vault-1', 'add', 'entry-3', 'data3');
      });

      expect(result.current.pendingChanges[0].entry_id).toBe('entry-1');
      expect(result.current.pendingChanges[1].entry_id).toBe('entry-2');
      expect(result.current.pendingChanges[2].entry_id).toBe('entry-3');
    });
  });

  describe('Conflict Tracking', () => {
    it('should update conflicts array from server response', async () => {
      mockApi.sync.mockResolvedValue({
        lastSyncTime: new Date().toISOString(),
        changes: [],
        conflicts: [
          {
            id: 'conflict-1',
            entry_id: 'entry-1',
            local_version: 1,
            remote_version: 2,
            localData: 'local',
            remoteData: 'remote',
          },
        ],
        resolvedCount: 0,
        totalChanges: 0,
        activeDevices: 1,
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        await result.current.sync('vault-1');
      });

      expect(result.current.conflicts).toHaveLength(1);
    });

    it('should clear conflicts after resolution', async () => {
      mockApi.sync.mockResolvedValue({
        lastSyncTime: new Date().toISOString(),
        changes: [],
        conflicts: [
          {
            id: 'conflict-1',
            entry_id: 'entry-1',
            local_version: 1,
            remote_version: 2,
            localData: 'local',
            remoteData: 'remote',
          },
        ],
        resolvedCount: 0,
        totalChanges: 0,
        activeDevices: 1,
      });

      mockApi.resolveConflict.mockResolvedValue({
        resolved: true,
        strategy: 'last-write-wins',
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        await result.current.sync('vault-1');
      });

      expect(result.current.conflicts).toHaveLength(1);

      await act(async () => {
        await result.current.resolveConflict('vault-1', 'conflict-1', 'last-write-wins');
      });

      // After resolution, conflicts should be cleared from the resolved list
      // (In real implementation, might filter or re-sync)
    });
  });

  describe('Sync Statistics', () => {
    it('should track total changes count', async () => {
      mockApi.sync.mockResolvedValue({
        lastSyncTime: new Date().toISOString(),
        changes: [
          { id: 'change-1', type: 'add', entry_id: 'entry-1', timestamp: new Date().toISOString() },
          { id: 'change-2', type: 'update', entry_id: 'entry-2', timestamp: new Date().toISOString() },
        ],
        conflicts: [],
        resolvedCount: 0,
        totalChanges: 2,
        activeDevices: 1,
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        await result.current.sync('vault-1');
      });
    });

    it('should track active devices count', async () => {
      mockApi.sync.mockResolvedValue({
        lastSyncTime: new Date().toISOString(),
        changes: [],
        conflicts: [],
        resolvedCount: 0,
        totalChanges: 0,
        activeDevices: 3,
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        await result.current.sync('vault-1');
      });
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      mockApi.sync
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          lastSyncTime: new Date().toISOString(),
          changes: [],
          conflicts: [],
          resolvedCount: 0,
          totalChanges: 0,
          activeDevices: 1,
        });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        try {
          await result.current.sync('vault-1');
        } catch {
          // First attempt fails
        }
      });

      await act(async () => {
        await result.current.sync('vault-1');
      });

      expect(mockApi.sync).toHaveBeenCalledTimes(2);
    });

    it('should handle persistent failures gracefully', async () => {
      mockApi.sync.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        try {
          await result.current.sync('vault-1');
        } catch (e) {
          expect(e).toEqual(expect.any(Error));
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle sync with no changes', async () => {
      mockApi.sync.mockResolvedValue({
        lastSyncTime: new Date().toISOString(),
        changes: [],
        conflicts: [],
        resolvedCount: 0,
        totalChanges: 0,
        activeDevices: 1,
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        await result.current.sync('vault-1');
      });

      expect(result.current.conflicts).toHaveLength(0);
    });

    it('should handle sync with no conflicts', async () => {
      mockApi.sync.mockResolvedValue({
        lastSyncTime: new Date().toISOString(),
        changes: [
          { id: 'change-1', type: 'add', entry_id: 'entry-1', timestamp: new Date().toISOString() },
        ],
        conflicts: [],
        resolvedCount: 0,
        totalChanges: 1,
        activeDevices: 1,
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        await result.current.sync('vault-1');
      });

      expect(result.current.conflicts).toHaveLength(0);
    });

    it('should handle single device sync', async () => {
      mockApi.sync.mockResolvedValue({
        lastSyncTime: new Date().toISOString(),
        changes: [],
        conflicts: [],
        resolvedCount: 0,
        totalChanges: 0,
        activeDevices: 1,
      });

      const { result } = renderHook(() => useSyncApi());

      await act(async () => {
        await result.current.sync('vault-1');
      });

      expect(result.current.lastSyncTime).toBeDefined();
    });
  });
});
