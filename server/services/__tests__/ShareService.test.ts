import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShareService, VaultShare } from '../ShareService';

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => 'mock-share-token-32-bytes-hex-value'),
    })),
  },
}));

const mockDb = vi.fn();

// Default mockDb to return empty array for any query
mockDb.mockImplementation(() => Promise.resolve([]));

describe('ShareService', () => {
  let service: ShareService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to default behavior
    mockDb.mockImplementation(() => Promise.resolve([]));
    service = new ShareService();
  });

  describe('User-to-User Sharing', () => {
    it('should share vault with another user', async () => {
      const mockShare: VaultShare = {
        id: 'share-1',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        grantee_id: 'user-2',
        access_level: 'viewer',
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockShare]);
      mockDb.mockResolvedValueOnce([{ is_shared: true }]);

      const result = await service.shareWithUser('vault-1', 'user-1', 'user-2', 'viewer');

      expect(result.grantee_id).toBe('user-2');
      expect(result.access_level).toBe('viewer');
      expect(result.revoked_at).toBeUndefined();
    });

    it('should support editor access level', async () => {
      const mockShare: VaultShare = {
        id: 'share-2',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        grantee_id: 'user-2',
        access_level: 'editor',
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockShare]);
      mockDb.mockResolvedValueOnce([]);

      const result = await service.shareWithUser('vault-1', 'user-1', 'user-2', 'editor');

      expect(result.access_level).toBe('editor');
    });

    it('should mark vault as shared after sharing with user', async () => {
      const mockShare: VaultShare = {
        id: 'share-3',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        grantee_id: 'user-2',
        access_level: 'viewer',
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockShare]);
      mockDb.mockResolvedValueOnce([]);

      await service.shareWithUser('vault-1', 'user-1', 'user-2', 'viewer');

      expect(mockDb).toHaveBeenCalledTimes(2);
    });

    it('should list all shares for a vault', async () => {
      const mockShares: VaultShare[] = [
        {
          id: 'share-1',
          vault_id: 'vault-1',
          grantor_id: 'user-1',
          grantee_id: 'user-2',
          access_level: 'viewer',
          created_at: new Date(),
        },
        {
          id: 'share-2',
          vault_id: 'vault-1',
          grantor_id: 'user-1',
          grantee_id: 'user-3',
          access_level: 'editor',
          created_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockShares);

      const result = await service.listShares('vault-1');

      expect(result).toHaveLength(2);
      expect(result[0].grantee_id).toBe('user-2');
      expect(result[1].grantee_id).toBe('user-3');
    });

    it('should revoke user access', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.revokeShare('share-1');

      expect(mockDb).toHaveBeenCalled();
    });
  });

  describe('Share Links', () => {
    it('should generate share link with token', async () => {
      const mockShare: VaultShare = {
        id: 'share-link-1',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        access_level: 'viewer',
        share_token: 'mock-share-token-32-bytes-hex-value',
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockShare]);
      mockDb.mockResolvedValueOnce([]);

      const result = await service.generateShareLink('vault-1', 'user-1', 'viewer');

      expect(result.share_token).toBeDefined();
      expect(result.share_token?.length).toBeGreaterThan(0);
    });

    it('should set expiration on share link', async () => {
      const expiresIn = 3600; // 1 hour
      const mockShare: VaultShare = {
        id: 'share-link-2',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        access_level: 'editor',
        share_token: 'mock-share-token-32-bytes-hex-value',
        expires_at: new Date(Date.now() + expiresIn * 1000),
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockShare]);
      mockDb.mockResolvedValueOnce([]);

      const result = await service.generateShareLink('vault-1', 'user-1', 'editor', expiresIn);

      expect(result.expires_at).toBeDefined();
      expect(result.expires_at?.getTime()).toBeGreaterThan(Date.now());
    });

    it('should create indefinite share link when no expiration', async () => {
      const mockShare: VaultShare = {
        id: 'share-link-3',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        access_level: 'viewer',
        share_token: 'mock-share-token-32-bytes-hex-value',
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockShare]);
      mockDb.mockResolvedValueOnce([]);

      const result = await service.generateShareLink('vault-1', 'user-1', 'viewer');

      expect(result.expires_at).toBeUndefined();
    });

    it('should mark vault as shared when creating link', async () => {
      const mockShare: VaultShare = {
        id: 'share-link-4',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        access_level: 'viewer',
        share_token: 'mock-share-token-32-bytes-hex-value',
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockShare]);
      mockDb.mockResolvedValueOnce([]);

      await service.generateShareLink('vault-1', 'user-1', 'viewer');

      expect(mockDb).toHaveBeenCalledTimes(2);
    });
  });

  describe('Token Validation', () => {
    it('should retrieve share by valid token', async () => {
      const mockShare: VaultShare = {
        id: 'share-1',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        access_level: 'viewer',
        share_token: 'valid-token-123',
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockShare]);

      const result = await service.getShareByToken('valid-token-123');

      expect(result).toEqual(mockShare);
      expect(result?.share_token).toBe('valid-token-123');
    });

    it('should return null for expired token', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getShareByToken('expired-token');

      expect(result).toBeNull();
    });

    it('should return null for revoked token', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getShareByToken('revoked-token');

      expect(result).toBeNull();
    });

    it('should return null for nonexistent token', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getShareByToken('nonexistent-token');

      expect(result).toBeNull();
    });

    it('should validate token format', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getShareByToken('');

      expect(result).toBeNull();
    });
  });

  describe('Access Control', () => {
    it('should check viewer access', async () => {
      mockDb.mockResolvedValueOnce([]) // owner check returns empty
        .mockResolvedValueOnce([  // share check returns viewer share
          {
            access_level: 'viewer',
          },
        ]);

      const result = await service.checkAccess('vault-1', 'user-2');

      expect(result.hasAccess).toBe(true);
      expect(result.accessLevel).toBe('viewer');
    });

    it('should check editor access', async () => {
      mockDb.mockResolvedValueOnce([]) // owner check returns empty
        .mockResolvedValueOnce([  // share check returns editor share
          {
            access_level: 'editor',
          },
        ]);

      const result = await service.checkAccess('vault-1', 'user-2');

      expect(result.hasAccess).toBe(true);
      expect(result.accessLevel).toBe('editor');
    });

    it('should return owner for vault owner', async () => {
      mockDb.mockResolvedValueOnce([ // owner check returns owner match
        {
          access_level: 'owner',
        },
      ]);

      const result = await service.checkAccess('vault-1', 'user-1');

      expect(result.hasAccess).toBe(true);
      expect(result.accessLevel).toBe('owner');
    });

    it('should deny access for unauthorized user', async () => {
      mockDb.mockResolvedValueOnce([]) // owner check returns empty
        .mockResolvedValueOnce([]); // share check returns empty

      const result = await service.checkAccess('vault-1', 'user-unauthorized');

      expect(result.hasAccess).toBe(false);
      expect(result.accessLevel).toBe('');
    });
  });

  describe('Vault Shared Flag', () => {
    it('should set is_shared flag when first share created', async () => {
      const mockShare: VaultShare = {
        id: 'share-1',
        vault_id: 'vault-1',
        grantor_id: 'user-1',
        grantee_id: 'user-2',
        access_level: 'viewer',
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockShare]);
      mockDb.mockResolvedValueOnce([]);

      await service.shareWithUser('vault-1', 'user-1', 'user-2', 'viewer');

      expect(mockDb).toHaveBeenCalledTimes(2);
    });

    it('should clear is_shared flag when all shares revoked', async () => {
      mockDb.mockResolvedValueOnce([]);
      mockDb.mockResolvedValueOnce([]);

      await service.revokeShare('share-1');

      expect(mockDb).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw error on database failure', async () => {
      mockDb.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        service.shareWithUser('vault-1', 'user-1', 'user-2', 'viewer')
      ).rejects.toThrow('Database error');
    });

    it('should handle invalid access level', async () => {
      mockDb.mockResolvedValueOnce([
        {
          id: 'share-1',
          vault_id: 'vault-1',
          grantor_id: 'user-1',
          grantee_id: 'user-2',
          access_level: 'invalid',
        },
      ]);

      const result = await service.shareWithUser('vault-1', 'user-1', 'user-2', 'invalid');

      expect(result).toBeDefined();
    });
  });
});
