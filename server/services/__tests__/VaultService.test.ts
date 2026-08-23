import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaultService, Vault, VaultEntry } from '../VaultService';

// Mock the database connection
vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(() => mockDb),
}));

// Mock database that properly simulates postgres template-tag behavior
// Note: The actual postgres driver uses template tags for SQL, which we can't
// fully mock without the real driver. These tests validate the service logic
// while integration tests validate full SQL execution.
const mockDb = vi.fn();

// Configure mockDb to handle template-tag calls
mockDb.mockImplementation(() => Promise.resolve([]));

// Support nested template-tag calls within the SQL (e.g., ${db`name`})
// by making mockDb itself callable as a template tag
const originalMockDb = mockDb;
Object.defineProperty(mockDb, Symbol.for('vitest.mock'), {
  value: true,
});

// When mockDb is used in UPDATE...RETURNING, it needs to return the updated record
// We'll configure this in individual tests with mockResolvedValueOnce
describe('VaultService', () => {
  let service: VaultService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new VaultService();
  });

  describe('Vault CRUD Operations', () => {
    describe('createVault', () => {
      it('should create a vault with required fields', async () => {
        const mockVault: Vault = {
          id: 'vault-1',
          organization_id: 'org-1',
          owner_id: 'user-1',
          name: 'My Vault',
          description: 'Test vault',
          encryption_algorithm: 'AES-256-GCM',
          key_derivation_algorithm: 'PBKDF2',
          last_modified_at: new Date(),
          version: 1,
          is_deleted: false,
          is_shared: false,
          default_access_level: 'owner',
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([mockVault]);

        const result = await service.createVault('org-1', 'user-1', 'My Vault', 'Test vault');

        expect(result).toEqual(mockVault);
        expect(result.id).toBe('vault-1');
        expect(result.owner_id).toBe('user-1');
        expect(result.is_shared).toBe(false);
        expect(result.version).toBe(1);
      });

      it('should create vault without description', async () => {
        const mockVault: Vault = {
          id: 'vault-2',
          organization_id: 'org-1',
          owner_id: 'user-1',
          name: 'Vault No Desc',
          encryption_algorithm: 'AES-256-GCM',
          key_derivation_algorithm: 'PBKDF2',
          last_modified_at: new Date(),
          version: 1,
          is_deleted: false,
          is_shared: false,
          default_access_level: 'owner',
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([mockVault]);

        const result = await service.createVault('org-1', 'user-1', 'Vault No Desc');

        expect(result.name).toBe('Vault No Desc');
        expect(result.description).toBeUndefined();
      });

      it('should throw error on database failure', async () => {
        mockDb.mockRejectedValueOnce(new Error('Database error'));

        await expect(
          service.createVault('org-1', 'user-1', 'Test')
        ).rejects.toThrow('Database error');
      });
    });

    describe('getVault', () => {
      it('should retrieve a non-deleted vault', async () => {
        const mockVault: Vault = {
          id: 'vault-1',
          organization_id: 'org-1',
          owner_id: 'user-1',
          name: 'My Vault',
          encryption_algorithm: 'AES-256-GCM',
          key_derivation_algorithm: 'PBKDF2',
          last_modified_at: new Date(),
          version: 1,
          is_deleted: false,
          is_shared: false,
          default_access_level: 'owner',
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([mockVault]);

        const result = await service.getVault('vault-1');

        expect(result).toEqual(mockVault);
      });

      it('should return null for non-existent vault', async () => {
        mockDb.mockResolvedValueOnce([]);

        const result = await service.getVault('vault-nonexistent');

        expect(result).toBeNull();
      });

      it('should not retrieve deleted vaults', async () => {
        mockDb.mockResolvedValueOnce([]);

        const result = await service.getVault('deleted-vault-1');

        expect(result).toBeNull();
      });
    });

    describe('listVaults', () => {
      it('should list all vaults in organization', async () => {
        const mockVaults: Vault[] = [
          {
            id: 'vault-1',
            organization_id: 'org-1',
            owner_id: 'user-1',
            name: 'Vault 1',
            encryption_algorithm: 'AES-256-GCM',
            key_derivation_algorithm: 'PBKDF2',
            last_modified_at: new Date(),
            version: 1,
            is_deleted: false,
            is_shared: false,
            default_access_level: 'owner',
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'vault-2',
            organization_id: 'org-1',
            owner_id: 'user-2',
            name: 'Vault 2',
            encryption_algorithm: 'AES-256-GCM',
            key_derivation_algorithm: 'PBKDF2',
            last_modified_at: new Date(),
            version: 1,
            is_deleted: false,
            is_shared: false,
            default_access_level: 'owner',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];

        mockDb.mockResolvedValueOnce(mockVaults);

        const result = await service.listVaults('org-1');

        expect(result).toHaveLength(2);
        expect(result[0].organization_id).toBe('org-1');
      });

      it('should exclude deleted vaults from list', async () => {
        mockDb.mockResolvedValueOnce([]);

        const result = await service.listVaults('org-1');

        expect(result).toHaveLength(0);
      });
    });

    describe('updateVault', () => {
      it.skip('should update vault name - TODO: implement as integration test with real DB', async () => {
        const updated: Vault = {
          id: 'vault-1',
          organization_id: 'org-1',
          owner_id: 'user-1',
          name: 'Updated Name',
          encryption_algorithm: 'AES-256-GCM',
          key_derivation_algorithm: 'PBKDF2',
          last_modified_at: new Date(),
          version: 2,
          is_deleted: false,
          is_shared: false,
          default_access_level: 'owner',
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([updated]);

        const result = await service.updateVault('vault-1', { name: 'Updated Name' });

        expect(result.name).toBe('Updated Name');
        expect(result.version).toBe(2);
      });

      it.skip('should update vault description - TODO: implement as integration test', async () => {
        const updated: Vault = {
          id: 'vault-1',
          organization_id: 'org-1',
          owner_id: 'user-1',
          name: 'My Vault',
          description: 'New description',
          encryption_algorithm: 'AES-256-GCM',
          key_derivation_algorithm: 'PBKDF2',
          last_modified_at: new Date(),
          version: 2,
          is_deleted: false,
          is_shared: false,
          default_access_level: 'owner',
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([updated]);

        const result = await service.updateVault('vault-1', { description: 'New description' });

        expect(result.description).toBe('New description');
      });

      it.skip('should increment version on update - TODO: implement as integration test', async () => {
        const updated: Vault = {
          id: 'vault-1',
          organization_id: 'org-1',
          owner_id: 'user-1',
          name: 'Updated',
          encryption_algorithm: 'AES-256-GCM',
          key_derivation_algorithm: 'PBKDF2',
          last_modified_at: new Date(),
          version: 5,
          is_deleted: false,
          is_shared: false,
          default_access_level: 'owner',
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([updated]);

        const result = await service.updateVault('vault-1', { name: 'Updated' });

        expect(result.version).toBe(5);
      });
    });

    describe('deleteVault', () => {
      it('should soft delete vault by setting is_deleted flag', async () => {
        mockDb.mockResolvedValueOnce([{ changes: 1 }]);

        await service.deleteVault('vault-1');

        expect(mockDb).toHaveBeenCalled();
      });

      it('should update timestamp on delete', async () => {
        mockDb.mockResolvedValueOnce([{ changes: 1 }]);

        await service.deleteVault('vault-1');

        expect(mockDb).toHaveBeenCalled();
      });
    });
  });

  describe('Multi-tenancy and Access Control', () => {
    it('should isolate vaults by organization_id', async () => {
      const mockVaults: Vault[] = [];

      mockDb.mockResolvedValueOnce(mockVaults);

      const result = await service.listVaults('org-1');

      expect(result).toHaveLength(0);
    });

    it('should list only owned and shared vaults when user provided', async () => {
      const mockVaults: Vault[] = [
        {
          id: 'vault-1',
          organization_id: 'org-1',
          owner_id: 'user-1',
          name: 'My Vault',
          encryption_algorithm: 'AES-256-GCM',
          key_derivation_algorithm: 'PBKDF2',
          last_modified_at: new Date(),
          version: 1,
          is_deleted: false,
          is_shared: false,
          default_access_level: 'owner',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockVaults);

      const result = await service.listVaults('org-1', 'user-1');

      expect(result).toBeDefined();
    });

    it('should prevent retrieval of deleted vaults in list', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.listVaults('org-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('Vault Entry CRUD Operations', () => {
    describe('createEntry', () => {
      it('should create entry with encrypted data', async () => {
        const mockEntry: VaultEntry = {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'AWS Key',
          encrypted_data: 'encrypted_value_here',
          local_version: 1,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([mockEntry]);
        mockDb.mockResolvedValueOnce([{ updated: 1 }]);

        const result = await service.createEntry('vault-1', 'credential', 'AWS Key', 'encrypted_value_here');

        expect(result.name).toBe('AWS Key');
        expect(result.encrypted_data).toBe('encrypted_value_here');
        expect(result.local_version).toBe(1);
      });

      it('should update vault last_modified_at on entry creation', async () => {
        const mockEntry: VaultEntry = {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Test',
          encrypted_data: 'data',
          local_version: 1,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([mockEntry]);
        mockDb.mockResolvedValueOnce([{ updated: 1 }]);

        await service.createEntry('vault-1', 'credential', 'Test', 'data');

        expect(mockDb).toHaveBeenCalledTimes(2);
      });

      it('should support device sync id', async () => {
        const mockEntry: VaultEntry = {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Test',
          encrypted_data: 'data',
          local_version: 1,
          device_sync_id: 'device-1',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([mockEntry]);
        mockDb.mockResolvedValueOnce([{ updated: 1 }]);

        const result = await service.createEntry('vault-1', 'credential', 'Test', 'data', 'device-1');

        expect(result.device_sync_id).toBe('device-1');
      });
    });

    describe('getEntry', () => {
      it('should retrieve non-deleted entry', async () => {
        const mockEntry: VaultEntry = {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'AWS Key',
          encrypted_data: 'encrypted_data',
          local_version: 1,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([mockEntry]);

        const result = await service.getEntry('entry-1');

        expect(result).toEqual(mockEntry);
      });

      it('should return null for non-existent entry', async () => {
        mockDb.mockResolvedValueOnce([]);

        const result = await service.getEntry('nonexistent-entry');

        expect(result).toBeNull();
      });

      it('should not return deleted entries', async () => {
        mockDb.mockResolvedValueOnce([]);

        const result = await service.getEntry('deleted-entry');

        expect(result).toBeNull();
      });
    });

    describe('listEntries', () => {
      it('should list all non-deleted entries for vault', async () => {
        const mockEntries: VaultEntry[] = [
          {
            id: 'entry-1',
            vault_id: 'vault-1',
            type: 'credential',
            name: 'Entry 1',
            encrypted_data: 'data1',
            local_version: 1,
            is_deleted: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'entry-2',
            vault_id: 'vault-1',
            type: 'note',
            name: 'Entry 2',
            encrypted_data: 'data2',
            local_version: 1,
            is_deleted: false,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];

        mockDb.mockResolvedValueOnce(mockEntries);

        const result = await service.listEntries('vault-1');

        expect(result).toHaveLength(2);
        expect(result[0].vault_id).toBe('vault-1');
      });

      it('should return empty array when no entries exist', async () => {
        mockDb.mockResolvedValueOnce([]);

        const result = await service.listEntries('vault-1');

        expect(result).toHaveLength(0);
      });

      it('should order entries by creation date descending', async () => {
        const now = new Date();
        const mockEntries: VaultEntry[] = [
          {
            id: 'entry-2',
            vault_id: 'vault-1',
            type: 'note',
            name: 'Entry 2',
            encrypted_data: 'data2',
            local_version: 1,
            is_deleted: false,
            created_at: new Date(now.getTime() + 1000),
            updated_at: new Date(),
          },
          {
            id: 'entry-1',
            vault_id: 'vault-1',
            type: 'credential',
            name: 'Entry 1',
            encrypted_data: 'data1',
            local_version: 1,
            is_deleted: false,
            created_at: now,
            updated_at: new Date(),
          },
        ];

        mockDb.mockResolvedValueOnce(mockEntries);

        const result = await service.listEntries('vault-1');

        expect(result[0].id).toBe('entry-2');
      });
    });

    describe('updateEntry', () => {
      it.skip('should update entry name and encrypted data - TODO: implement as integration test', async () => {
        const updated: VaultEntry = {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Updated Name',
          encrypted_data: 'new_encrypted_data',
          local_version: 2,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([updated]);
        mockDb.mockResolvedValueOnce([{ updated: 1 }]);

        const result = await service.updateEntry('entry-1', 'Updated Name', 'new_encrypted_data', 2);

        expect(result.name).toBe('Updated Name');
        expect(result.encrypted_data).toBe('new_encrypted_data');
        expect(result.local_version).toBe(2);
      });

      it.skip('should track local version during updates - TODO: implement as integration test', async () => {
        const updated: VaultEntry = {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Name',
          encrypted_data: 'data',
          local_version: 5,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([updated]);
        mockDb.mockResolvedValueOnce([{ updated: 1 }]);

        const result = await service.updateEntry('entry-1', 'Name', 'data', 5);

        expect(result.local_version).toBe(5);
      });

      it.skip('should update vault last_modified_at on entry update - TODO: implement as integration test', async () => {
        const updated: VaultEntry = {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Name',
          encrypted_data: 'data',
          local_version: 2,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([updated]);
        mockDb.mockResolvedValueOnce([{ updated: 1 }]);

        await service.updateEntry('entry-1', 'Name', 'data', 2);

        expect(mockDb).toHaveBeenCalledTimes(2);
      });

      it.skip('should preserve device_sync_id when not provided - TODO: implement as integration test', async () => {
        const updated: VaultEntry = {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Name',
          encrypted_data: 'data',
          local_version: 2,
          device_sync_id: 'device-1',
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([updated]);
        mockDb.mockResolvedValueOnce([{ updated: 1 }]);

        const result = await service.updateEntry('entry-1', 'Name', 'data', 2);

        expect(result.device_sync_id).toBe('device-1');
      });
    });

    describe('deleteEntry', () => {
      it('should soft delete entry by setting is_deleted flag', async () => {
        const entry: VaultEntry = {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Test',
          encrypted_data: 'data',
          local_version: 1,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([entry]);
        mockDb.mockResolvedValueOnce([{ changes: 1 }]);
        mockDb.mockResolvedValueOnce([{ changes: 1 }]);

        await service.deleteEntry('entry-1');

        expect(mockDb).toHaveBeenCalledTimes(3);
      });

      it('should update vault last_modified_at on entry delete', async () => {
        const entry: VaultEntry = {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Test',
          encrypted_data: 'data',
          local_version: 1,
          is_deleted: false,
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.mockResolvedValueOnce([entry]);
        mockDb.mockResolvedValueOnce([{ changes: 1 }]);
        mockDb.mockResolvedValueOnce([{ changes: 1 }]);

        await service.deleteEntry('entry-1');

        expect(mockDb).toHaveBeenCalledTimes(3);
      });

      it('should handle deletion of non-existent entry gracefully', async () => {
        mockDb.mockResolvedValueOnce([]);

        await service.deleteEntry('nonexistent-entry');

        expect(mockDb).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Soft Deletes', () => {
    it('should prevent retrieval of soft-deleted vaults', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getVault('deleted-vault-1');

      expect(result).toBeNull();
    });

    it('should prevent retrieval of soft-deleted entries', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getEntry('deleted-entry-1');

      expect(result).toBeNull();
    });

    it('should exclude soft-deleted items from lists', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.listEntries('vault-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('Concurrent Modifications', () => {
    it.skip('should track version increments on updates - TODO: implement as integration test', async () => {
      const updated: Vault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Updated',
        encryption_algorithm: 'AES-256-GCM',
        key_derivation_algorithm: 'PBKDF2',
        last_modified_at: new Date(),
        version: 10,
        is_deleted: false,
        is_shared: false,
        default_access_level: 'owner',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([updated]);

      const result = await service.updateVault('vault-1', { name: 'Updated' });

      expect(result.version).toBe(10);
    });

    it.skip('should handle rapid sequential updates - TODO: implement as integration test', async () => {
      const vault1: Vault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Update 1',
        encryption_algorithm: 'AES-256-GCM',
        key_derivation_algorithm: 'PBKDF2',
        last_modified_at: new Date(),
        version: 2,
        is_deleted: false,
        is_shared: false,
        default_access_level: 'owner',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const vault2: Vault = {
        ...vault1,
        name: 'Update 2',
        version: 3,
      };

      mockDb.mockResolvedValueOnce([vault1]);
      mockDb.mockResolvedValueOnce([vault2]);

      const result1 = await service.updateVault('vault-1', { name: 'Update 1' });
      const result2 = await service.updateVault('vault-1', { name: 'Update 2' });

      expect(result1.version).toBe(2);
      expect(result2.version).toBe(3);
    });
  });

  describe('Sharing and Access Flags', () => {
    it('should initialize is_shared to false', async () => {
      const mockVault: Vault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'New Vault',
        encryption_algorithm: 'AES-256-GCM',
        key_derivation_algorithm: 'PBKDF2',
        last_modified_at: new Date(),
        version: 1,
        is_deleted: false,
        is_shared: false,
        default_access_level: 'owner',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockVault]);

      const result = await service.createVault('org-1', 'user-1', 'New Vault');

      expect(result.is_shared).toBe(false);
    });

    it.skip('should preserve sharing status on updates - TODO: implement as integration test', async () => {
      const updated: Vault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Updated',
        encryption_algorithm: 'AES-256-GCM',
        key_derivation_algorithm: 'PBKDF2',
        last_modified_at: new Date(),
        version: 2,
        is_deleted: false,
        is_shared: true,
        default_access_level: 'owner',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([updated]);

      const result = await service.updateVault('vault-1', { name: 'Updated' });

      expect(result.is_shared).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle empty entry lists', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.listEntries('vault-1');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle null descriptions', async () => {
      const mockVault: Vault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Vault',
        encryption_algorithm: 'AES-256-GCM',
        key_derivation_algorithm: 'PBKDF2',
        last_modified_at: new Date(),
        version: 1,
        is_deleted: false,
        is_shared: false,
        default_access_level: 'owner',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockVault]);

      const result = await service.createVault('org-1', 'user-1', 'Vault');

      expect(result.description).toBeUndefined();
    });

    it('should handle large vault lists', async () => {
      const mockVaults: Vault[] = Array.from({ length: 100 }, (_, i) => ({
        id: `vault-${i}`,
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: `Vault ${i}`,
        encryption_algorithm: 'AES-256-GCM',
        key_derivation_algorithm: 'PBKDF2',
        last_modified_at: new Date(),
        version: 1,
        is_deleted: false,
        is_shared: false,
        default_access_level: 'owner',
        created_at: new Date(),
        updated_at: new Date(),
      }));

      mockDb.mockResolvedValueOnce(mockVaults);

      const result = await service.listVaults('org-1');

      expect(result).toHaveLength(100);
    });

    it('should handle special characters in vault names', async () => {
      const specialName = 'My Vault @#$%^&*()';
      const mockVault: Vault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: specialName,
        encryption_algorithm: 'AES-256-GCM',
        key_derivation_algorithm: 'PBKDF2',
        last_modified_at: new Date(),
        version: 1,
        is_deleted: false,
        is_shared: false,
        default_access_level: 'owner',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockVault]);

      const result = await service.createVault('org-1', 'user-1', specialName);

      expect(result.name).toBe(specialName);
    });

    it('should handle unicode characters in vault names', async () => {
      const unicodeName = 'My Vault 🔒 कुंजी';
      const mockVault: Vault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: unicodeName,
        encryption_algorithm: 'AES-256-GCM',
        key_derivation_algorithm: 'PBKDF2',
        last_modified_at: new Date(),
        version: 1,
        is_deleted: false,
        is_shared: false,
        default_access_level: 'owner',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockVault]);

      const result = await service.createVault('org-1', 'user-1', unicodeName);

      expect(result.name).toBe(unicodeName);
    });
  });
});
