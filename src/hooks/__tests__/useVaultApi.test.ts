import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVaultApi } from '../useVaultApi';
import * as vaultApi from '../../lib/vaultApi';

vi.mock('../../lib/vaultApi');

const mockApi = vaultApi as any;

describe('useVaultApi Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.listVaults.mockResolvedValue([]);
    mockApi.getVault.mockResolvedValue(null);
    mockApi.listEntries.mockResolvedValue([]);
    mockApi.listShares.mockResolvedValue([]);
  });

  describe('State Initialization', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useVaultApi());

      expect(result.current.vaults).toEqual([]);
      expect(result.current.activeVault).toBeNull();
      expect(result.current.entries).toEqual([]);
      expect(result.current.shares).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should load vaults on mount', async () => {
      const mockVaults = [
        { id: 'vault-1', name: 'Personal', owner_id: 'user-1', organization_id: 'org-1', is_shared: false },
        { id: 'vault-2', name: 'Work', owner_id: 'user-1', organization_id: 'org-1', is_shared: true },
      ];
      mockApi.listVaults.mockResolvedValue(mockVaults);

      const { result } = renderHook(() => useVaultApi());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.vaults).toEqual(mockVaults);
      expect(result.current.error).toBeNull();
    });

    it('should handle initialization error', async () => {
      mockApi.listVaults.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useVaultApi());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.vaults).toEqual([]);
    });
  });

  describe('Vault Operations', () => {
    it('should select vault and load entries and shares', async () => {
      const mockVault = { id: 'vault-1', name: 'Test Vault', owner_id: 'user-1', organization_id: 'org-1' };
      const mockEntries = [{ id: 'entry-1', vault_id: 'vault-1', name: 'Entry 1', encrypted_data: 'data1' }];
      const mockShares = [{ id: 'share-1', vault_id: 'vault-1', grantee_id: 'user-2', access_level: 'viewer' }];

      mockApi.getVault.mockResolvedValue(mockVault);
      mockApi.listEntries.mockResolvedValue(mockEntries);
      mockApi.listShares.mockResolvedValue(mockShares);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        await result.current.selectVault('vault-1');
      });

      expect(result.current.activeVault).toEqual(mockVault);
      expect(result.current.entries).toEqual(mockEntries);
      expect(result.current.shares).toEqual(mockShares);
      expect(result.current.loading).toBe(false);
    });

    it('should create vault and auto-select it', async () => {
      const newVault = { id: 'vault-new', name: 'New Vault', owner_id: 'user-1', organization_id: 'org-1' };
      mockApi.createVault.mockResolvedValue(newVault);
      mockApi.listVaults.mockResolvedValue([newVault]);
      mockApi.getVault.mockResolvedValue(newVault);
      mockApi.listEntries.mockResolvedValue([]);
      mockApi.listShares.mockResolvedValue([]);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        await result.current.createVault('New Vault', 'Description');
      });

      await waitFor(() => {
        expect(result.current.vaults).toContainEqual(newVault);
      });
    });

    it('should update vault metadata', async () => {
      const originalVault = { id: 'vault-1', name: 'Old Name', owner_id: 'user-1', organization_id: 'org-1' };
      const updatedVault = { ...originalVault, name: 'New Name' };

      mockApi.updateVault.mockResolvedValue(updatedVault);

      const { result } = renderHook(() => useVaultApi());

      let updated;
      await act(async () => {
        updated = await result.current.updateVault('vault-1', { name: 'New Name' });
      });

      expect(updated?.name).toBe('New Name');
      expect(mockApi.updateVault).toHaveBeenCalledWith('vault-1', { name: 'New Name' }, undefined);
    });

    it('should delete vault (soft delete)', async () => {
      mockApi.deleteVault.mockResolvedValue(undefined);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        await result.current.deleteVault('vault-1');
      });

      expect(mockApi.deleteVault).toHaveBeenCalledWith('vault-1', undefined);
    });

    it('should refresh vault list', async () => {
      const mockVaults = [{ id: 'vault-1', name: 'Vault 1', owner_id: 'user-1', organization_id: 'org-1' }];
      mockApi.listVaults.mockResolvedValue(mockVaults);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        await result.current.refreshVaults();
      });

      expect(result.current.vaults).toEqual(mockVaults);
    });
  });

  describe('Entry Operations', () => {
    it('should create entry in active vault', async () => {
      const mockEntry = {
        id: 'entry-1',
        vault_id: 'vault-1',
        name: 'Test Entry',
        type: 'password',
        encrypted_data: 'encrypted',
      };

      mockApi.createEntry.mockResolvedValue(mockEntry);

      const { result } = renderHook(() => useVaultApi());

      let created;
      await act(async () => {
        created = await result.current.createEntry('vault-1', 'password', 'Test Entry', 'encrypted');
      });

      expect(created).toEqual(mockEntry);
    });

    it('should update entry', async () => {
      const mockEntry = { id: 'entry-1', vault_id: 'vault-1', name: 'Updated', encrypted_data: 'new-data' };
      mockApi.updateEntry.mockResolvedValue(mockEntry);

      const { result } = renderHook(() => useVaultApi());

      let updated;
      await act(async () => {
        updated = await result.current.updateEntry('vault-1', 'entry-1', {
          name: 'Updated',
          encryptedData: 'new-data',
        });
      });

      expect(updated).toEqual(mockEntry);
    });

    it('should delete entry', async () => {
      mockApi.deleteEntry.mockResolvedValue(undefined);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        await result.current.deleteEntry('vault-1', 'entry-1');
      });

      expect(mockApi.deleteEntry).toHaveBeenCalledWith('vault-1', 'entry-1', undefined);
    });

    it('should refresh entries for vault', async () => {
      const mockEntries = [{ id: 'entry-1', vault_id: 'vault-1', name: 'Entry 1', encrypted_data: 'data1' }];
      mockApi.listEntries.mockResolvedValue(mockEntries);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        await result.current.refreshEntries('vault-1');
      });

      expect(result.current.entries).toEqual(mockEntries);
    });
  });

  describe('Sharing Operations', () => {
    it('should share vault with another user', async () => {
      const mockShare = { id: 'share-1', vault_id: 'vault-1', grantee_id: 'user-2', access_level: 'viewer' };
      mockApi.shareWithUser.mockResolvedValue(mockShare);

      const { result } = renderHook(() => useVaultApi());

      let shared;
      await act(async () => {
        shared = await result.current.shareWithUser('vault-1', 'user-2', 'viewer');
      });

      expect(shared).toEqual(mockShare);
    });

    it('should generate share link', async () => {
      const mockShareLink = {
        shareUrl: 'https://example.com/share/token123',
        shareToken: 'token123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      mockApi.generateShareLink.mockResolvedValue(mockShareLink);

      const { result } = renderHook(() => useVaultApi());

      let link;
      await act(async () => {
        link = await result.current.generateShareLink('vault-1', 'viewer', 3600);
      });

      expect(link?.shareToken).toBe('token123');
      expect(link?.expiresAt).toBeDefined();
    });

    it('should revoke share', async () => {
      mockApi.revokeShare.mockResolvedValue(undefined);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        await result.current.revokeShare('vault-1', 'share-1');
      });

      expect(mockApi.revokeShare).toHaveBeenCalledWith('vault-1', 'share-1', undefined);
    });

    it('should refresh shares for vault', async () => {
      const mockShares = [{ id: 'share-1', vault_id: 'vault-1', grantee_id: 'user-2', access_level: 'editor' }];
      mockApi.listShares.mockResolvedValue(mockShares);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        await result.current.refreshShares('vault-1');
      });

      expect(result.current.shares).toEqual(mockShares);
    });
  });

  describe('Error Handling', () => {
    it('should capture and display network errors', async () => {
      mockApi.listVaults.mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useVaultApi());

      await waitFor(() => {
        expect(result.current.error).toBe('Network timeout');
      });
    });

    it('should handle 404 errors gracefully', async () => {
      const error = new Error('Vault not found');
      mockApi.getVault.mockRejectedValue(error);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        try {
          await result.current.selectVault('invalid-vault');
        } catch (e) {
          // Expected
        }
      });

      expect(result.current.error).toBe('Vault not found');
    });

    it('should handle 403 access denied errors', async () => {
      const error = new Error('Access denied');
      mockApi.deleteVault.mockRejectedValue(error);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        try {
          await result.current.deleteVault('vault-1');
        } catch (e) {
          // Expected
        }
      });
    });
  });

  describe('Loading States', () => {
    it('should set loading to true during operations', async () => {
      mockApi.listVaults.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const { result } = renderHook(() => useVaultApi());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should clear loading state after successful operation', async () => {
      mockApi.createVault.mockResolvedValue({ id: 'vault-1', name: 'Test' });
      mockApi.listVaults.mockResolvedValue([]);

      const { result } = renderHook(() => useVaultApi());

      await act(async () => {
        await result.current.createVault('Test');
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Context Passing', () => {
    it('should pass context to API calls', async () => {
      const context = { userId: 'user-1', orgId: 'org-1', deviceId: 'device-1' };
      mockApi.listVaults.mockResolvedValue([]);

      const { result } = renderHook(() => useVaultApi(context));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockApi.listVaults).toHaveBeenCalledWith(context);
    });
  });
});
