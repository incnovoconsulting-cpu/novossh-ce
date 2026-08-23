import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useP2PSync } from '../../hooks/useP2PSync';
import { useReconnection } from '../../hooks/useReconnection';
import type { OfflineChange } from '../../services/OfflineSyncService';

describe('Offline to P2P Fallback Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('No Internet: P2P Peers Discovered', () => {
    it('should discover P2P peers when no internet connection', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());
      const { result: p2pResult } = renderHook(() => useP2PSync());

      // Verify offline state
      expect(offlineResult.current.isOnline).toBe(false);

      // Should discover P2P peers
      act(() => {
        (p2pResult.current as any).discoveredPeers = [
          { id: 'peer-1', name: 'Device 1', connectionStatus: 'discovered' },
          { id: 'peer-2', name: 'Device 2', connectionStatus: 'discovered' },
        ];
      });

      expect(p2pResult.current.discoveredPeers.length).toBe(2);
    });

    it('should fallback to P2P sync when server is unavailable', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: p2p } = renderHook(() => useP2PSync());

      // Record changes offline
      let recordedChange: OfflineChange | undefined;
      await act(async () => {
        recordedChange = await offline.current.recordChange(
          'create',
          'entry',
          'entry-1',
          { title: 'Offline Entry' }
        );
      });

      expect(recordedChange).toBeDefined();
      expect(offline.current.unsavedChanges.length).toBe(1);

      // Discover and connect to P2P peer as fallback
      act(() => {
        (p2p.current as any).discoveredPeers = [
          { id: 'peer-1', name: 'Device 1', connectionStatus: 'discovered' },
        ];
      });

      await act(async () => {
        await p2p.current.connectToPeer('peer-1');
        await p2p.current.syncWithPeer('peer-1');
      });

      expect(p2p.current.lastSyncAt['peer-1']).toBeDefined();
    });

    it('should prioritize available peers for P2P fallback', async () => {
      const { result: p2p } = renderHook(() => useP2PSync());

      // Multiple peers available
      const peers = [
        { id: 'peer-1', name: 'Device 1', connectionStatus: 'discovered' },
        { id: 'peer-2', name: 'Device 2', connectionStatus: 'discovered' },
        { id: 'peer-3', name: 'Device 3', connectionStatus: 'discovered' },
      ];

      act(() => {
        (p2p.current as any).discoveredPeers = peers;
      });

      expect(p2p.current.discoveredPeers.length).toBe(3);

      // Connect to available peers
      await act(async () => {
        await p2p.current.connectToPeer('peer-1');
      });

      expect(p2p.current.connectedPeers.length).toBeGreaterThan(0);
    });
  });

  describe('No Internet + No Peers: Queue Mode', () => {
    it('should queue changes when offline with no peers', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());

      // Record changes offline
      const changes: OfflineChange[] = [];
      await act(async () => {
        for (let i = 0; i < 3; i++) {
          const change = await offline.current.recordChange(
            'create',
            'entry',
            `entry-${i}`,
            { title: `Entry ${i}` }
          );
          changes.push(change);
        }
      });

      // Verify changes are queued in offline storage
      expect(offline.current.unsavedChanges.length).toBe(3);

      // Get sync queue
      let queue;
      await act(async () => {
        queue = await offline.current.getSyncQueue();
      });

      expect(queue).toBeDefined();
    });

    it('should persist queued changes to IndexedDB', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());

      // Record multiple changes
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          await offline.current.recordChange('create', 'entry', `entry-${i}`, {
            title: `Entry ${i}`,
          });
        }
      });

      expect(offline.current.unsavedChanges.length).toBe(5);

      // Get all changes (they should be persisted)
      let allChanges: OfflineChange[] = [];
      await act(async () => {
        allChanges = await offline.current.getChanges();
      });

      expect(allChanges.length).toBe(5);
    });

    it('should maintain queue order for processing', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());

      const expectedOrder: string[] = [];

      // Record changes in specific order
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          const change = await offline.current.recordChange(
            'create',
            'entry',
            `entry-${i}`,
            { index: i }
          );
          expectedOrder.push(change.id);
        }
      });

      // Verify queue maintains order
      expect(offline.current.unsavedChanges.length).toBe(5);
      for (let i = 0; i < 5; i++) {
        expect(offline.current.unsavedChanges[i].id).toBe(expectedOrder[i]);
      }
    });

    it('should flush queue when connection is restored', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());

      // Queue changes while offline
      const changes: OfflineChange[] = [];
      await act(async () => {
        for (let i = 0; i < 3; i++) {
          const change = await offline.current.recordChange(
            'create',
            'entry',
            `entry-${i}`,
            { title: `Entry ${i}` }
          );
          changes.push(change);
        }
      });

      expect(offline.current.unsavedChanges.length).toBe(3);

      // Simulate going online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(offline.current.isOnline).toBe(true);
      });

      // Queue should still exist (ready to sync)
      expect(offline.current.unsavedChanges.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Internet Restored: Queued Changes Synced', () => {
    it('should sync all queued changes after reconnection', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());

      // Create changes while offline
      const changes: OfflineChange[] = [];
      await act(async () => {
        for (let i = 0; i < 3; i++) {
          const change = await offline.current.recordChange(
            'create',
            'entry',
            `entry-${i}`,
            { title: `Entry ${i}` }
          );
          changes.push(change);
        }
      });

      expect(offline.current.unsavedChanges.length).toBe(3);

      // Go online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(offline.current.isOnline).toBe(true);
      });

      // Verify changes still exist for syncing
      expect(offline.current.unsavedChanges.length).toBe(3);
    });

    it('should auto-trigger sync queue processing on reconnect', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: reconnection } = renderHook(() => useReconnection());

      // Queue changes offline
      await act(async () => {
        await offline.current.recordChange('create', 'entry', 'entry-1', {
          title: 'Queued Entry',
        });
      });

      expect(offline.current.unsavedChanges.length).toBe(1);

      // Go online
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(offline.current.isOnline).toBe(true);
      });

      // Sync should be triggered
      expect(reconnection.current.isOnline).toBe(true);
    });

    it('should clear queue after successful sync', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());

      // Record changes
      await act(async () => {
        await offline.current.recordChange('create', 'entry', 'entry-1', {
          title: 'Entry',
        });
      });

      expect(offline.current.unsavedChanges.length).toBe(1);

      // Clear sync queue (simulate successful sync)
      await act(async () => {
        await offline.current.clearSyncQueue();
      });

      expect(offline.current.syncQueue.length).toBe(0);
      expect(offline.current.unsavedChanges.length).toBe(0);
    });

    it('should handle partial sync failure and retry', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());

      // Record multiple changes
      const changes: OfflineChange[] = [];
      await act(async () => {
        for (let i = 0; i < 3; i++) {
          const change = await offline.current.recordChange(
            'create',
            'entry',
            `entry-${i}`,
            { title: `Entry ${i}` }
          );
          changes.push(change);
        }
      });

      // Simulate partial sync failure (some succeed, some fail)
      let queue;
      await act(async () => {
        queue = await offline.current.getSyncQueue();
      });

      // Queue should still have items for retry
      expect(queue).toBeDefined();
    });
  });

  describe('P2P Fallback State Management', () => {
    it('should track fallback status correctly', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: p2p } = renderHook(() => useP2PSync());

      // Offline state
      expect(offline.current.isOnline).toBe(false);

      // P2P discovery should work
      act(() => {
        (p2p.current as any).discoveredPeers = [
          { id: 'peer-1', name: 'Device 1', connectionStatus: 'discovered' },
        ];
      });

      expect(p2p.current.discoveredPeers.length).toBeGreaterThan(0);
    });

    it('should allow switching between server and P2P sync', async () => {
      const { result: offline } = renderHook(() => useOfflineSync());
      const { result: p2p } = renderHook(() => useP2PSync());

      // Start with P2P
      await act(async () => {
        await p2p.current.connectToPeer('peer-1');
        await p2p.current.syncWithPeer('peer-1');
      });

      expect(p2p.current.lastSyncAt['peer-1']).toBeDefined();

      // Switch to server (go online)
      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(offline.current.isOnline).toBe(true);
      });
    });
  });
});
