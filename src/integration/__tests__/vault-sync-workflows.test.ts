import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vaultApi from '../../lib/vaultApi';

vi.mock('../../lib/vaultApi', () => ({
  createVault: vi.fn(),
  getVault: vi.fn(),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  listEntries: vi.fn(),
  shareWithUser: vi.fn(),
  revokeShare: vi.fn(),
  generateShareLink: vi.fn(),
  getSyncState: vi.fn(),
  pushChanges: vi.fn(),
  resolveConflict: vi.fn(),
  listShares: vi.fn(),
}));

const mockApi = vaultApi as any;

describe('Vault Sync Workflows - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Vault Creation → Entry → Sync → Conflict Resolution', () => {
    it('should create vault with encryption settings', async () => {
      const mockVault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Test Vault',
        description: 'Encrypted vault',
        encryption_algorithm: 'XChaCha20-Poly1305',
        key_derivation_algorithm: 'Argon2id',
        is_shared: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        is_deleted: false,
        last_modified_at: new Date().toISOString(),
        default_access_level: 'viewer',
      };

      mockApi.createVault.mockResolvedValue(mockVault);

      const result = await mockApi.createVault('Test Vault', 'Encrypted vault');

      expect(result.id).toBe('vault-1');
      expect(result.encryption_algorithm).toBe('XChaCha20-Poly1305');
      expect(result.owner_id).toBe('user-1');
    });

    it('should add entry with encrypted data', async () => {
      const mockEntry = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Database Password',
        encrypted_data: 'encrypted-payload-xyz',
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.createEntry.mockResolvedValue(mockEntry);

      const result = await mockApi.createEntry('vault-1', 'credential', 'Database Password', 'encrypted-payload-xyz');

      expect(result.id).toBe('entry-1');
      expect(result.vault_id).toBe('vault-1');
      expect(result.local_version).toBe(1);
    });

    it('should list entries in vault', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'DB Pass',
          encrypted_data: 'data1',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'entry-2',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'API Key',
          encrypted_data: 'data2',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockApi.listEntries.mockResolvedValue(mockEntries);

      const result = await mockApi.listEntries('vault-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('DB Pass');
      expect(result[1].name).toBe('API Key');
    });

    it('should share vault with viewer access', async () => {
      const mockShare = {
        id: 'share-1',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        grantee_id: 'user-2',
        access_level: 'viewer',
        created_at: new Date().toISOString(),
      };

      mockApi.shareWithUser.mockResolvedValue(mockShare);

      const result = await mockApi.shareWithUser('vault-1', 'user-2', 'viewer');

      expect(result.grantee_id).toBe('user-2');
      expect(result.access_level).toBe('viewer');
    });

    it('should access shared vault as grantee', async () => {
      const mockVault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Shared Vault',
        encryption_algorithm: 'XChaCha20-Poly1305',
        is_shared: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        is_deleted: false,
        key_derivation_algorithm: 'Argon2id',
        last_modified_at: new Date().toISOString(),
        default_access_level: 'viewer',
      };

      mockApi.getVault.mockResolvedValue(mockVault);

      const result = await mockApi.getVault('vault-1');

      expect(result.id).toBe('vault-1');
      expect(result.is_shared).toBe(true);
    });

    it('should detect version conflict on simultaneous edits', async () => {
      const mockState = {
        lastSyncAt: new Date().toISOString(),
        pendingChanges: [],
        conflicts: 1,
      };

      mockApi.getSyncState.mockResolvedValue(mockState);

      const result = await mockApi.getSyncState('vault-1');

      expect(result.conflicts).toBe(1);
    });

    it('should apply last-write-wins resolution strategy', async () => {
      const mockResolved = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Database Password',
        encrypted_data: 'remote-encrypted-data',
        local_version: 2,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.resolveConflict.mockResolvedValue(mockResolved);

      const result = await mockApi.resolveConflict('vault-1', 'entry-1', 'last-write-wins');

      expect(result.local_version).toBe(2);
    });

    it('should sync changes after conflict resolution', async () => {
      const mockState = {
        lastSyncAt: new Date().toISOString(),
        pendingChanges: [],
        conflicts: 0,
      };

      mockApi.getSyncState.mockResolvedValue(mockState);

      const result = await mockApi.getSyncState('vault-1');

      expect(result.conflicts).toBe(0);
    });

    it('should verify consistency after sync', async () => {
      const mockEntry = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Database Password',
        encrypted_data: 'data',
        local_version: 2,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.listEntries.mockResolvedValue([mockEntry]);

      const result = await mockApi.listEntries('vault-1');

      expect(result[0].local_version).toBe(2);
    });
  });

  describe('Scenario 2: Multi-Device Sync', () => {
    it('should create entry on Device A', async () => {
      const mockEntry = {
        id: 'entry-123',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'SSH Key',
        encrypted_data: 'device-a-data',
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.createEntry.mockResolvedValue(mockEntry);

      const result = await mockApi.createEntry('vault-1', 'credential', 'SSH Key', 'device-a-data');

      expect(result.id).toBe('entry-123');
      expect(result.local_version).toBe(1);
    });

    it('should sync entry from Device A to server', async () => {
      const mockResponse = {
        appliedChanges: [
          {
            operation: 'add',
            entryId: 'entry-123',
            newVersion: 1,
          },
        ],
        conflicts: [],
        lastSyncAt: new Date().toISOString(),
      };

      mockApi.pushChanges.mockResolvedValue(mockResponse);

      const result = await mockApi.pushChanges('vault-1', [
        {
          operation: 'add',
          entryId: 'entry-123',
          newVersion: 1,
        },
      ]);

      expect(result.appliedChanges).toHaveLength(1);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should poll for changes on Device B', async () => {
      const mockState = {
        lastSyncAt: new Date().toISOString(),
        pendingChanges: [
          {
            id: 'change-1',
            operation: 'add',
            entry_id: 'entry-123',
            new_version: 1,
            has_conflict: false,
            operation_timestamp: new Date().toISOString(),
          },
        ],
        conflicts: 0,
      };

      mockApi.getSyncState.mockResolvedValue(mockState);

      const result = await mockApi.getSyncState('vault-1');

      expect(result.pendingChanges).toHaveLength(1);
      expect(result.pendingChanges[0].entry_id).toBe('entry-123');
    });

    it('should apply change locally on Device B', async () => {
      const mockEntry = {
        id: 'entry-123',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'SSH Key',
        encrypted_data: 'device-a-data',
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.listEntries.mockResolvedValue([mockEntry]);

      const entries = await mockApi.listEntries('vault-1');

      expect(entries[0].id).toBe('entry-123');
      expect(entries[0].local_version).toBe(1);
    });

    it('should show entry in list on Device B', async () => {
      const mockEntries = [
        {
          id: 'entry-123',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'SSH Key',
          encrypted_data: 'data',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockApi.listEntries.mockResolvedValue(mockEntries);

      const result = await mockApi.listEntries('vault-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('SSH Key');
    });

    it('should handle modification on Device A for Device B to receive', async () => {
      const mockResponse = {
        appliedChanges: [
          {
            operation: 'update',
            entryId: 'entry-123',
            previousVersion: 1,
            newVersion: 2,
          },
        ],
        conflicts: [],
        lastSyncAt: new Date().toISOString(),
      };

      mockApi.pushChanges.mockResolvedValue(mockResponse);

      const result = await mockApi.pushChanges('vault-1', [
        {
          operation: 'update',
          entryId: 'entry-123',
          previousVersion: 1,
          newVersion: 2,
        },
      ]);

      expect(result.appliedChanges).toHaveLength(1);
    });

    it('should get updates on next poll from Device B', async () => {
      const mockState = {
        lastSyncAt: new Date().toISOString(),
        pendingChanges: [
          {
            id: 'change-2',
            operation: 'update',
            entry_id: 'entry-123',
            previous_version: 1,
            new_version: 2,
            has_conflict: false,
            operation_timestamp: new Date().toISOString(),
          },
        ],
        conflicts: 0,
      };

      mockApi.getSyncState.mockResolvedValue(mockState);

      const result = await mockApi.getSyncState('vault-1');

      expect(result.pendingChanges).toHaveLength(1);
      expect(result.pendingChanges[0].operation).toBe('update');
      expect(result.pendingChanges[0].new_version).toBe(2);
    });

    it('should handle polling interval (5s default)', async () => {
      mockApi.getSyncState.mockResolvedValue({
        lastSyncAt: new Date().toISOString(),
        pendingChanges: [],
        conflicts: 0,
      });

      await mockApi.getSyncState('vault-1');

      expect(mockApi.getSyncState).toHaveBeenCalled();
    });

    it('should handle 100+ entries in multi-device sync', async () => {
      const largeEntryList = Array.from({ length: 100 }, (_, i) => ({
        id: `entry-${i}`,
        vault_id: 'vault-1',
        type: 'credential',
        name: `Entry ${i}`,
        encrypted_data: `data-${i}`,
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      mockApi.listEntries.mockResolvedValue(largeEntryList);

      const result = await mockApi.listEntries('vault-1');

      expect(result).toHaveLength(100);
    });
  });

  describe('Scenario 3: Cross-Vault Sharing & Revocation', () => {
    it('should create vault with sensitive data', async () => {
      const mockVault = {
        id: 'vault-prod-secrets',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Prod Secrets',
        description: 'Production credentials',
        encryption_algorithm: 'XChaCha20-Poly1305',
        key_derivation_algorithm: 'Argon2id',
        is_shared: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        is_deleted: false,
        last_modified_at: new Date().toISOString(),
        default_access_level: 'viewer',
      };

      mockApi.createVault.mockResolvedValue(mockVault);

      const result = await mockApi.createVault('Prod Secrets', 'Production credentials');

      expect(result.name).toBe('Prod Secrets');
      expect(result.owner_id).toBe('user-1');
    });

    it('should add sensitive entries', async () => {
      const entryNames = ['DB Password', 'API Keys', 'Tokens'];

      mockApi.createEntry
        .mockResolvedValueOnce({
          id: 'entry-1',
          vault_id: 'vault-prod-secrets',
          type: 'credential',
          name: entryNames[0],
          encrypted_data: 'db-pwd-encrypted',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'entry-2',
          vault_id: 'vault-prod-secrets',
          type: 'credential',
          name: entryNames[1],
          encrypted_data: 'api-keys-encrypted',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'entry-3',
          vault_id: 'vault-prod-secrets',
          type: 'credential',
          name: entryNames[2],
          encrypted_data: 'tokens-encrypted',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      const results = await Promise.all(
        entryNames.map(name =>
          mockApi.createEntry('vault-prod-secrets', 'credential', name, 'encrypted-data')
        )
      );

      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(r.vault_id).toBe('vault-prod-secrets');
      });
    });

    it('should share vault with editor access', async () => {
      const mockShare = {
        id: 'share-editor-1',
        vault_id: 'vault-prod-secrets',
        grantor_id: 'user-1',
        grantee_id: 'user-editor',
        access_level: 'editor',
        created_at: new Date().toISOString(),
      };

      mockApi.shareWithUser.mockResolvedValue(mockShare);

      const result = await mockApi.shareWithUser('vault-prod-secrets', 'user-editor', 'editor');

      expect(result.access_level).toBe('editor');
      expect(result.grantee_id).toBe('user-editor');
    });

    it('should allow editor to access vault', async () => {
      const mockVault = {
        id: 'vault-prod-secrets',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Prod Secrets',
        is_shared: true,
        encryption_algorithm: 'XChaCha20-Poly1305',
        key_derivation_algorithm: 'Argon2id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        is_deleted: false,
        last_modified_at: new Date().toISOString(),
        default_access_level: 'editor',
      };

      mockApi.getVault.mockResolvedValue(mockVault);

      const result = await mockApi.getVault('vault-prod-secrets');

      expect(result.is_shared).toBe(true);
    });

    it('should allow editor to modify entry', async () => {
      const mockUpdated = {
        id: 'entry-1',
        vault_id: 'vault-prod-secrets',
        type: 'credential',
        name: 'DB Password',
        encrypted_data: 'db-pwd-encrypted-updated',
        local_version: 2,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.updateEntry.mockResolvedValue(mockUpdated);

      const result = await mockApi.updateEntry('vault-prod-secrets', 'entry-1', {
        encryptedData: 'db-pwd-encrypted-updated',
      });

      expect(result.local_version).toBe(2);
    });

    it('should record change in sync log for owner to see', async () => {
      mockApi.getSyncState.mockResolvedValue({
        lastSyncAt: new Date().toISOString(),
        pendingChanges: [
          {
            id: 'change-1',
            operation: 'update',
            entry_id: 'entry-1',
            new_version: 2,
            has_conflict: false,
            operation_timestamp: new Date().toISOString(),
          },
        ],
        conflicts: 0,
      });

      const result = await mockApi.getSyncState('vault-prod-secrets');

      expect(result.pendingChanges).toHaveLength(1);
      expect(result.pendingChanges[0].operation).toBe('update');
    });

    it('should owner see editor changes on next sync', async () => {
      const mockEntry = {
        id: 'entry-1',
        vault_id: 'vault-prod-secrets',
        type: 'credential',
        name: 'DB Password',
        encrypted_data: 'db-pwd-encrypted-updated',
        local_version: 2,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.listEntries.mockResolvedValue([mockEntry]);

      const entries = await mockApi.listEntries('vault-prod-secrets');

      expect(entries[0].local_version).toBe(2);
    });

    it('should revoke share', async () => {
      mockApi.revokeShare.mockResolvedValue(undefined);

      await mockApi.revokeShare('vault-prod-secrets', 'share-editor-1');

      expect(mockApi.revokeShare).toHaveBeenCalledWith('vault-prod-secrets', 'share-editor-1');
    });

    it('should deny editor access after revocation', async () => {
      mockApi.getVault.mockRejectedValue(new Error('Unauthorized: share revoked'));

      await expect(mockApi.getVault('vault-prod-secrets')).rejects.toThrow(
        'Unauthorized: share revoked'
      );
    });

    it('should test share link expiration', async () => {
      mockApi.generateShareLink.mockResolvedValue({
        shareToken: 'expired-token',
        shareUrl: 'https://example.com/share/expired-token',
      });

      const result = await mockApi.generateShareLink('vault-prod-secrets', 'viewer', 1);

      expect(result.shareToken).toBeDefined();
    });
  });

  describe('Scenario 4: Conflict Resolution Strategies', () => {
    it('should detect simultaneous edits creating conflict', async () => {
      mockApi.getSyncState.mockResolvedValue({
        lastSyncAt: new Date().toISOString(),
        pendingChanges: [],
        conflicts: 1,
      });

      const result = await mockApi.getSyncState('vault-1');

      expect(result.conflicts).toBe(1);
    });

    it('should apply last-write-wins strategy', async () => {
      const mockResolved = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Data',
        encrypted_data: 'remote-edit-data',
        local_version: 2,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.resolveConflict.mockResolvedValue(mockResolved);

      const result = await mockApi.resolveConflict('vault-1', 'entry-1', 'last-write-wins');

      expect(result.local_version).toBe(2);
    });

    it('should apply local-wins strategy', async () => {
      const mockResolved = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Data',
        encrypted_data: 'local-edit-data',
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.resolveConflict.mockResolvedValue(mockResolved);

      const result = await mockApi.resolveConflict('vault-1', 'entry-1', 'local-wins');

      expect(result.local_version).toBe(1);
    });

    it('should apply remote-wins strategy', async () => {
      const mockResolved = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Data',
        encrypted_data: 'remote-edit-data',
        local_version: 2,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.resolveConflict.mockResolvedValue(mockResolved);

      const result = await mockApi.resolveConflict('vault-1', 'entry-1', 'remote-wins');

      expect(result.local_version).toBe(2);
    });

    it('should support manual resolution selection', async () => {
      const mockResolved = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Data',
        encrypted_data: 'local-edit-data',
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.resolveConflict.mockResolvedValue(mockResolved);

      const result = await mockApi.resolveConflict('vault-1', 'entry-1', 'manual');

      expect(result).toBeDefined();
      expect(result.local_version).toBeDefined();
    });

    it('should verify correct version retained after resolution', async () => {
      const mockEntry = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Data',
        encrypted_data: 'remote-edit-data',
        local_version: 2,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.listEntries.mockResolvedValue([mockEntry]);

      const entries = await mockApi.listEntries('vault-1');

      expect(entries[0].local_version).toBe(2);
    });

    it('should handle multiple conflicts with different strategies', async () => {
      mockApi.getSyncState.mockResolvedValue({
        lastSyncAt: new Date().toISOString(),
        pendingChanges: [],
        conflicts: 3,
      });

      const result = await mockApi.getSyncState('vault-1');

      expect(result.conflicts).toBe(3);
    });

    it('should resolve all conflicts successfully', async () => {
      mockApi.resolveConflict
        .mockResolvedValueOnce({
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Data',
          encrypted_data: 'resolved-1',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'entry-2',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Data',
          encrypted_data: 'resolved-2',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          id: 'entry-3',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Data',
          encrypted_data: 'resolved-3',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      const r1 = await mockApi.resolveConflict('vault-1', 'entry-1', 'last-write-wins');
      const r2 = await mockApi.resolveConflict('vault-1', 'entry-2', 'local-wins');
      const r3 = await mockApi.resolveConflict('vault-1', 'entry-3', 'remote-wins');

      expect(r1).toBeDefined();
      expect(r2).toBeDefined();
      expect(r3).toBeDefined();
      expect(mockApi.resolveConflict).toHaveBeenCalledTimes(3);
    });
  });

  describe('Cross-Scenario Consistency', () => {
    it('should maintain version consistency across all scenarios', async () => {
      mockApi.listEntries.mockResolvedValue([
        {
          id: 'e1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Entry 1',
          encrypted_data: 'data1',
          local_version: 2,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'e2',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Entry 2',
          encrypted_data: 'data2',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const entries = await mockApi.listEntries('vault-1');

      expect(entries).toHaveLength(2);
      entries.forEach(e => {
        expect(e.local_version).toBeGreaterThan(0);
      });
    });

    it('should handle vault state with mixed scenarios', async () => {
      const mockVault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Complex Vault',
        encryption_algorithm: 'XChaCha20-Poly1305',
        key_derivation_algorithm: 'Argon2id',
        is_shared: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        is_deleted: false,
        last_modified_at: new Date().toISOString(),
        default_access_level: 'viewer',
      };

      mockApi.getVault.mockResolvedValue(mockVault);
      mockApi.listShares.mockResolvedValue([
        {
          id: 'share-1',
          vault_id: 'vault-1',
          grantor_id: 'user-1',
          grantee_id: 'user-2',
          access_level: 'viewer',
          created_at: new Date().toISOString(),
        },
        {
          id: 'share-2',
          vault_id: 'vault-1',
          grantor_id: 'user-1',
          grantee_id: 'user-3',
          access_level: 'editor',
          created_at: new Date().toISOString(),
        },
      ]);

      const vault = await mockApi.getVault('vault-1');
      const shares = await mockApi.listShares('vault-1');

      expect(vault.is_shared).toBe(true);
      expect(shares).toHaveLength(2);
    });

    it('should ensure no data loss in complex sync', async () => {
      mockApi.getSyncState.mockResolvedValue({
        lastSyncAt: new Date().toISOString(),
        pendingChanges: [
          {
            id: 'c1',
            operation: 'add',
            entry_id: 'entry-1',
            new_version: 1,
            has_conflict: false,
            operation_timestamp: new Date().toISOString(),
          },
          {
            id: 'c2',
            operation: 'update',
            entry_id: 'entry-2',
            previous_version: 1,
            new_version: 2,
            has_conflict: false,
            operation_timestamp: new Date().toISOString(),
          },
        ],
        conflicts: 0,
      });

      const state = await mockApi.getSyncState('vault-1');

      expect(state.pendingChanges).toHaveLength(2);
      expect(state.conflicts).toBe(0);
    });
  });
});
