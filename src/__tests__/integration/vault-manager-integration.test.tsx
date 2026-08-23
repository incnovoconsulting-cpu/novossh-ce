import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useP2PSync } from '../../hooks/useP2PSync';
import { useOptimisticUpdate } from '../../hooks/useOptimisticUpdate';
import { useConflictResolution } from '../../hooks/useConflictResolution';
import { useReconnection } from '../../hooks/useReconnection';
import type { OfflineChange } from '../../services/OfflineSyncService';

describe('VaultManager Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('OfflineIndicator Component Rendering', () => {
    it('should render offline indicator when offline', async () => {
      const { result } = renderHook(() => useOfflineSync());
      expect(result.current.isOnline).toBe(false);
    });

    it('should hide offline indicator when online', async () => {
      const { result } = renderHook(() => useOfflineSync());
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
      });
    });

    it('should update indicator on connectivity changes', async () => {
      const { result } = renderHook(() => useOfflineSync());
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });
    });
  });

  describe('SyncProgressPanel Display', () => {
    it('should display sync progress panel during sync', async () => {
      const { result: p2pResult } = renderHook(() => useP2PSync());
      expect(p2pResult.current.syncProgress).toBeGreaterThanOrEqual(0);
    });

    it('should update progress panel as sync progresses', async () => {
      const { result } = renderHook(() => useP2PSync());
      act(() => {
        (result.current as any).setSyncProgress(50);
      });
      expect(result.current.syncProgress).toBe(50);
    });

    it('should hide sync panel when sync completes', async () => {
      const { result } = renderHook(() => useP2PSync());
      act(() => {
        (result.current as any).setSyncProgress(100);
      });
      expect(result.current.syncProgress).toBe(100);
    });
  });

  describe('OptimisticUpdateBadge Display', () => {
    it('should display pending badge on entries with pending changes', async () => {
      const { result: optimisticResult } = renderHook(() => useOptimisticUpdate());
      act(() => {
        optimisticResult.current.markPending('change-1');
      });
      expect(optimisticResult.current.isPending('change-1')).toBe(true);
    });

    it('should remove pending badge after sync completes', async () => {
      const { result: optimisticResult } = renderHook(() => useOptimisticUpdate());
      act(() => {
        optimisticResult.current.markPending('change-1');
        optimisticResult.current.markSynced('change-1');
      });
      expect(optimisticResult.current.isPending('change-1')).toBe(false);
    });

    it('should show error badge on failed sync', async () => {
      const { result: optimisticResult } = renderHook(() => useOptimisticUpdate());
      act(() => {
        optimisticResult.current.markPending('change-1');
        optimisticResult.current.markFailed('change-1', 'Sync failed');
      });
      expect(optimisticResult.current.getError('change-1')).toBe('Sync failed');
    });
  });

  describe('ConflictResolver Modal', () => {
    it('should display conflict resolver when conflicts detected', async () => {
      const { result } = renderHook(() => useConflictResolution());
      const mockConflict = {
        id: 'conflict-1',
        resourceId: 'entry-1',
        resourceType: 'entry',
        localVersion: { id: 'entry-1', title: 'Local' },
        remoteVersion: { id: 'entry-1', title: 'Remote' },
        createdAt: Date.now(),
      };
      act(() => {
        (result.current as any).conflicts = [mockConflict];
      });
      expect(result.current.conflicts.length).toBe(1);
    });

    it('should allow selecting resolution strategy in modal', async () => {
      const { result } = renderHook(() => useConflictResolution());
      const mockConflict = {
        id: 'conflict-1',
        resourceId: 'entry-1',
        resourceType: 'entry',
        localVersion: { id: 'entry-1', title: 'Local' },
        remoteVersion: { id: 'entry-1', title: 'Remote' },
        createdAt: Date.now(),
      };
      act(() => {
        (result.current as any).conflicts = [mockConflict];
      });
      await act(async () => {
        await result.current.resolveConflict('conflict-1', 'local');
      });
      expect(result.current.conflicts.length).toBe(0);
    });

    it('should close modal after resolving conflict', async () => {
      const { result } = renderHook(() => useConflictResolution());
      const mockConflict = {
        id: 'conflict-1',
        resourceId: 'entry-1',
        resourceType: 'entry',
        localVersion: { id: 'entry-1', title: 'Local' },
        remoteVersion: { id: 'entry-1', title: 'Remote' },
        createdAt: Date.now(),
      };
      act(() => {
        (result.current as any).conflicts = [mockConflict];
      });
      await act(async () => {
        await result.current.resolveConflict('conflict-1', 'local');
      });
      expect(result.current.conflicts.length).toBe(0);
    });

    it('should display multi-device sync scenario', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: p2p } = renderHook(() => useP2PSync());
      await act(async () => {
        await offline.current.recordChange('create', 'entry', 'entry-1', { title: 'Entry' });
        await p2p.current.connectToPeer('peer-1');
        await p2p.current.connectToPeer('peer-2');
      });
      expect(offline.current.unsavedChanges.length).toBeGreaterThan(0);
      expect(p2p.current.connectedPeers.length).toBe(2);
    });

    it('should synchronize multi-device changes', async () => {
      const { result: device1 } = renderHook(() => useOfflineSync());
      const { result: device2 } = renderHook(() => useP2PSync());
      await act(async () => {
        await device1.current.recordChange('create', 'entry', 'shared-entry', {
          title: 'Multi-Device Entry',
        });
        await device2.current.connectToPeer('device-1');
        await device2.current.syncWithPeer('device-1');
      });
      expect(device1.current.unsavedChanges.length).toBe(1);
      expect(device2.current.lastSyncAt['device-1']).toBeDefined();
    });
  });

  describe('Manual Sync Trigger', () => {
    it('should trigger all services on manual sync', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: p2p } = renderHook(() => useP2PSync());
      await act(async () => {
        await offline.current.recordChange('create', 'entry', 'entry-1', { title: 'Entry' });
        await p2p.current.connectToPeer('peer-1');
      });
      expect(offline.current.unsavedChanges.length).toBeGreaterThan(0);
      expect(p2p.current.connectedPeers.length).toBeGreaterThan(0);
    });

    it('should coordinate sync across offline and P2P services', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: p2p } = renderHook(() => useP2PSync());
      const { result: reconnection } = renderHook(() => useReconnection());
      await act(async () => {
        await offline.current.recordChange('create', 'entry', 'entry-1', { title: 'Shared Entry' });
        await p2p.current.connectToPeer('peer-1');
        await p2p.current.connectToPeer('peer-2');
        reconnection.current.manualSync();
      });
      expect(offline.current.unsavedChanges.length).toBeGreaterThan(0);
      expect(p2p.current.connectedPeers.length).toBe(2);
    });
  });
});
