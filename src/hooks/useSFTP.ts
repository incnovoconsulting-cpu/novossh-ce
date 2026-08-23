import { useState, useCallback, useRef } from 'react';
import * as sftpApi from '../lib/sftpApi';
import type { SFTPFileEntry, SFTPTransferJob } from '../lib/sftpApi';

export type SortField = 'name' | 'size' | 'modifyTime';
export type SortDirection = 'asc' | 'desc';

export interface UseSFTPReturn {
  connected: boolean;
  currentPath: string;
  files: SFTPFileEntry[];
  loading: boolean;
  error: string | null;
  showHidden: boolean;
  sortField: SortField;
  sortDir: SortDirection;
  selectedFiles: SFTPFileEntry[];
  transfers: SFTPTransferJob[];

  connect: (hostId: string) => Promise<void>;
  disconnect: (hostId: string) => Promise<void>;
  navigateTo: (path: string) => Promise<void>;
  goUp: () => Promise<void>;
  refresh: () => Promise<void>;
  upload: (file: File) => Promise<void>;
  download: (file: SFTPFileEntry) => Promise<void>;
  deleteFiles: (files: SFTPFileEntry[]) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  rename: (oldPath: string, newName: string) => Promise<void>;
  toggleHidden: () => void;
  setSortField: (field: SortField) => void;
  toggleSortDir: () => void;
  selectFile: (file: SFTPFileEntry, multi: boolean) => void;
  clearSelection: () => void;
  cancelTransfer: (id: string) => void;
}

export function useSFTP(): UseSFTPReturn {
  const [connected, setConnected] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<SFTPFileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [selectedFiles, setSelectedFiles] = useState<SFTPFileEntry[]>([]);
  const [transfers, setTransfers] = useState<SFTPTransferJob[]>([]);

  const hostIdRef = useRef<string>('');
  const cancelRefs = useRef<Map<string, AbortController>>(new Map());

  const sortedFiles = [...files]
    .filter((f) => showHidden || !f.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'size') cmp = a.size - b.size;
      else cmp = a.modifyTime - b.modifyTime;
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const loadDirectory = useCallback(async (hostId: string, path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sftpApi.listDirectory(hostId, path);
      setFiles(result.entries);
      setCurrentPath(result.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list directory');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback(async (hostId: string) => {
    hostIdRef.current = hostId;
    setError(null);
    setLoading(true);
    try {
      await sftpApi.listDirectory(hostId, '/');
      setConnected(true);
      setCurrentPath('/');
      const result = await sftpApi.listDirectory(hostId, '/');
      setFiles(result.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async (hostId: string) => {
    try {
      await sftpApi.disconnectHost(hostId);
    } catch {}
    setConnected(false);
    setFiles([]);
    setCurrentPath('/');
    setSelectedFiles([]);
  }, []);

  const navigateTo = useCallback(async (path: string) => {
    await loadDirectory(hostIdRef.current, path);
  }, [loadDirectory]);

  const goUp = useCallback(async () => {
    const parts = currentPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const newPath = '/' + parts.join('/');
      await loadDirectory(hostIdRef.current, newPath || '/');
    }
  }, [currentPath, loadDirectory]);

  const refresh = useCallback(async () => {
    await loadDirectory(hostIdRef.current, currentPath);
  }, [currentPath, loadDirectory]);

  const upload = useCallback(async (file: File) => {
    const hostId = hostIdRef.current;
    const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: SFTPTransferJob = {
      id,
      type: 'upload',
      fileName: file.name,
      remotePath: currentPath,
      status: 'in-progress',
      bytesTotal: file.size,
      bytesTransferred: 0,
      progress: 0,
      startTime: new Date(),
    };
    setTransfers((prev) => [...prev, job]);

    try {
      await sftpApi.uploadFile(hostId, currentPath, file);
      setTransfers((prev) =>
        prev.map((t) => t.id === id ? { ...t, status: 'completed', progress: 100, bytesTransferred: file.size, endTime: new Date() } : t)
      );
      await refresh();
    } catch (err) {
      setTransfers((prev) =>
        prev.map((t) => t.id === id ? { ...t, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' } : t)
      );
    }
  }, [currentPath, refresh]);

  const download = useCallback(async (file: SFTPFileEntry) => {
    const hostId = hostIdRef.current;
    const id = `download_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: SFTPTransferJob = {
      id,
      type: 'download',
      fileName: file.name,
      remotePath: file.path,
      status: 'in-progress',
      bytesTotal: file.size,
      bytesTransferred: 0,
      progress: 0,
      startTime: new Date(),
    };
    setTransfers((prev) => [...prev, job]);

    try {
      const blob = await sftpApi.downloadFile(hostId, file.path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTransfers((prev) =>
        prev.map((t) => t.id === id ? { ...t, status: 'completed', progress: 100, bytesTransferred: file.size, endTime: new Date() } : t)
      );
    } catch (err) {
      setTransfers((prev) =>
        prev.map((t) => t.id === id ? { ...t, status: 'error', error: err instanceof Error ? err.message : 'Download failed' } : t)
      );
    }
  }, []);

  const deleteFiles = useCallback(async (fileList: SFTPFileEntry[]) => {
    const hostId = hostIdRef.current;
    for (const file of fileList) {
      try {
        await sftpApi.deletePath(hostId, file.path, file.isDirectory);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    }
    setSelectedFiles([]);
    await refresh();
  }, [refresh]);

  const createFolder = useCallback(async (name: string) => {
    const hostId = hostIdRef.current;
    const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    await sftpApi.createDirectory(hostId, path);
    await refresh();
  }, [currentPath, refresh]);

  const rename = useCallback(async (oldPath: string, newName: string) => {
    const hostId = hostIdRef.current;
    const parts = oldPath.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');
    await sftpApi.renamePath(hostId, oldPath, newPath);
    await refresh();
  }, [refresh]);

  const toggleHidden = useCallback(() => setShowHidden((prev) => !prev), []);

  const toggleSortDir = useCallback(() => setSortDir((prev) => prev === 'asc' ? 'desc' : 'asc'), []);

  const selectFile = useCallback((file: SFTPFileEntry, multi: boolean) => {
    setSelectedFiles((prev) => {
      if (multi) {
        const exists = prev.some((f) => f.path === file.path);
        return exists ? prev.filter((f) => f.path !== file.path) : [...prev, file];
      }
      return [file];
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedFiles([]), []);

  const cancelTransfer = useCallback((id: string) => {
    cancelRefs.current.get(id)?.abort();
    setTransfers((prev) =>
      prev.map((t) => t.id === id ? { ...t, status: 'cancelled' } : t)
    );
  }, []);

  return {
    connected,
    currentPath,
    files: sortedFiles,
    loading,
    error,
    showHidden,
    sortField,
    sortDir,
    selectedFiles,
    transfers,
    connect,
    disconnect,
    navigateTo,
    goUp,
    refresh,
    upload,
    download,
    deleteFiles,
    createFolder,
    rename,
    toggleHidden,
    setSortField,
    toggleSortDir,
    selectFile,
    clearSelection,
    cancelTransfer,
  };
}
