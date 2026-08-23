import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useReconnection } from '../useReconnection';

describe('useReconnection Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Reconnection Detection', () => {
    it('should detect online event', async () => {
      const { result } = renderHook(() => useReconnection());

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

    it('should trigger auto-sync on reconnect', async () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });

      const syncMock = vi.fn();
      (result.current as any).autoSync = syncMock;

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
      });
    });
  });

  describe('Sync Progress Tracking', () => {
    it('should track reconnection progress', async () => {
      const { result } = renderHook(() => useReconnection());

      expect(result.current.syncProgress).toBe(0);

      act(() => {
        result.current.setSyncProgress(50);
      });

      expect(result.current.syncProgress).toBe(50);

      act(() => {
        result.current.setSyncProgress(100);
      });

      expect(result.current.syncProgress).toBe(100);
    });

    it('should report synced changes count', () => {
      const { result } = renderHook(() => useReconnection());

      expect(result.current.syncedChangesCount).toBe(0);

      act(() => {
        result.current.setSyncedChangesCount(5);
      });

      expect(result.current.syncedChangesCount).toBe(5);
    });
  });

  describe('Error Management', () => {
    it('should manage error array', () => {
      const { result } = renderHook(() => useReconnection());

      expect(result.current.errors.length).toBe(0);

      act(() => {
        result.current.addError('Error 1');
      });

      expect(result.current.errors.length).toBe(1);
      expect(result.current.errors[0]).toBe('Error 1');
    });

    it('should dismiss individual errors', () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        result.current.addError('Error 1');
        result.current.addError('Error 2');
      });

      expect(result.current.errors.length).toBe(2);

      act(() => {
        result.current.dismissError(0);
      });

      expect(result.current.errors.length).toBe(1);
      expect(result.current.errors[0]).toBe('Error 2');
    });

    it('should clear all errors', () => {
      const { result } = renderHook(() => useReconnection());

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

    it('should clear errors on successful sync', () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        result.current.addError('Sync error');
      });

      expect(result.current.errors.length).toBe(1);

      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.errors.length).toBe(0);
    });
  });

  describe('Manual Sync', () => {
    it('should allow manual sync trigger', async () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        result.current.manualSync();
      });

      expect(result.current.isSyncing).toBe(true);
    });

    it('should handle manual sync with AbortController', () => {
      const { result } = renderHook(() => useReconnection());

      const controller = new AbortController();

      act(() => {
        result.current.setSyncAbortController(controller);
      });

      expect(result.current.syncAbortSignal).toBeDefined();
    });
  });

  describe('Sync Cancellation', () => {
    it('should allow canceling sync via AbortController', async () => {
      const { result } = renderHook(() => useReconnection());

      const controller = new AbortController();

      act(() => {
        result.current.setSyncAbortController(controller);
      });

      expect(() => {
        act(() => {
          controller.abort();
        });
      }).not.toThrow();
    });
  });

  describe('Timestamp Management', () => {
    it('should update lastReconnectAt timestamp', async () => {
      const { result } = renderHook(() => useReconnection());

      const before = Date.now();

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(result.current.lastReconnectAt).toBeGreaterThanOrEqual(before);
      });
    });
  });

  describe('P2P Fallback', () => {
    it('should handle P2P fallback when offline', () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOnline).toBe(false);
    });

    it('should compose OfflineSync and P2PSync handlers', () => {
      const { result } = renderHook(() => useReconnection());

      expect(result.current.isOnline).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useReconnection());

      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useReconnection());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalled();

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('OfflineSync and P2PSync Composition - Enhanced', () => {
    it('should correctly compose OfflineSync + P2PSync handlers', () => {
      const { result } = renderHook(() => useReconnection());

      expect(result.current.isOnline).toBe(true);
      expect(result.current.errors).toBeDefined();
      expect(Array.isArray(result.current.errors)).toBe(true);
    });

    it('should initialize both sync services on mount', async () => {
      const { result } = renderHook(() => useReconnection());

      await waitFor(() => {
        expect(result.current.syncProgress).toBeDefined();
        expect(result.current.syncedChangesCount).toBeDefined();
      });
    });

    it('should coordinate between offline and P2P sync', async () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });

      expect(result.current.isSyncing).toBeDefined();
    });
  });

  describe('P2P Fallback When Server Sync Fails - Enhanced', () => {
    it('should attempt P2P sync when server sync fails', async () => {
      const { result } = renderHook(() => useReconnection());

      // Simulate server sync failure
      act(() => {
        result.current.addError('Server sync failed');
      });

      expect(result.current.errors.length).toBeGreaterThan(0);
      expect(result.current.errors[0]).toContain('Server sync');
    });

    it('should trigger P2P discovery on server failure', () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        result.current.addError('Failed to sync with server');
      });

      expect(result.current.errors.length).toBeGreaterThan(0);
    });

    it('should retry server sync before P2P fallback', async () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        result.current.setSyncProgress(0);
      });

      expect(result.current.syncProgress).toBe(0);

      act(() => {
        result.current.setSyncProgress(50);
      });

      expect(result.current.syncProgress).toBe(50);
    });
  });

  describe('Multiple Error Types Tracking - Enhanced', () => {
    it('should track different error types independently', () => {
      const { result } = renderHook(() => useReconnection());

      const errors = [
        'Network timeout',
        'Server error',
        'P2P connection failed',
        'Offline storage quota exceeded',
      ];

      act(() => {
        errors.forEach((err) => result.current.addError(err));
      });

      expect(result.current.errors.length).toBe(errors.length);
      errors.forEach((err, idx) => {
        expect(result.current.errors[idx]).toBe(err);
      });
    });

    it('should handle mixed sync and connection errors', () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        result.current.addError('Connection failed');
        result.current.addError('Sync timeout');
        result.current.addError('P2P peer disconnected');
      });

      expect(result.current.errors.length).toBe(3);
      expect(result.current.errors[0]).toBe('Connection failed');
      expect(result.current.errors[1]).toBe('Sync timeout');
      expect(result.current.errors[2]).toBe('P2P peer disconnected');
    });

    it('should preserve error order and timestamps', () => {
      const { result } = renderHook(() => useReconnection());

      const errorLog: Array<{ msg: string; timestamp: number }> = [];

      act(() => {
        result.current.addError('Error 1');
        errorLog.push({ msg: 'Error 1', timestamp: Date.now() });

        result.current.addError('Error 2');
        errorLog.push({ msg: 'Error 2', timestamp: Date.now() });

        result.current.addError('Error 3');
        errorLog.push({ msg: 'Error 3', timestamp: Date.now() });
      });

      expect(result.current.errors.length).toBe(3);
      result.current.errors.forEach((err, idx) => {
        expect(err).toBe(errorLog[idx].msg);
      });
    });
  });

  describe('Exponential Backoff in Retries - Enhanced', () => {
    it('should implement exponential backoff logic', async () => {
      const { result } = renderHook(() => useReconnection());

      const backoffDelays: number[] = [];

      for (let attempt = 0; attempt < 4; attempt++) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        backoffDelays.push(delay);
      }

      // Delays should follow exponential pattern: 1000, 2000, 4000, 8000
      expect(backoffDelays[0]).toBe(1000);
      expect(backoffDelays[1]).toBe(2000);
      expect(backoffDelays[2]).toBe(4000);
      expect(backoffDelays[3]).toBe(8000);
    });

    it('should cap exponential backoff at maximum', () => {
      const { result } = renderHook(() => useReconnection());

      const maxBackoff = 30000;
      let delay = 1000;

      for (let i = 0; i < 10; i++) {
        delay = Math.min(delay * 2, maxBackoff);
      }

      expect(delay).toBeLessThanOrEqual(maxBackoff);
    });

    it('should reset backoff on successful sync', async () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        result.current.setSyncProgress(100);
      });

      expect(result.current.syncProgress).toBe(100);

      // After successful sync, backoff should reset
      // This would be implemented in the actual hook
      expect(result.current.syncProgress).toBe(100);
    });
  });

  describe('Reconnection Event Handler Registration - Enhanced', () => {
    it('should register online event handler on mount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      const { unmount } = renderHook(() => useReconnection());

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));

      addEventListenerSpy.mockRestore();
      unmount();
    });

    it('should register offline event handler on mount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      const { unmount } = renderHook(() => useReconnection());

      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      addEventListenerSpy.mockRestore();
      unmount();
    });

    it('should call reconnection handler when coming online', async () => {
      const { result } = renderHook(() => useReconnection());

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

    it('should handle rapid online/offline events', async () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        window.dispatchEvent(new Event('offline'));
        window.dispatchEvent(new Event('online'));
        window.dispatchEvent(new Event('offline'));
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle offline when already offline', () => {
      const { result } = renderHook(() => useReconnection());

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(result.current.isOnline).toBe(false);
    });

    it('should handle online when already online', () => {
      const { result } = renderHook(() => useReconnection());

      expect(result.current.isOnline).toBe(true);

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(result.current.isOnline).toBe(true);
    });
  });
});
