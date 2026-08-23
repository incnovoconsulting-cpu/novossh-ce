import { csrfFetch } from './csrfFetch';

const BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api`;

export interface SFTPFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifyTime: number;
  permissions: string;
  uid: number;
  gid: number;
}

export interface SFTPTransferJob {
  id: string;
  type: 'upload' | 'download';
  fileName: string;
  remotePath: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error' | 'cancelled';
  bytesTotal: number;
  bytesTransferred: number;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
}

function getJWTToken(): string | null {
  try {
    const auth = localStorage.getItem('novossh-auth');
    if (auth) {
      const { accessToken } = JSON.parse(auth);
      return accessToken || null;
    }
    return null;
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  const headers: HeadersInit = {};
  const jwtToken = getJWTToken();
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listDirectory(hostId: string, path: string): Promise<{ entries: SFTPFileEntry[]; path: string }> {
  const params = new URLSearchParams({ path });
  const res = await csrfFetch(`${BASE_URL}/sftp/${hostId}/list?${params}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function uploadFile(hostId: string, path: string, file: File): Promise<{ ok: boolean; path: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const params = new URLSearchParams({ path });
  const res = await csrfFetch(`${BASE_URL}/sftp/${hostId}/upload?${params}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return handleResponse(res);
}

export async function downloadFile(hostId: string, path: string): Promise<Blob> {
  const params = new URLSearchParams({ path });
  const res = await csrfFetch(`${BASE_URL}/sftp/${hostId}/download?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.blob();
}

export async function deletePath(hostId: string, path: string, isDirectory: boolean): Promise<void> {
  const res = await csrfFetch(`${BASE_URL}/sftp/${hostId}/delete`, {
    method: 'DELETE',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, isDirectory }),
  });
  await handleResponse(res);
}

export async function createDirectory(hostId: string, path: string): Promise<void> {
  const res = await csrfFetch(`${BASE_URL}/sftp/${hostId}/mkdir`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  await handleResponse(res);
}

export async function renamePath(hostId: string, oldPath: string, newPath: string): Promise<void> {
  const res = await csrfFetch(`${BASE_URL}/sftp/${hostId}/rename`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath, newPath }),
  });
  await handleResponse(res);
}

export async function disconnectHost(hostId: string): Promise<void> {
  const res = await csrfFetch(`${BASE_URL}/sftp/${hostId}/disconnect`, {
    method: 'POST',
    headers: authHeaders(),
  });
  await handleResponse(res);
}
