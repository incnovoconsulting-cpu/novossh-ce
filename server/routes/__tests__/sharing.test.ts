import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { sharingRouter, vaultService, shareService } from '../sharing';

let app: express.Application;

beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const userId = req.headers['x-user-id'] as string;
    const orgId = req.headers['x-org-id'] as string;
    if (userId) {
      req.user = { id: userId, organizationId: orgId || 'org-1' };
    }
    next();
  });
  app.use('/api/vaults', sharingRouter);

  vi.spyOn(vaultService, 'getVault');
  vi.spyOn(shareService, 'shareWithUser');
  vi.spyOn(shareService, 'listShares');
  vi.spyOn(shareService, 'revokeShare');
  vi.spyOn(shareService, 'generateShareLink');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Sharing Routes', () => {
  describe('POST /:vaultId/shares - Share vault with user', () => {
    it('should share vault with viewer access', async () => {
      const mockShare = {
        id: 'share-1',
        vaultId: 'vault-1',
        userId: 'user-2',
        accessLevel: 'viewer',
      };

      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-1',
      });
      (shareService.shareWithUser as any).mockResolvedValueOnce(mockShare);

      const res = await request(app)
        .post('/api/vaults/vault-1/shares')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          userId: 'user-2',
          accessLevel: 'viewer',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('share-1');
      expect(res.body.accessLevel).toBe('viewer');
    });

    it('should deny share if user is not vault owner', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-2',
      });

      const res = await request(app)
        .post('/api/vaults/vault-1/shares')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          userId: 'user-3',
          accessLevel: 'viewer',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only owner can share vault');
    });

    it('should return 404 when vault not found', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/vaults/vault-1/shares')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          userId: 'user-2',
          accessLevel: 'viewer',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vault not found');
    });

    it('should reject invalid access level', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-1',
      });

      const res = await request(app)
        .post('/api/vaults/vault-1/shares')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          userId: 'user-2',
          accessLevel: 'admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid access level');
    });
  });

  describe('GET /:vaultId/shares - List vault shares', () => {
    it('should list all vault shares for vault owner', async () => {
      const mockShares = [
        { id: 'share-1', userId: 'user-2', accessLevel: 'viewer' },
        { id: 'share-2', userId: 'user-3', accessLevel: 'editor' },
      ];

      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-1',
      });
      (shareService.listShares as any).mockResolvedValueOnce(mockShares);

      const res = await request(app)
        .get('/api/vaults/vault-1/shares')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe('share-1');
    });

    it('should deny listing shares if user is not vault owner', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-2',
      });

      const res = await request(app)
        .get('/api/vaults/vault-1/shares')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only owner can list shares');
    });

    it('should return 404 when vault not found', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/vaults/vault-1/shares')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vault not found');
    });

    it('should return empty array when no shares exist', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-1',
      });
      (shareService.listShares as any).mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/vaults/vault-1/shares')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('DELETE /:vaultId/shares/:shareId - Revoke share', () => {
    it('should revoke share for vault owner', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-1',
      });
      (shareService.revokeShare as any).mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete('/api/vaults/vault-1/shares/share-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(204);
    });

    it('should deny revoke if user is not vault owner', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-2',
      });

      const res = await request(app)
        .delete('/api/vaults/vault-1/shares/share-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only owner can revoke shares');
    });

    it('should return 404 when vault not found', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .delete('/api/vaults/vault-1/shares/share-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vault not found');
    });
  });

  describe('POST /:vaultId/shares/generate-link - Generate share link', () => {
    it('should generate share link with viewer access', async () => {
      const mockShare = {
        share_token: 'token-123',
        expires_at: '2024-06-30T00:00:00Z',
      };

      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-1',
      });
      (shareService.generateShareLink as any).mockResolvedValueOnce(mockShare);

      const res = await request(app)
        .post('/api/vaults/vault-1/shares/generate-link')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          accessLevel: 'viewer',
        });

      expect(res.status).toBe(201);
      expect(res.body.shareToken).toBe('token-123');
      expect(res.body.shareUrl).toContain('/vault/join/token-123');
    });

    it('should deny link generation if user is not vault owner', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-2',
      });

      const res = await request(app)
        .post('/api/vaults/vault-1/shares/generate-link')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          accessLevel: 'viewer',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Only owner can generate share links');
    });

    it('should return 404 when vault not found', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/vaults/vault-1/shares/generate-link')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          accessLevel: 'viewer',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vault not found');
    });

    it('should reject request with missing accessLevel', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-1',
      });

      const res = await request(app)
        .post('/api/vaults/vault-1/shares/generate-link')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing accessLevel');
    });

    it('should include shareUrl in response', async () => {
      const mockShare = {
        share_token: 'token-abc',
        expires_at: '2024-07-30T00:00:00Z',
      };

      (vaultService.getVault as any).mockResolvedValueOnce({
        id: 'vault-1',
        owner_id: 'user-1',
      });
      (shareService.generateShareLink as any).mockResolvedValueOnce(mockShare);

      const res = await request(app)
        .post('/api/vaults/vault-1/shares/generate-link')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          accessLevel: 'editor',
        });

      expect(res.status).toBe(201);
      expect(res.body.shareUrl).toBeDefined();
      expect(res.body.expiresAt).toBe('2024-07-30T00:00:00Z');
    });
  });
});
