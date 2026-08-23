import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useConflictResolution } from '../useConflictResolution';

describe('useConflictResolution Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useConflictResolution());

      expect(result.current.conflicts).toBeDefined();
      expect(Array.isArray(result.current.conflicts)).toBe(true);
      expect(result.current.autoResolveProgress).toBe(0);
    });
  });

  describe('Single Conflict Resolution', () => {
    it('should resolve single conflict', async () => {
      const { result } = renderHook(() => useConflictResolution());

      await expect(
        act(async () => {
          await result.current.resolveConflict('conflict-1', 'local');
        })
      ).resolves.not.toThrow();
    });

    it('should resolve with different strategies', async () => {
      const { result } = renderHook(() => useConflictResolution());

      const strategies: Array<'local' | 'remote' | 'merged'> = [
        'local',
        'remote',
        'merged',
      ];

      for (const strategy of strategies) {
        await expect(
          act(async () => {
            await result.current.resolveConflict('conflict-1', strategy);
          })
        ).resolves.not.toThrow();
      }
    });
  });

  describe('Auto-resolve All', () => {
    it('should auto-resolve all conflicts', async () => {
      const { result } = renderHook(() => useConflictResolution());

      await expect(
        act(async () => {
          await result.current.autoResolveAll('local');
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Current Conflict Details', () => {
    it('should get current conflict', () => {
      const { result } = renderHook(() => useConflictResolution());

      const current = result.current.getCurrentConflict();
      expect(current).toBeDefined();
    });
  });

  describe('Clear Resolved', () => {
    it('should clear resolved conflicts', () => {
      const { result } = renderHook(() => useConflictResolution());

      expect(() => {
        result.current.clearResolved();
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useConflictResolution());

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});
