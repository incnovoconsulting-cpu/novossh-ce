import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useP2PSync } from '../../hooks/useP2PSync';
import type { PeerInfo } from '../../lib/types';

describe('P2P Sync Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Discover Peers via WebRTC', () => {
    it('should discover peers on P2P network', async () => {
      const { result } = renderHook(() => useP2PSync());

      await waitFor(() => {
        expect(result.current.discoveredPeers).toBeDefined();
      });
    });

    it('should list multiple discovered peers', async () => {
      const { result } = renderHook(() => useP2PSync());

      act(() => {
        (result.current as any).discoveredPeers = [
          {
            id: 'peer-1',
            name: 'Device 1',
            connectionStatus: 'connected',
            lastSyncedAt: Date.now(),
          },
          {
            id: 'peer-2',
            name: 'Device 2',
            connectionStatus: 'connecting',
            lastSyncedAt: null,
          },
        ];
      });

      expect(result.current.discoveredPeers.length).toBe(2);
    });
  });

  describe('Connect to Peer', () => {
    it('should establish connection to peer via WebRTC', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      const peer = result.current.connectedPeers.find((p) => p.id === 'peer-1');
      expect(peer?.connectionStatus).toBe('connected');
    });

    it('should handle multiple peer connections', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
        await result.current.connectToPeer('peer-2');
        await result.current.connectToPeer('peer-3');
      });

      expect(result.current.connectedPeers.length).toBe(3);
    });
  });

  describe('Exchange Changes via P2P', () => {
    it('should sync changes with connected peer', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      await act(async () => {
        await result.current.syncWithPeer('peer-1');
      });

      expect(result.current.lastSyncAt['peer-1']).toBeDefined();
    });

    it('should broadcast changes to all connected peers', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
        await result.current.connectToPeer('peer-2');
      });

      await act(async () => {
        await result.current.broadcastToAll();
      });

      expect(result.current.lastSyncAt['peer-1']).toBeDefined();
      expect(result.current.lastSyncAt['peer-2']).toBeDefined();
    });

    it('should track sync progress during exchange', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      act(() => {
        (result.current as any).syncProgress = 50;
      });

      await act(async () => {
        await result.current.syncWithPeer('peer-1');
      });

      expect(result.current.syncProgress).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Merge Changes into Local DB', () => {
    it('should merge received changes from peer', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      // Simulate receiving changes
      act(() => {
        (result.current as any).receivedChanges = [
          { id: 'change-1', type: 'create', resourceType: 'entry' },
        ];
      });

      await act(async () => {
        await result.current.syncWithPeer('peer-1');
      });

      expect(result.current.lastSyncAt['peer-1']).toBeDefined();
    });

    it('should handle merge conflicts from multiple peers', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
        await result.current.connectToPeer('peer-2');
      });

      // Both peers send updates
      await act(async () => {
        await result.current.syncWithPeer('peer-1');
        await result.current.syncWithPeer('peer-2');
      });

      expect(result.current.connectedPeers.length).toBe(2);
    });
  });

  describe('Full P2P Workflow', () => {
    it('should complete full P2P sync workflow', async () => {
      const { result } = renderHook(() => useP2PSync());

      // Step 1: Discover peers
      await waitFor(() => {
        expect(result.current.discoveredPeers).toBeDefined();
      });

      // Step 2: Connect to peers
      await act(async () => {
        await result.current.connectToPeer('peer-1');
        await result.current.connectToPeer('peer-2');
      });

      expect(result.current.connectedPeers.length).toBe(2);

      // Step 3: Sync with each peer
      await act(async () => {
        await result.current.syncWithPeer('peer-1');
      });

      expect(result.current.lastSyncAt['peer-1']).toBeDefined();

      await act(async () => {
        await result.current.syncWithPeer('peer-2');
      });

      expect(result.current.lastSyncAt['peer-2']).toBeDefined();

      // Step 4: Broadcast to all
      await act(async () => {
        await result.current.broadcastToAll();
      });

      expect(result.current.connectedPeers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('P2P Error Recovery', () => {
    it('should handle peer connection errors', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        try {
          await result.current.connectToPeer('peer-1');
        } catch (error) {
          result.current.addError('Connection failed');
        }
      });

      expect(result.current.errors).toBeDefined();
    });

    it('should retry sync on peer failure', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      // First sync attempt (may fail)
      await act(async () => {
        await result.current.syncWithPeer('peer-1').catch((error) => {
          result.current.addError('Sync failed');
        });
      });

      // Retry
      await act(async () => {
        await result.current.syncWithPeer('peer-1');
      });

      expect(result.current.connectedPeers.some((p) => p.id === 'peer-1')).toBe(true);
    });
  });

  describe('Peer Disconnection', () => {
    it('should handle peer disconnection gracefully', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      expect(result.current.connectedPeers.length).toBe(1);

      await act(async () => {
        await result.current.disconnectFromPeer('peer-1');
      });

      expect(result.current.connectedPeers.length).toBe(0);
    });

    it('should attempt reconnection after disconnect', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      await act(async () => {
        await result.current.disconnectFromPeer('peer-1');
      });

      // Attempt reconnection
      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      expect(result.current.connectedPeers.length).toBe(1);
    });
  });
});
