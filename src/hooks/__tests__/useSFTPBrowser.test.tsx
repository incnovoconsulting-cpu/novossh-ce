import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSFTP } from '../useSFTP';

vi.mock('../../lib/sftpApi', () => ({
  listDirectory: vi.fn().mockResolvedValue({ entries: [], path: '/' }),
  uploadFile: vi.fn().mockResolvedValue({ ok: true, path: '/test.txt', size: 100 }),
  downloadFile: vi.fn().mockResolvedValue(new Blob()),
  deletePath: vi.fn().mockResolvedValue(undefined),
  createDirectory: vi.fn().mockResolvedValue(undefined),
  renamePath: vi.fn().mockResolvedValue(undefined),
  disconnectHost: vi.fn().mockResolvedValue(undefined),
}));

describe('useSFTP Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useSFTP());

      expect(result.current.currentPath).toBe('/');
      expect(result.current.files).toEqual([]);
      expect(result.current.connected).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.showHidden).toBe(false);
      expect(result.current.sortField).toBe('name');
      expect(result.current.sortDir).toBe('asc');
      expect(result.current.selectedFiles).toEqual([]);
      expect(result.current.transfers).toEqual([]);
    });
  });

  describe('Connection Management', () => {
    it('should connect to host', async () => {
      const { result } = renderHook(() => useSFTP());

      await act(async () => {
        await result.current.connect('test-host');
      });

      expect(result.current.connected).toBe(true);
    });

    it('should disconnect from host', async () => {
      const { result } = renderHook(() => useSFTP());

      await act(async () => {
        await result.current.connect('test-host');
      });

      await act(async () => {
        await result.current.disconnect('test-host');
      });

      expect(result.current.connected).toBe(false);
    });
  });

  describe('Navigation', () => {
    it('should navigate to path', async () => {
      const { result } = renderHook(() => useSFTP());

      await act(async () => {
        await result.current.connect('test-host');
      });

      await act(async () => {
        await result.current.navigateTo('/home');
      });

      expect(result.current.currentPath).toBe('/');
    });
  });

  describe('Selection', () => {
    it('should select a file', () => {
      const { result } = renderHook(() => useSFTP());

      const file = { name: 'test.txt', path: '/test.txt', isDirectory: false, size: 100, modifyTime: Date.now(), permissions: '-rw-r--r--', uid: 0, gid: 0 };

      act(() => {
        result.current.selectFile(file, false);
      });

      expect(result.current.selectedFiles).toHaveLength(1);
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => useSFTP());

      const file = { name: 'test.txt', path: '/test.txt', isDirectory: false, size: 100, modifyTime: Date.now(), permissions: '-rw-r--r--', uid: 0, gid: 0 };

      act(() => {
        result.current.selectFile(file, false);
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedFiles).toHaveLength(0);
    });
  });

  describe('Hidden Files', () => {
    it('should toggle hidden files', () => {
      const { result } = renderHook(() => useSFTP());

      expect(result.current.showHidden).toBe(false);

      act(() => {
        result.current.toggleHidden();
      });

      expect(result.current.showHidden).toBe(true);
    });
  });

  describe('Sort', () => {
    it('should change sort field', () => {
      const { result } = renderHook(() => useSFTP());

      act(() => {
        result.current.setSortField('size');
      });

      expect(result.current.sortField).toBe('size');
    });

    it('should toggle sort direction', () => {
      const { result } = renderHook(() => useSFTP());

      expect(result.current.sortDir).toBe('asc');

      act(() => {
        result.current.toggleSortDir();
      });

      expect(result.current.sortDir).toBe('desc');
    });
  });
});
