import { useState, useCallback, useEffect, useRef } from 'react';
import { VaultService, type Vault, type VaultEntry, type VaultShare } from '../services/VaultService';

interface UseVaultState {
  vault: Vault | null;
  entries: VaultEntry[];
  shares: VaultShare[];
  loading: boolean;
  error: Error | null;
}

interface UseVaultMethods {
  // Vault operations
  createVault: (vault: Omit<Vault, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => Promise<Vault>;
  updateVault: (updates: Partial<Vault>) => Promise<Vault>;
  deleteVault: () => Promise<void>;

  // Entry operations
  createEntry: (entry: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<VaultEntry>;
  updateEntry: (entryId: string, updates: Partial<VaultEntry>) => Promise<VaultEntry>;
  deleteEntry: (entryId: string) => Promise<void>;
  refreshEntries: () => Promise<void>;

  // Sharing
  shareVault: (userId: string, accessLevel: 'viewer' | 'editor' | 'owner') => Promise<VaultShare>;
  unshareVault: (userId: string) => Promise<void>;
  generateShareLink: (accessLevel: 'viewer' | 'editor', expiresIn?: number) => Promise<VaultShare>;
  refreshShares: () => Promise<void>;
}

/**
 * Custom hook for managing vault operations
 *
 * Usage:
 * const vault = useVault('vault-id', 'user-id');
 * const { vault, entries, loading, error } = vault;
 * await vault.createEntry({ type: 'password', name: 'GitHub', encryptedData: '...' });
 */
export function useVault(vaultId: string, userId: string): UseVaultState & UseVaultMethods {
  const [state, setState] = useState<UseVaultState>({
    vault: null,
    entries: [],
    shares: [],
    loading: false,
    error: null,
  });

  const vaultServiceRef = useRef<VaultService>(new VaultService());
  const vaultService = vaultServiceRef.current;

  // Load vault and entries on mount
  useEffect(() => {
    const loadVault = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const vault = await vaultService.getVault(vaultId);
        const entries = vault ? await vaultService.listEntries(vaultId) : [];
        const shares = vault ? await vaultService.listShares(vaultId) : [];

        setState((prev) => ({
          ...prev,
          vault,
          entries,
          shares,
          loading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error : new Error('Unknown error'),
          loading: false,
        }));
      }
    };

    loadVault();

    // Subscribe to vault events
    const handleVaultUpdated = (vault: Vault) => {
      if (vault.id === vaultId) {
        setState((prev) => ({ ...prev, vault }));
      }
    };

    const handleEntryCreated = (entry: VaultEntry) => {
      setState((prev) => ({
        ...prev,
        entries: [...prev.entries, entry],
      }));
    };

    const handleEntryUpdated = (entry: VaultEntry) => {
      setState((prev) => ({
        ...prev,
        entries: prev.entries.map((e) => (e.id === entry.id ? entry : e)),
      }));
    };

    const handleEntryDeleted = (entry: VaultEntry) => {
      setState((prev) => ({
        ...prev,
        entries: prev.entries.filter((e) => e.id !== entry.id),
      }));
    };

    const handleVaultShared = (share: VaultShare) => {
      if (share.vaultId === vaultId) {
        setState((prev) => ({
          ...prev,
          shares: [...prev.shares, share],
        }));
      }
    };

    vaultService.on('vaultUpdated', handleVaultUpdated);
    vaultService.on('entryCreated', handleEntryCreated);
    vaultService.on('entryUpdated', handleEntryUpdated);
    vaultService.on('entryDeleted', handleEntryDeleted);
    vaultService.on('vaultShared', handleVaultShared);

    return () => {
      vaultService.removeListener('vaultUpdated', handleVaultUpdated);
      vaultService.removeListener('entryCreated', handleEntryCreated);
      vaultService.removeListener('entryUpdated', handleEntryUpdated);
      vaultService.removeListener('entryDeleted', handleEntryDeleted);
      vaultService.removeListener('vaultShared', handleVaultShared);
    };
  }, [vaultId, vaultService]);

  const createVault = useCallback(
    async (vault: Omit<Vault, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const newVault = await vaultService.createVault(vault);
        setState((prev) => ({
          ...prev,
          vault: newVault,
          loading: false,
        }));
        return newVault;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState((prev) => ({ ...prev, error: err, loading: false }));
        throw err;
      }
    },
    [vaultService]
  );

  const updateVault = useCallback(
    async (updates: Partial<Vault>) => {
      try {
        const updated = await vaultService.updateVault(vaultId, updates);
        setState((prev) => ({ ...prev, vault: updated }));
        return updated;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [vaultId, vaultService]
  );

  const deleteVault = useCallback(async () => {
    try {
      await vaultService.deleteVault(vaultId);
      setState((prev) => ({ ...prev, vault: null, entries: [], shares: [] }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setState((prev) => ({ ...prev, error: err }));
      throw err;
    }
  }, [vaultId, vaultService]);

  const createEntry = useCallback(
    async (entry: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        return await vaultService.createEntry(vaultId, entry);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [vaultId, vaultService]
  );

  const updateEntry = useCallback(
    async (entryId: string, updates: Partial<VaultEntry>) => {
      try {
        return await vaultService.updateEntry(entryId, updates);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [vaultService]
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      try {
        await vaultService.deleteEntry(entryId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [vaultService]
  );

  const refreshEntries = useCallback(async () => {
    try {
      const entries = await vaultService.listEntries(vaultId);
      setState((prev) => ({ ...prev, entries }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setState((prev) => ({ ...prev, error: err }));
      throw err;
    }
  }, [vaultId, vaultService]);

  const shareVault = useCallback(
    async (recipientId: string, accessLevel: 'viewer' | 'editor' | 'owner') => {
      try {
        return await vaultService.shareVault(vaultId, recipientId, accessLevel, userId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [vaultId, userId, vaultService]
  );

  const unshareVault = useCallback(
    async (userId: string) => {
      try {
        await vaultService.unshareVault(vaultId, userId);
        setState((prev) => ({
          ...prev,
          shares: prev.shares.filter((s) => s.granteeId !== userId),
        }));
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [vaultId, vaultService]
  );

  const generateShareLink = useCallback(
    async (accessLevel: 'viewer' | 'editor', expiresIn?: number) => {
      try {
        return await vaultService.createShareLink(vaultId, accessLevel, expiresIn);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    [vaultId, vaultService]
  );

  const refreshShares = useCallback(async () => {
    try {
      const shares = await vaultService.listShares(vaultId);
      setState((prev) => ({ ...prev, shares }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      setState((prev) => ({ ...prev, error: err }));
      throw err;
    }
  }, [vaultId, vaultService]);

  return {
    ...state,
    createVault,
    updateVault,
    deleteVault,
    createEntry,
    updateEntry,
    deleteEntry,
    refreshEntries,
    shareVault,
    unshareVault,
    generateShareLink,
    refreshShares,
  };
}
