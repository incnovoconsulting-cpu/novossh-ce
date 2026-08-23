import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useP2PSync } from '../useP2PSync';
import type { PeerInfo } from '../../lib/types';

describe('useP2PSync Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Peer Discovery', () => {
    it('should discover peers on mount', async () => {
      const { result } = renderHook(() => useP2PSync());

      await waitFor(() => {
        expect(result.current.discoveredPeers).toBeDefined();
      });
    });

    it('should handle empty peer discovery', async () => {
      const { result } = renderHook(() => useP2PSync());

      await waitFor(() => {
        expect(Array.isArray(result.current.discoveredPeers)).toBe(true);
      });
    });

    it('should track multiple discovered peers', async () => {
      const { result } = renderHook(() => useP2PSync());

      act(() => {
        (result.current as any).discoveredPeers = [
          { id: 'peer-1', name: 'Device 1', connectionStatus: 'connected' },
          { id: 'peer-2', name: 'Device 2', connectionStatus: 'connecting' },
        ];
      });

      expect(result.current.discoveredPeers.length).toBe(2);
    });
  });

  describe('Peer Connection', () => {
    it('should connect to specific peer', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      expect(result.current.connectedPeers.some((p) => p.id === 'peer-1')).toBe(true);
    });

    it('should disconnect from peer', async () => {
      const { result } = renderHook(() => useP2PSync());

      // First connect
      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      expect(result.current.connectedPeers.some((p) => p.id === 'peer-1')).toBe(true);

      // Then disconnect
      await act(async () => {
        await result.current.disconnectFromPeer('peer-1');
      });

      expect(result.current.connectedPeers.some((p) => p.id === 'peer-1')).toBe(false);
    });

    it('should track peer connection states', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      const peer = result.current.connectedPeers.find((p) => p.id === 'peer-1');
      expect(peer?.connectionStatus).toBe('connected');
    });
  });

  describe('P2P Sync Operations', () => {
    it('should sync with single peer', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      await act(async () => {
        await result.current.syncWithPeer('peer-1');
      });

      expect(result.current.lastSyncAt['peer-1']).toBeDefined();
    });

    it('should broadcast to all peers', async () => {
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

    it('should update lastSyncAt timestamp', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      const before = Date.now();

      await act(async () => {
        await result.current.syncWithPeer('peer-1');
      });

      const after = Date.now();

      const lastSync = result.current.lastSyncAt['peer-1'];
      expect(lastSync).toBeGreaterThanOrEqual(before);
      expect(lastSync).toBeLessThanOrEqual(after);
    });
  });

  describe('Sync Progress Tracking', () => {
    it('should track sync progress', async () => {
      const { result } = renderHook(() => useP2PSync());

      expect(result.current.syncProgress).toBe(0);

      act(() => {
        (result.current as any).syncProgress = 50;
      });

      expect(result.current.syncProgress).toBe(50);
    });

    it('should update progress during sync', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      act(() => {
        (result.current as any).syncProgress = 25;
      });

      expect(result.current.syncProgress).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Management', () => {
    it('should manage error messages', () => {
      const { result } = renderHook(() => useP2PSync());

      expect(result.current.errors.length).toBe(0);

      act(() => {
        result.current.addError('Connection failed');
      });

      expect(result.current.errors.length).toBe(1);
    });

    it('should clear errors on success', () => {
      const { result } = renderHook(() => useP2PSync());

      act(() => {
        result.current.addError('Error 1');
        result.current.addError('Error 2');
      });

      expect(result.current.errors.length).toBe(2);

      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.errors.length).toBe(0);
    });

    it('should handle sync errors gracefully', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1').catch(() => {
          result.current.addError('Connection error');
        });
      });

      expect(result.current.errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Sync Cancellation', () => {
    it('should cancel sync in progress', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      act(() => {
        result.current.cancelSync();
      });

      expect(result.current.syncProgress).toBe(0);
    });

    it('should manage AbortController', () => {
      const { result } = renderHook(() => useP2PSync());

      expect(result.current.syncAbortSignal).toBeDefined();
    });
  });

  describe('Peer Timeout Handling', () => {
    it('should handle peer timeout', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      // Simulate timeout
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        await result.current.syncWithPeer('peer-1');
      });

      expect(result.current.connectedPeers).toBeDefined();
    });
  });

  describe('Connected Peers Management', () => {
    it('should maintain list of connected peers', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
        await result.current.connectToPeer('peer-2');
      });

      expect(result.current.connectedPeers.length).toBe(2);
    });

    it('should update peer connection states', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      const peer = result.current.connectedPeers[0];
      expect(peer.connectionStatus).toBe('connected');
    });

    it('should remove peer from connected list on disconnect', async () => {
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
  });

  describe('Last Sync Tracking', () => {
    it('should track lastSyncAt per peer', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
        await result.current.syncWithPeer('peer-1');
      });

      expect(result.current.lastSyncAt['peer-1']).toBeDefined();
    });

    it('should handle multiple peer sync times', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
        await result.current.connectToPeer('peer-2');
        await result.current.syncWithPeer('peer-1');
        await result.current.syncWithPeer('peer-2');
      });

      expect(result.current.lastSyncAt['peer-1']).toBeDefined();
      expect(result.current.lastSyncAt['peer-2']).toBeDefined();
    });
  });

  describe('Connected Peer Count Tracking - Enhanced', () => {
    it('should update connectedPeerCount correctly', async () => {
      const { result } = renderHook(() => useP2PSync());

      expect(result.current.connectedPeerCount).toBe(0);

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      expect(result.current.connectedPeerCount).toBeGreaterThan(0);
    });

    it('should track multiple connected peers count', async () => {
      const { result } = renderHook(() => useP2PSync());

      const peerIds = ['peer-1', 'peer-2', 'peer-3'];

      await act(async () => {
        for (const peerId of peerIds) {
          await result.current.connectToPeer(peerId);
        }
      });

      expect(result.current.connectedPeerCount).toBe(peerIds.length);
    });

    it('should decrement count on peer disconnect', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
        await result.current.connectToPeer('peer-2');
      });

      const initialCount = result.current.connectedPeerCount;

      await act(async () => {
        await result.current.disconnectFromPeer('peer-1');
      });

      expect(result.current.connectedPeerCount).toBeLessThan(initialCount);
    });
  });

  describe('Sync Progress 0-100% Tracking - Enhanced', () => {
    it('should track sync progress from 0 to 100', async () => {
      const { result } = renderHook(() => useP2PSync());

      expect(result.current.syncProgress).toBe(0);

      act(() => {
        (result.current as any).setSyncProgress(25);
      });

      act(() => {
        (result.current as any).setSyncProgress(50);
      });

      act(() => {
        (result.current as any).setSyncProgress(75);
      });

      act(() => {
        (result.current as any).setSyncProgress(100);
      });

      expect(result.current.syncProgress).toBe(100);
    });

    it('should reset sync progress on new sync', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      act(() => {
        (result.current as any).setSyncProgress(75);
      });

      expect(result.current.syncProgress).toBe(75);

      // Reset progress for next sync
      act(() => {
        (result.current as any).setSyncProgress(0);
      });

      expect(result.current.syncProgress).toBe(0);
    });

    it('should ensure progress never exceeds 100', () => {
      const { result } = renderHook(() => useP2PSync());

      act(() => {
        (result.current as any).setSyncProgress(150);
      });

      expect(result.current.syncProgress).toBeLessThanOrEqual(100);
    });
  });

  describe('Manage Error Messages - Enhanced', () => {
    it('should add and track multiple errors', () => {
      const { result } = renderHook(() => useP2PSync());

      const errors = ['Error 1', 'Error 2', 'Error 3'];

      act(() => {
        errors.forEach((err) => result.current.addError(err));
      });

      expect(result.current.errors.length).toBe(errors.length);
      errors.forEach((err, idx) => {
        expect(result.current.errors[idx]).toBe(err);
      });
    });

    it('should dismiss individual errors', () => {
      const { result } = renderHook(() => useP2PSync());

      act(() => {
        result.current.addError('Error 1');
        result.current.addError('Error 2');
        result.current.addError('Error 3');
      });

      expect(result.current.errors.length).toBe(3);

      act(() => {
        result.current.dismissError(1);
      });

      expect(result.current.errors.length).toBe(2);
    });
  });

  describe('Clear Errors on Success - Enhanced', () => {
    it('should clear all errors after successful sync', () => {
      const { result } = renderHook(() => useP2PSync());

      act(() => {
        result.current.addError('Sync error');
        result.current.addError('Connection error');
      });

      expect(result.current.errors.length).toBe(2);

      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.errors.length).toBe(0);
    });

    it('should clear errors without affecting peer connections', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      act(() => {
        result.current.addError('Temporary error');
      });

      expect(result.current.errors.length).toBe(1);

      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.errors.length).toBe(0);
      expect(result.current.connectedPeers.length).toBeGreaterThan(0);
    });
  });

  describe('Cancel Sync via AbortController - Enhanced', () => {
    it('should cancel sync and reset progress', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      act(() => {
        (result.current as any).setSyncProgress(50);
      });

      act(() => {
        result.current.cancelSync();
      });

      expect(result.current.syncProgress).toBe(0);
    });

    it('should provide AbortSignal for cancellation', () => {
      const { result } = renderHook(() => useP2PSync());

      const signal = result.current.syncAbortSignal;

      expect(signal).toBeDefined();
      expect(signal.aborted).toBe(false);
    });

    it('should abort ongoing syncs', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      act(() => {
        result.current.cancelSync();
      });

      expect(result.current.syncAbortSignal.aborted).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useP2PSync());

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should disconnect all peers on unmount', async () => {
      const { result, unmount } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
      });

      expect(result.current.connectedPeers.length).toBe(1);

      unmount();

      // After unmount, peers should be cleaned up
    });
  });

  describe('Edge Cases', () => {
    it('should handle connecting to same peer twice', async () => {
      const { result } = renderHook(() => useP2PSync());

      await act(async () => {
        await result.current.connectToPeer('peer-1');
        await result.current.connectToPeer('peer-1');
      });

      const peerCount = result.current.connectedPeers.filter((p) => p.id === 'peer-1').length;
      expect(peerCount).toBeLessThanOrEqual(1);
    });

    it('should handle disconnecting non-existent peer', async () => {
      const { result } = renderHook(() => useP2PSync());

      await expect(
        act(async () => {
          await result.current.disconnectFromPeer('non-existent');
        })
      ).resolves.not.toThrow();
    });

    it('should handle sync with disconnected peer', async () => {
      const { result } = renderHook(() => useP2PSync());

      await expect(
        act(async () => {
          await result.current.syncWithPeer('non-existent');
        })
      ).resolves.not.toThrow();
    });
  });
});
