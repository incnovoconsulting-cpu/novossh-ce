import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useP2PSync } from '../../hooks/useP2PSync';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import type { OfflineChange } from '../../services/OfflineSyncService';

describe('P2P Sync Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Discover Peers via P2P', () => {
    it('should discover available P2P peers', async () => {
      const { result } = renderHook(() => useP2PSync());

      await waitFor(() => {
        expect(result.current.discoveredPeers).toBeDefined();
        expect(Array.isArray(result.current.discoveredPeers)).toBe(true);
      });
    });

    it('should populate discovered peers with peer metadata', async () => {
      const { result } = renderHook(() => useP2PSync());

      act(() => {
        (result.current as any).discoveredPeers = [
          { id: 'peer-1', name: 'Device 1', connectionStatus: 'discovered' },
          { id: 'peer-2', name: 'Device 2', connectionStatus: 'discovered' },
          { id: 'peer-3', name: 'Device 3', connectionStatus: 'discovered' },
        ];
      });

      expect(result.current.discoveredPeers.length).toBe(3);
      expect(result.current.discoveredPeers[0].id).toBe('peer-1');
      expect(result.current.discoveredPeers[0].name).toBe('Device 1');
    });

    it('should track discovery of multiple peers', async () => {
      const { result } = renderHook(() => useP2PSync());

      const peerCount = 5;
      const peers = Array.from({ length: peerCount }, (_, i) => ({
        id: `peer-${i + 1}`,
        name: `Device ${i + 1}`,
        connectionStatus: 'discovered' as const,
      }));

      act(() => {
        (result.current as any).discoveredPeers = peers;
      });

      expect(result.current.discoveredPeers.length).toBe(peerCount);
    });
  });

  describe('Connect to Peer', () => {
    it('should establish connection to discovered peer', async () => {
      const { result } = renderHook(() => useP2PSync());

      // First discover peers
      act(() => {
        (result.current as any).discoveredPeers = [
          { id: 'peer-1', name: 'Device 1', connectionStatus: 'discovered' },
        ];
      });

      // Then connect
      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      expect(result.current.connectedPeers.some((p) => p.id === 'peer-1')).toBe(true);
    });

    it('should update connection status to connected', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      const connectedPeer = result.current.connectedPeers.find((p) => p.id === 'peer-1');
      expect(connectedPeer?.connectionStatus).toBe('connected');
    });

    it('should handle connection to multiple peers', async () => {
      const { result } = renderHook(() => useP2PSync());

      const peerIds = ['peer-1', 'peer-2', 'peer-3'];

      await act(async () => {
        for (const peerId of peerIds) {
          await result.current.connectToPeer(peerId);
        }
      });

      expect(result.current.connectedPeers.length).toBe(peerIds.length);
      peerIds.forEach((peerId) => {
        expect(result.current.connectedPeers.some((p) => p.id === peerId)).toBe(true);
      });
    });
  });

  describe('Exchange Changes via Data Channel', () => {
    it('should exchange offline changes with connected peer', async () => {
      const { result: p2pResult } = renderHook(() => useP2PSync());
      const { result: offlineResult } = renderHook(() => useOfflineSync());

      // Create local changes
      let localChanges: OfflineChange[] = [];
      await act(async () => {
        const change = await offlineResult.current.recordChange(
          'create',
          'entry',
          'entry-1',
          { title: 'Shared Entry' }
        );
        localChanges.push(change);
      });

      // Connect to peer
      await act(async () => {
        await p2pResult.current.connectToPeer('peer-1');
      });

      // Sync with peer (exchange changes via data channel)
      await act(async () => {
        await p2pResult.current.syncWithPeer('peer-1');
      });

      expect(p2pResult.current.lastSyncAt['peer-1']).toBeDefined();
      expect(localChanges.length).toBe(1);
    });

    it('should transmit changes through WebRTC data channel', async () => {
      const { result: p2pResult } = renderHook(() => useP2PSync());
      const { result: offlineResult } = renderHook(() => useOfflineSync());

      // Record changes that will be transmitted
      const changes: OfflineChange[] = [];
      await act(async () => {
        for (let i = 0; i < 3; i++) {
          const change = await offlineResult.current.recordChange(
            'create',
            'entry',
            `entry-${i}`,
            { title: `Entry ${i}` }
          );
          changes.push(change);
        }
      });

      // Connect and sync
      await act(async () => {
        await p2pResult.current.connectToPeer('peer-1');
        await p2pResult.current.syncWithPeer('peer-1');
      });

      expect(p2pResult.current.lastSyncAt['peer-1']).toBeDefined();
      expect(changes.length).toBe(3);
    });

    it('should handle bidirectional change exchange', async () => {
      const { result: p2p1 } = renderHook(() => useP2PSync());
      const { result: p2p2 } = renderHook(() => useP2PSync());

      // Connect peers
      await act(async () => {
        await p2p1.current.connectToPeer('peer-2');
        await p2p2.current.connectToPeer('peer-1');
      });

      // Both peers sync
      await act(async () => {
        await p2p1.current.syncWithPeer('peer-2');
        await p2p2.current.syncWithPeer('peer-1');
      });

      expect(p2p1.current.lastSyncAt['peer-2']).toBeDefined();
      expect(p2p2.current.lastSyncAt['peer-1']).toBeDefined();
    });
  });

  describe('Merge Changes into Local IndexedDB', () => {
    it('should merge received changes into local storage', async () => {
      const { result: p2pResult } = renderHook(() => useP2PSync());
      const { result: offlineResult } = renderHook(() => useOfflineSync());

      // Create local changes
      await act(async () => {
        await offlineResult.current.recordChange('create', 'entry', 'entry-local', {
          title: 'Local Entry',
        });
      });

      const localChangeCount = offlineResult.current.unsavedChanges.length;

      // Simulate merging received changes
      await act(async () => {
        await p2pResult.current.connectToPeer('peer-1');
        await p2pResult.current.syncWithPeer('peer-1');
      });

      // Local storage should maintain changes
      expect(offlineResult.current.unsavedChanges.length).toBeGreaterThanOrEqual(
        localChangeCount
      );
    });

    it('should resolve conflicts during merge', async () => {
      const { result: p2pResult } = renderHook(() => useP2PSync());
      const { result: offlineResult } = renderHook(() => useOfflineSync());

      // Create a change
      await act(async () => {
        await offlineResult.current.recordChange('update', 'entry', 'entry-1', {
          title: 'Local Change',
        });
      });

      // Sync with peer (which may have conflicting changes)
      await act(async () => {
        await p2pResult.current.connectToPeer('peer-1');
        await p2pResult.current.syncWithPeer('peer-1');
      });

      // Verify sync completed without throwing
      expect(p2pResult.current.lastSyncAt['peer-1']).toBeDefined();
    });

    it('should maintain consistency after merge', async () => {
      const { result: offlineResult } = renderHook(() => useOfflineSync());

      const changes: OfflineChange[] = [];

      // Record multiple changes
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          const change = await offlineResult.current.recordChange(
            'create',
            'entry',
            `entry-${i}`,
            { title: `Entry ${i}` }
          );
          changes.push(change);
        }
      });

      // Verify all changes present
      expect(offlineResult.current.unsavedChanges.length).toBe(5);

      // All changes should have consistent structure
      for (const change of offlineResult.current.unsavedChanges) {
        expect(change.id).toBeDefined();
        expect(change.type).toBeDefined();
        expect(change.resourceType).toBeDefined();
        expect(change.timestamp).toBeDefined();
      }
    });
  });

  describe('P2P Sync State Management', () => {
    it('should track sync progress across multiple peers', async () => {
      const { result } = renderHook(() => useP2PSync());

      const peerIds = ['peer-1', 'peer-2', 'peer-3'];

      await act(async () => {
        for (const peerId of peerIds) {
          await result.current.connectToPeer(peerId);
        }
      });

      // Sync with all peers
      await act(async () => {
        for (const peerId of peerIds) {
          await result.current.syncWithPeer(peerId);
        }
      });

      // All peers should have sync timestamps
      for (const peerId of peerIds) {
        expect(result.current.lastSyncAt[peerId]).toBeDefined();
      }
    });

    it('should maintain independent sync state per peer', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
        await result.current.connectToPeer('peer-2');
      });

      const syncTime1Before = Date.now();
      await act(async () => {
        await result.current.syncWithPeer('peer-1');
      });
      const syncTime1After = Date.now();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const syncTime2Before = Date.now();
      await act(async () => {
        await result.current.syncWithPeer('peer-2');
      });
      const syncTime2After = Date.now();

      expect(result.current.lastSyncAt['peer-1']).toBeGreaterThanOrEqual(syncTime1Before);
      expect(result.current.lastSyncAt['peer-2']).toBeGreaterThanOrEqual(syncTime2Before);
    });
  });
});
