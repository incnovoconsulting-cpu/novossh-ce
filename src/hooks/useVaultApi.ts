import { useState, useCallback, useEffect } from 'react';
import * as api from '../lib/vaultApi';
import type { ApiVault, ApiVaultEntry, ApiVaultShare } from '../lib/vaultApi';

export type { ApiVault as Vault, ApiVaultEntry as VaultEntry, ApiVaultShare as VaultShare };

interface UseVaultApiState {
  vaults: ApiVault[];
  activeVault: ApiVault | null;
  entries: ApiVaultEntry[];
  shares: ApiVaultShare[];
  loading: boolean;
  error: string | null;
}

interface RequestContext {
  userId?: string;
  orgId?: string;
  deviceId?: string;
}

interface UseVaultApiMethods {
  // Vault operations
  selectVault: (vaultId: string) => Promise<void>;
  createVault: (name: string, description?: string) => Promise<ApiVault>;
  updateVault: (vaultId: string, updates: { name?: string; description?: string }) => Promise<ApiVault>;
  deleteVault: (vaultId: string) => Promise<void>;
  refreshVaults: () => Promise<void>;

  // Entry operations
  createEntry: (vaultId: string, type: string, name: string, encryptedData: string) => Promise<ApiVaultEntry>;
  updateEntry: (vaultId: string, entryId: string, updates: { name?: string; encryptedData?: string }) => Promise<ApiVaultEntry>;
  deleteEntry: (vaultId: string, entryId: string) => Promise<void>;
  refreshEntries: (vaultId: string) => Promise<void>;

  // Sharing
  shareWithUser: (vaultId: string, userId: string, accessLevel: string) => Promise<ApiVaultShare>;
  revokeShare: (vaultId: string, shareId: string) => Promise<void>;
  generateShareLink: (vaultId: string, accessLevel: string, expiresIn?: number) => Promise<{ shareUrl: string; shareToken: string; expiresAt?: string }>;
  refreshShares: (vaultId: string) => Promise<void>;
}

/**
 * Hook that connects vault UI components directly to backend API.
 * Manages multi-vault state: vault list, selected vault, entries, shares.
 */
export function useVaultApi(ctx?: RequestContext): UseVaultApiState & UseVaultApiMethods {
  const [state, setState] = useState<UseVaultApiState>({
    vaults: [],
    activeVault: null,
    entries: [],
    shares: [],
    loading: false,
    error: null,
  });

  // Load vault list on mount
  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    api.listVaults(ctx)
      .then((vaults) => setState((prev) => ({ ...prev, vaults, loading: false })))
      .catch((err) =>
        setState((prev) => ({
          ...prev,
          error: err.message,
          loading: false,
        }))
      );
  }, []);

  const refreshVaults = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const vaults = await api.listVaults(ctx);
      setState((prev) => ({ ...prev, vaults, loading: false }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load vaults';
      setState((prev) => ({ ...prev, error: msg, loading: false }));
      throw err;
    }
  }, []);

  const selectVault = useCallback(async (vaultId: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [vault, entries, shares] = await Promise.all([
        api.getVault(vaultId, ctx),
        api.listEntries(vaultId, ctx),
        api.listShares(vaultId, ctx),
      ]);
      setState((prev) => ({
        ...prev,
        activeVault: vault,
        entries,
        shares,
        loading: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load vault';
      setState((prev) => ({ ...prev, error: msg, loading: false }));
      throw err;
    }
  }, []);

  const createVault = useCallback(async (name: string, description?: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const vault = await api.createVault(name, description, ctx);
      setState((prev) => ({
        ...prev,
        vaults: [vault, ...prev.vaults],
        loading: false,
      }));
      return vault;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create vault';
      setState((prev) => ({ ...prev, error: msg, loading: false }));
      throw err;
    }
  }, []);

  const updateVault = useCallback(
    async (vaultId: string, updates: { name?: string; description?: string }) => {
      try {
        const updated = await api.updateVault(vaultId, updates, ctx);
        setState((prev) => ({
          ...prev,
          vaults: prev.vaults.map((v) => (v.id === vaultId ? updated : v)),
          activeVault: prev.activeVault?.id === vaultId ? updated : prev.activeVault,
        }));
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update vault';
        setState((prev) => ({ ...prev, error: msg }));
        throw err;
      }
    },
    []
  );

  const deleteVault = useCallback(async (vaultId: string) => {
    try {
      await api.deleteVault(vaultId, ctx);
      setState((prev) => ({
        ...prev,
        vaults: prev.vaults.filter((v) => v.id !== vaultId),
        activeVault: prev.activeVault?.id === vaultId ? null : prev.activeVault,
        entries: prev.activeVault?.id === vaultId ? [] : prev.entries,
        shares: prev.activeVault?.id === vaultId ? [] : prev.shares,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete vault';
      setState((prev) => ({ ...prev, error: msg }));
      throw err;
    }
  }, []);

  const createEntry = useCallback(
    async (vaultId: string, type: string, name: string, encryptedData: string) => {
      try {
        const entry = await api.createEntry(vaultId, type, name, encryptedData, ctx);
        setState((prev) => ({
          ...prev,
          entries:
            prev.activeVault?.id === vaultId ? [entry, ...prev.entries] : prev.entries,
        }));
        return entry;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create entry';
        setState((prev) => ({ ...prev, error: msg }));
        throw err;
      }
    },
    []
  );

  const updateEntry = useCallback(
    async (
      vaultId: string,
      entryId: string,
      updates: { name?: string; encryptedData?: string }
    ) => {
      try {
        const updated = await api.updateEntry(vaultId, entryId, updates, ctx);
        setState((prev) => ({
          ...prev,
          entries: prev.entries.map((e) => (e.id === entryId ? updated : e)),
        }));
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update entry';
        setState((prev) => ({ ...prev, error: msg }));
        throw err;
      }
    },
    []
  );

  const deleteEntry = useCallback(async (vaultId: string, entryId: string) => {
    try {
      await api.deleteEntry(vaultId, entryId, ctx);
      setState((prev) => ({
        ...prev,
        entries: prev.entries.filter((e) => e.id !== entryId),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete entry';
      setState((prev) => ({ ...prev, error: msg }));
      throw err;
    }
  }, []);

  const refreshEntries = useCallback(async (vaultId: string) => {
    try {
      const entries = await api.listEntries(vaultId, ctx);
      setState((prev) => ({ ...prev, entries }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh entries';
      setState((prev) => ({ ...prev, error: msg }));
      throw err;
    }
  }, []);

  const shareWithUser = useCallback(
    async (vaultId: string, userId: string, accessLevel: string) => {
      try {
        const share = await api.shareWithUser(vaultId, userId, accessLevel, ctx);
        setState((prev) => ({
          ...prev,
          shares:
            prev.activeVault?.id === vaultId ? [...prev.shares, share] : prev.shares,
        }));
        return share;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to share vault';
        setState((prev) => ({ ...prev, error: msg }));
        throw err;
      }
    },
    []
  );

  const revokeShare = useCallback(async (vaultId: string, shareId: string) => {
    try {
      await api.revokeShare(vaultId, shareId, ctx);
      setState((prev) => ({
        ...prev,
        shares: prev.shares.filter((s) => s.id !== shareId),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke share';
      setState((prev) => ({ ...prev, error: msg }));
      throw err;
    }
  }, []);

  const generateShareLink = useCallback(
    async (vaultId: string, accessLevel: string, expiresIn?: number) => {
      try {
        return await api.generateShareLink(vaultId, accessLevel, expiresIn, ctx);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to generate link';
        setState((prev) => ({ ...prev, error: msg }));
        throw err;
      }
    },
    []
  );

  const refreshShares = useCallback(async (vaultId: string) => {
    try {
      const shares = await api.listShares(vaultId, ctx);
      setState((prev) => ({ ...prev, shares }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh shares';
      setState((prev) => ({ ...prev, error: msg }));
      throw err;
    }
  }, []);

  return {
    ...state,
    selectVault,
    createVault,
    updateVault,
    deleteVault,
    refreshVaults,
    createEntry,
    updateEntry,
    deleteEntry,
    refreshEntries,
    shareWithUser,
    revokeShare,
    generateShareLink,
    refreshShares,
  };
}
