/**
 * HTTP client for the /api/sessions endpoints (recorded vault-connect sessions)
 */

import { csrfFetch } from './csrfFetch';

const BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api`;

export interface ApiSession {
  id: string;
  vault_id: string;
  team_id: string | null;
  created_by: string;
  name?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  ended_at?: string;
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

const defaultHeaders = (): HeadersInit => {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const jwtToken = getJWTToken();
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }
  // No demo fallback — unauthenticated requests must fail server-side
  return headers;
};

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
};

export const createSession = async (vaultId: string, name?: string): Promise<ApiSession> => {
  const res = await csrfFetch(`${BASE_URL}/sessions`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify({ vaultId, name }),
  });
  return handleResponse<ApiSession>(res);
};
