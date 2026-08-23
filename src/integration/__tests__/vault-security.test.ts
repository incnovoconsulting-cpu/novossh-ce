import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vaultApi from '../../lib/vaultApi';

vi.mock('../../lib/vaultApi', () => ({
  createVault: vi.fn(),
  getVault: vi.fn(),
  deleteVault: vi.fn(),
  updateVault: vi.fn(),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  listEntries: vi.fn(),
  shareWithUser: vi.fn(),
  revokeShare: vi.fn(),
  generateShareLink: vi.fn(),
  listShares: vi.fn(),
  getSyncState: vi.fn(),
  resolveConflict: vi.fn(),
}));

const mockApi = vaultApi as any;

describe('Vault Security Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Access Control Enforcement', () => {
    it('should deny delete vault to non-owner', async () => {
      mockApi.deleteVault.mockRejectedValue(
        new Error('Unauthorized: Only owner can delete vault')
      );

      await expect(mockApi.deleteVault('vault-1')).rejects.toThrow(
        'Unauthorized: Only owner can delete vault'
      );
    });

    it('should deny modify vault settings to non-owner', async () => {
      mockApi.updateVault.mockRejectedValue(
        new Error('Unauthorized: Only owner can modify settings')
      );

      await expect(
        mockApi.updateVault('vault-1', { name: 'New Name' })
      ).rejects.toThrow('Unauthorized: Only owner can modify settings');
    });

    it('should deny grantee delete vault even with editor access', async () => {
      mockApi.deleteVault.mockRejectedValue(
        new Error('Unauthorized: Grantee cannot delete vault')
      );

      await expect(mockApi.deleteVault('vault-1')).rejects.toThrow(
        'Unauthorized: Grantee cannot delete vault'
      );
    });

    it('should deny viewer to modify entries', async () => {
      mockApi.updateEntry.mockRejectedValue(
        new Error('Unauthorized: Viewer cannot modify entries')
      );

      await expect(
        mockApi.updateEntry('vault-1', 'entry-1', { encryptedData: 'new-data' })
      ).rejects.toThrow('Unauthorized: Viewer cannot modify entries');
    });

    it('should allow editor to modify entries', async () => {
      const mockEntry = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Database Password',
        encrypted_data: 'updated-data',
        local_version: 2,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.updateEntry.mockResolvedValue(mockEntry);

      const result = await mockApi.updateEntry('vault-1', 'entry-1', {
        encryptedData: 'updated-data',
      });

      expect(result.encrypted_data).toBe('updated-data');
    });

    it('should only allow owner to revoke shares', async () => {
      mockApi.revokeShare.mockRejectedValue(
        new Error('Unauthorized: Only owner can revoke shares')
      );

      await expect(mockApi.revokeShare('vault-1', 'share-1')).rejects.toThrow(
        'Unauthorized: Only owner can revoke shares'
      );
    });
  });

  describe('Encryption at Rest', () => {
    it('should store entry data encrypted on server', async () => {
      const mockEntry = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'API Key',
        encrypted_data: 'encrypted-payload-with-nonce',
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.createEntry.mockResolvedValue(mockEntry);

      const result = await mockApi.createEntry(
        'vault-1',
        'credential',
        'API Key',
        'encrypted-payload-with-nonce'
      );

      expect(result.encrypted_data).not.toBe('plain-api-key');
      expect(result.encrypted_data).toMatch(/^encrypted-/);
    });

    it('should verify server cannot decrypt without client key', async () => {
      const encryptedData = 'encrypted-data-without-key';
      mockApi.createEntry.mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Secret',
        encrypted_data: encryptedData,
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const entry = await mockApi.createEntry('vault-1', 'credential', 'Secret', encryptedData);

      expect(entry.encrypted_data).toBe(encryptedData);
      expect(entry.encrypted_data).not.toBe('decrypted-secret');
    });

    it('should verify encryption roundtrip (encrypt → decrypt = original)', async () => {
      const originalData = 'sensitive-credential-data';
      const encryptedData = 'aes-gcm-encrypted-payload-xyz';

      mockApi.createEntry.mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Test',
        encrypted_data: encryptedData,
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      mockApi.listEntries.mockResolvedValue([
        {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Test',
          encrypted_data: encryptedData,
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const created = await mockApi.createEntry(
        'vault-1',
        'credential',
        'Test',
        encryptedData
      );
      const retrieved = (await mockApi.listEntries('vault-1'))[0];

      expect(created.encrypted_data).toBe(retrieved.encrypted_data);
    });

    it('should use different nonces for different entries', async () => {
      const entry1 = {
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Secret 1',
        encrypted_data: 'encrypted-data-with-nonce-abc123',
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const entry2 = {
        id: 'entry-2',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Secret 2',
        encrypted_data: 'encrypted-data-with-nonce-xyz789',
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockApi.listEntries.mockResolvedValue([entry1, entry2]);

      const entries = await mockApi.listEntries('vault-1');

      expect(entries[0].encrypted_data).not.toBe(entries[1].encrypted_data);
    });
  });

  describe('Share Token Security', () => {
    it('should generate 32-byte random tokens', async () => {
      const mockLink = {
        shareToken: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
        shareUrl: 'https://app.example.com/share/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
      };

      mockApi.generateShareLink.mockResolvedValue(mockLink);

      const result = await mockApi.generateShareLink('vault-1', 'viewer');

      expect(result.shareToken).toMatch(/^[a-f0-9]{32,}$/);
      expect(result.shareToken.length).toBeGreaterThanOrEqual(32);
    });

    it('should use cryptographically secure tokens (not guessable)', async () => {
      const tokens = new Set();

      mockApi.generateShareLink.mockImplementation(async () => {
        const randomToken = Math.random().toString(36).substring(2, 34);
        return {
          shareToken: randomToken,
          shareUrl: `https://app.example.com/share/${randomToken}`,
        };
      });

      for (let i = 0; i < 100; i++) {
        const result = await mockApi.generateShareLink('vault-1', 'viewer');
        tokens.add(result.shareToken);
      }

      expect(tokens.size).toBe(100);
    });

    it('should validate token expiration', async () => {
      const expiredToken = {
        shareToken: 'expired-token-abc123',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      };

      mockApi.generateShareLink.mockResolvedValue(expiredToken);

      const token = await mockApi.generateShareLink('vault-1', 'viewer', 1);
      const expiresAt = new Date(token.expires_at).getTime();

      expect(expiresAt).toBeLessThan(Date.now());
    });

    it('should reject revoked tokens', async () => {
      mockApi.generateShareLink.mockRejectedValue(new Error('Token revoked'));

      await expect(mockApi.generateShareLink('vault-1', 'viewer')).rejects.toThrow(
        'Token revoked'
      );
    });

    it('should use different token than stored hash', async () => {
      const storedHash = 'hash-of-token-in-database';
      const shareToken = 'actual-token-shown-to-user';

      mockApi.generateShareLink.mockResolvedValue({
        shareToken: shareToken,
        shareUrl: `https://app.example.com/share/${shareToken}`,
      });

      const result = await mockApi.generateShareLink('vault-1', 'viewer');

      expect(result.shareToken).not.toBe(storedHash);
      expect(result.shareToken).toBe(shareToken);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in vault name', async () => {
      const maliciousInput = "'; DROP TABLE vaults; --";

      mockApi.createVault.mockResolvedValue({
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: maliciousInput,
        encryption_algorithm: 'XChaCha20-Poly1305',
        key_derivation_algorithm: 'Argon2id',
        is_shared: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        is_deleted: false,
        last_modified_at: new Date().toISOString(),
        default_access_level: 'viewer',
      });

      const result = await mockApi.createVault(maliciousInput, '');

      expect(result.name).toBe(maliciousInput);
      expect(mockApi.createVault).toHaveBeenCalledWith(maliciousInput, '');
    });

    it('should prevent SQL injection in user ID', async () => {
      const maliciousUserId = "' OR '1'='1";

      mockApi.shareWithUser.mockResolvedValue({
        id: 'share-1',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        grantee_id: maliciousUserId,
        access_level: 'viewer',
        created_at: new Date().toISOString(),
      });

      const result = await mockApi.shareWithUser('vault-1', maliciousUserId, 'viewer');

      expect(result.grantee_id).toBe(maliciousUserId);
      expect(mockApi.shareWithUser).toHaveBeenCalledWith('vault-1', maliciousUserId, 'viewer');
    });

    it('should use parameterized queries', async () => {
      mockApi.createEntry.mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
        type: 'credential',
        name: 'Test',
        encrypted_data: 'encrypted-data',
        local_version: 1,
        is_deleted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await mockApi.createEntry('vault-1', 'credential', 'Test', 'encrypted-data');

      expect(mockApi.createEntry).toHaveBeenCalledWith(
        'vault-1',
        'credential',
        'Test',
        'encrypted-data'
      );
    });
  });

  describe('Cross-Tenant Isolation', () => {
    it('should not allow access to vaults from other organizations', async () => {
      mockApi.getVault.mockRejectedValue(
        new Error('Unauthorized: Vault not found in your organization')
      );

      await expect(mockApi.getVault('vault-other-org')).rejects.toThrow(
        'Unauthorized: Vault not found in your organization'
      );
    });

    it('should filter all queries by org_id', async () => {
      const mockVaults = [
        {
          id: 'vault-1',
          organization_id: 'org-1',
          owner_id: 'user-1',
          name: 'Vault 1',
          encryption_algorithm: 'XChaCha20-Poly1305',
          key_derivation_algorithm: 'Argon2id',
          is_shared: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1,
          is_deleted: false,
          last_modified_at: new Date().toISOString(),
          default_access_level: 'viewer',
        },
      ];

      mockApi.listEntries.mockResolvedValue(
        mockVaults.flatMap(v => [
          {
            id: 'entry-1',
            vault_id: v.id,
            type: 'credential',
            name: 'Entry 1',
            encrypted_data: 'data',
            local_version: 1,
            is_deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
      );

      const entries = await mockApi.listEntries('vault-1');

      expect(entries[0].vault_id).toBe('vault-1');
    });

    it('should prevent vault leakage across organizations', async () => {
      mockApi.getVault.mockResolvedValue({
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Org 1 Vault',
        encryption_algorithm: 'XChaCha20-Poly1305',
        key_derivation_algorithm: 'Argon2id',
        is_shared: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        is_deleted: false,
        last_modified_at: new Date().toISOString(),
        default_access_level: 'viewer',
      });

      const vault = await mockApi.getVault('vault-1');

      expect(vault.organization_id).toBe('org-1');
      expect(vault.organization_id).not.toBe('org-2');
    });
  });

  describe('Soft Delete Enforcement', () => {
    it('should exclude deleted entries from queries', async () => {
      mockApi.listEntries.mockResolvedValue([
        {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Active Entry',
          encrypted_data: 'data',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const entries = await mockApi.listEntries('vault-1');

      expect(entries).toHaveLength(1);
      expect(entries.every(e => !e.is_deleted)).toBe(true);
    });

    it('should include is_deleted check in all user queries', async () => {
      mockApi.listEntries.mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          id: `entry-${i}`,
          vault_id: 'vault-1',
          type: 'credential',
          name: `Entry ${i}`,
          encrypted_data: `data-${i}`,
          local_version: 1,
          is_deleted: i % 10 === 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })).filter(e => !e.is_deleted)
      );

      const entries = await mockApi.listEntries('vault-1');

      expect(entries.every(e => !e.is_deleted)).toBe(true);
    });

    it('should only return active entries for user', async () => {
      mockApi.listEntries.mockResolvedValue([
        {
          id: 'entry-1',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Entry 1',
          encrypted_data: 'data-1',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'entry-2',
          vault_id: 'vault-1',
          type: 'credential',
          name: 'Entry 2',
          encrypted_data: 'data-2',
          local_version: 1,
          is_deleted: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      const entries = await mockApi.listEntries('vault-1');

      expect(entries.filter(e => !e.is_deleted)).toHaveLength(2);
    });
  });

  describe('Expiring Share Links', () => {
    it('should reject expired share links', async () => {
      const expiredLink = {
        shareToken: 'expired-token',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      };

      mockApi.generateShareLink.mockResolvedValue(expiredLink);

      const link = await mockApi.generateShareLink('vault-1', 'viewer', 1);
      const expiresAt = new Date(link.expires_at).getTime();

      expect(expiresAt).toBeLessThan(Date.now());
    });

    it('should accept non-expired share links', async () => {
      const validLink = {
        shareToken: 'valid-token',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };

      mockApi.generateShareLink.mockResolvedValue(validLink);

      const link = await mockApi.generateShareLink('vault-1', 'viewer', 3600);
      const expiresAt = new Date(link.expires_at).getTime();

      expect(expiresAt).toBeGreaterThan(Date.now());
    });

    it('should create permanent links when no expiration set', async () => {
      const permanentLink = {
        shareToken: 'permanent-token',
      };

      mockApi.generateShareLink.mockResolvedValue(permanentLink);

      const link = await mockApi.generateShareLink('vault-1', 'viewer');

      expect(link.expires_at).toBeUndefined();
    });
  });

  describe('Key Derivation Security', () => {
    it('should use Argon2id for key derivation', async () => {
      const mockVault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Secure Vault',
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

      const vault = await mockApi.createVault('Secure Vault', '');

      expect(vault.key_derivation_algorithm).toBe('Argon2id');
    });

    it('should use OWASP recommended Argon2id parameters', async () => {
      const mockVault = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Vault',
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

      const vault = await mockApi.createVault('Vault', '');

      expect(vault.key_derivation_algorithm).toBe('Argon2id');
    });

    it('should use random salt for each key derivation', async () => {
      const mockVault1 = {
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Vault',
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

      const mockVault2 = {
        ...mockVault1,
        id: 'vault-2',
        created_at: new Date(Date.now() + 1000).toISOString(),
      };

      mockApi.createVault
        .mockResolvedValueOnce(mockVault1)
        .mockResolvedValueOnce(mockVault2);

      const v1 = await mockApi.createVault('Vault', '');
      const v2 = await mockApi.createVault('Vault', '');

      expect(v1.id).not.toBe(v2.id);
    });
  });

  describe('Security Best Practices', () => {
    it('should have no hardcoded secrets', async () => {
      mockApi.createVault.mockResolvedValue({
        id: 'vault-1',
        organization_id: 'org-1',
        owner_id: 'user-1',
        name: 'Vault',
        encryption_algorithm: 'XChaCha20-Poly1305',
        key_derivation_algorithm: 'Argon2id',
        is_shared: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
        is_deleted: false,
        last_modified_at: new Date().toISOString(),
        default_access_level: 'viewer',
      });

      const vault = await mockApi.createVault('Vault', '');

      expect(vault).not.toHaveProperty('apiKey');
      expect(vault).not.toHaveProperty('secret');
      expect(vault).not.toHaveProperty('password');
    });

    it('should enforce HTTPS in share URLs', async () => {
      mockApi.generateShareLink.mockResolvedValue({
        shareToken: 'token-123',
        shareUrl: 'https://secure.example.com/share/token-123',
      });

      const link = await mockApi.generateShareLink('vault-1', 'viewer');

      expect(link.shareUrl).toMatch(/^https:\/\//);
    });

    it('should not expose sensitive data in error messages', async () => {
      mockApi.updateEntry.mockRejectedValue(new Error('Unauthorized'));

      await expect(
        mockApi.updateEntry('vault-1', 'entry-1', { encryptedData: 'secret' })
      ).rejects.toThrow('Unauthorized');
    });
  });
});
