/**
 * HTTP client for the vault backend API (Phase 2 Week 6 integration)
 *
 * Wraps all /api/vaults endpoints and handles:
 * - User authentication headers
 * - CSRF double-submit token injection
 * - JSON serialization/deserialization
 * - Error normalization
 */

import { csrfFetch } from './csrfFetch';

const BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api`;

export interface ApiVault {
  id: string;
  organization_id: string;
  owner_id: string;
  name: string;
  description?: string;
  encryption_algorithm: string;
  key_derivation_algorithm: string;
  last_modified_at: string;
  version: number;
  is_deleted: boolean;
  is_shared: boolean;
  default_access_level: string;
  created_at: string;
  updated_at: string;
}

export interface ApiVaultEntry {
  id: string;
  vault_id: string;
  type: string;
  name: string;
  encrypted_data: string;
  local_version: number;
  device_sync_id?: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  synced_at?: string;
}

export interface ApiVaultShare {
  id: string;
  vault_id: string;
  grantor_id: string;
  grantee_id?: string;
  access_level: string;
  share_token?: string;
  expires_at?: string;
  created_at: string;
  revoked_at?: string;
}

export interface ApiSyncChange {
  operation: string;
  entryId: string;
  previousVersion?: number;
  newVersion?: number;
}

export interface ApiSyncState {
  lastSyncAt: string;
  pendingChanges: Array<{
    id: string;
    operation: string;
    entry_id?: string;
    previous_version?: number;
    new_version?: number;
    has_conflict: boolean;
    operation_timestamp: string;
  }>;
  conflicts: number;
}

export interface ApiShareLinkResult {
  shareToken: string;
  expiresAt?: string;
  shareUrl: string;
}

interface RequestOptions {
  userId?: string;
  orgId?: string;
  deviceId?: string;
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

const defaultHeaders = (opts: RequestOptions = {}): HeadersInit => {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  const jwtToken = getJWTToken();
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }
  // No demo fallback — unauthenticated requests must fail server-side

  headers['X-Device-ID'] = opts.deviceId || 'device-browser';
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

// Vault CRUD

export const listVaults = async (opts?: RequestOptions): Promise<ApiVault[]> => {
  const res = await csrfFetch(`${BASE_URL}/vaults`, { headers: defaultHeaders(opts) });
  return handleResponse(res);
};

export const getVault = async (vaultId: string, opts?: RequestOptions): Promise<ApiVault> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}`, { headers: defaultHeaders(opts) });
  return handleResponse(res);
};

export const createVault = async (
  name: string,
  description: string | undefined,
  opts?: RequestOptions
): Promise<ApiVault> => {
  const res = await csrfFetch(`${BASE_URL}/vaults`, {
    method: 'POST',
    headers: defaultHeaders(opts),
    body: JSON.stringify({ name, description }),
  });
  return handleResponse(res);
};

export const updateVault = async (
  vaultId: string,
  updates: { name?: string; description?: string },
  opts?: RequestOptions
): Promise<ApiVault> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}`, {
    method: 'PUT',
    headers: defaultHeaders(opts),
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
};

export const deleteVault = async (vaultId: string, opts?: RequestOptions): Promise<void> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}`, {
    method: 'DELETE',
    headers: defaultHeaders(opts),
  });
  return handleResponse(res);
};

// Entry CRUD

export const listEntries = async (
  vaultId: string,
  opts?: RequestOptions
): Promise<ApiVaultEntry[]> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/entries`, {
    headers: defaultHeaders(opts),
  });
  return handleResponse(res);
};

export const createEntry = async (
  vaultId: string,
  type: string,
  name: string,
  encryptedData: string,
  opts?: RequestOptions
): Promise<ApiVaultEntry> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/entries`, {
    method: 'POST',
    headers: defaultHeaders(opts),
    body: JSON.stringify({ type, name, encryptedData }),
  });
  return handleResponse(res);
};

export const updateEntry = async (
  vaultId: string,
  entryId: string,
  updates: { name?: string; encryptedData?: string; localVersion?: number },
  opts?: RequestOptions
): Promise<ApiVaultEntry> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/entries/${entryId}`, {
    method: 'PUT',
    headers: defaultHeaders(opts),
    body: JSON.stringify(updates),
  });
  return handleResponse(res);
};

export const deleteEntry = async (
  vaultId: string,
  entryId: string,
  opts?: RequestOptions
): Promise<void> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/entries/${entryId}`, {
    method: 'DELETE',
    headers: defaultHeaders(opts),
  });
  return handleResponse(res);
};

// Sync

export const getSyncState = async (
  vaultId: string,
  since?: Date,
  opts?: RequestOptions
): Promise<ApiSyncState> => {
  const params = since ? `?since=${since.toISOString()}` : '';
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/sync${params}`, {
    headers: defaultHeaders(opts),
  });
  return handleResponse(res);
};

export const pushChanges = async (
  vaultId: string,
  changes: ApiSyncChange[],
  opts?: RequestOptions
): Promise<{ appliedChanges: ApiSyncChange[]; conflicts: unknown[]; lastSyncAt: string }> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/sync`, {
    method: 'POST',
    headers: defaultHeaders(opts),
    body: JSON.stringify({ changes }),
  });
  return handleResponse(res);
};

export const resolveConflict = async (
  vaultId: string,
  entryId: string,
  resolution: string,
  winningData?: string,
  opts?: RequestOptions
): Promise<ApiVaultEntry> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/sync/resolve`, {
    method: 'POST',
    headers: defaultHeaders(opts),
    body: JSON.stringify({ entryId, resolution, winningData }),
  });
  return handleResponse(res);
};

// Sharing

// Vault key registry (per-user keypair + per-vault wrapped DEKs)

export interface ApiUserVaultKey {
  user_id: string;
  public_key: string;
  encrypted_private_key: string;
  private_key_nonce: string;
  kdf_salt: string;
  kdf_params: { iterations: number; memory: number; parallelism: number };
}

export const registerVaultKey = async (
  bundle: {
    publicKey: string;
    encryptedPrivateKey: string;
    privateKeyNonce: string;
    kdfSalt: string;
    kdfParams: { iterations: number; memory: number; parallelism: number };
  },
  opts?: RequestOptions
): Promise<ApiUserVaultKey> => {
  const res = await csrfFetch(`${BASE_URL}/vault-keys`, {
    method: 'POST',
    headers: defaultHeaders(opts),
    body: JSON.stringify(bundle),
  });
  return handleResponse(res);
};

export const getMyVaultKey = async (opts?: RequestOptions): Promise<ApiUserVaultKey | null> => {
  const res = await csrfFetch(`${BASE_URL}/vault-keys/me`, { headers: defaultHeaders(opts) });
  if (res.status === 404) return null;
  return handleResponse(res);
};

export const getUserPublicKey = async (
  userId: string,
  opts?: RequestOptions
): Promise<string | null> => {
  const res = await csrfFetch(`${BASE_URL}/vault-keys/${userId}/public`, { headers: defaultHeaders(opts) });
  if (res.status === 404) return null;
  const body = await handleResponse<{ publicKey: string }>(res);
  return body.publicKey;
};

export const getWrappedDekForVault = async (
  vaultId: string,
  opts?: RequestOptions
): Promise<{ source: 'owner' | 'share'; wrappedDek: string } | null> => {
  const res = await csrfFetch(`${BASE_URL}/vault-keys/vaults/${vaultId}/wrapped-dek`, { headers: defaultHeaders(opts) });
  if (res.status === 404) return null;
  return handleResponse(res);
};

export const setOwnerWrappedDek = async (
  vaultId: string,
  wrappedDek: string,
  opts?: RequestOptions
): Promise<void> => {
  const res = await csrfFetch(`${BASE_URL}/vault-keys/vaults/${vaultId}/owner-wrap`, {
    method: 'PUT',
    headers: defaultHeaders(opts),
    body: JSON.stringify({ wrappedDek }),
  });
  return handleResponse(res);
};

export const setShareWrappedDek = async (
  shareId: string,
  wrappedDek: string,
  opts?: RequestOptions
): Promise<void> => {
  const res = await csrfFetch(`${BASE_URL}/vault-keys/shares/${shareId}/wrap`, {
    method: 'PUT',
    headers: defaultHeaders(opts),
    body: JSON.stringify({ wrappedDek }),
  });
  return handleResponse(res);
};

export const listShares = async (
  vaultId: string,
  opts?: RequestOptions
): Promise<ApiVaultShare[]> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/shares`, {
    headers: defaultHeaders(opts),
  });
  return handleResponse(res);
};

export const shareWithUser = async (
  vaultId: string,
  userId: string,
  accessLevel: string,
  opts?: RequestOptions
): Promise<ApiVaultShare> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/shares`, {
    method: 'POST',
    headers: defaultHeaders(opts),
    body: JSON.stringify({ userId, accessLevel }),
  });
  return handleResponse(res);
};

export const revokeShare = async (
  vaultId: string,
  shareId: string,
  opts?: RequestOptions
): Promise<void> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/shares/${shareId}`, {
    method: 'DELETE',
    headers: defaultHeaders(opts),
  });
  return handleResponse(res);
};

export const generateShareLink = async (
  vaultId: string,
  accessLevel: string,
  expiresIn?: number,
  opts?: RequestOptions
): Promise<ApiShareLinkResult> => {
  const res = await csrfFetch(`${BASE_URL}/vaults/${vaultId}/shares/generate-link`, {
    method: 'POST',
    headers: defaultHeaders(opts),
    body: JSON.stringify({ accessLevel, expiresIn }),
  });
  return handleResponse(res);
};
