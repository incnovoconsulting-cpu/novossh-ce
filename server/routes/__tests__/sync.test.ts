import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { syncRouter, vaultService, syncService, shareService } from '../sync';

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
  app.use('/api/vaults', syncRouter);

  vi.spyOn(vaultService, 'getVault');
  vi.spyOn(vaultService, 'getEntry');
  vi.spyOn(syncService, 'getChanges');
  vi.spyOn(syncService, 'getSyncStats');
  vi.spyOn(syncService, 'recordChange');
  vi.spyOn(syncService, 'detectConflicts');
  vi.spyOn(syncService, 'markSynced');
  vi.spyOn(syncService, 'resolveConflict');
  vi.spyOn(shareService, 'checkAccess');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Sync Routes', () => {
  describe('GET /api/vaults/:vaultId/sync', () => {
    it('should get sync state for vault owner', async () => {
      const mockVault = {
        id: 'vault-1',
        owner_id: 'user-1',
        last_modified_at: new Date(),
      };
      const mockChanges = [{ id: 'change-1', operation: 'create', entryId: 'entry-1' }];
      const mockStats = {
        totalConflicts: 0,
        pendingChanges: 1,
        lastSync: new Date(),
      };

      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({
        hasAccess: true,
      });
      (syncService.getChanges as any).mockResolvedValueOnce(mockChanges);
      (syncService.getSyncStats as any).mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/vaults/vault-1/sync')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1');

      expect(response.status).toBe(200);
      expect(response.body.pendingChanges).toEqual(mockChanges);
      expect(response.body.conflicts).toBe(0);
    });

    it('should return 404 when vault not found', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/vaults/vault-1/sync')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Vault not found');
    });

    it('should return 500 on service error', async () => {
      (vaultService.getVault as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/vaults/vault-1/sync')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get sync state');
    });
  });

  describe('POST /api/vaults/:vaultId/sync', () => {
    it('should push changes successfully', async () => {
      const mockVault = {
        id: 'vault-1',
        owner_id: 'user-1',
        last_modified_at: new Date(),
      };

      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({
        hasAccess: true,
      });
      (syncService.recordChange as any).mockResolvedValueOnce(undefined);
      (syncService.detectConflicts as any).mockResolvedValueOnce([]);
      (syncService.markSynced as any).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/vaults/vault-1/sync')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1')
        .send({
          changes: [
            { operation: 'create', entryId: 'entry-1', newVersion: { name: 'test' } },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.appliedChanges).toHaveLength(1);
      expect(response.body.conflicts).toEqual([]);
    });

    it('should return 500 on service error', async () => {
      (vaultService.getVault as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/vaults/vault-1/sync')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1')
        .send({ changes: [] });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to push changes');
    });
  });

  describe('POST /api/vaults/:vaultId/sync/resolve', () => {
    it('should resolve conflict successfully', async () => {
      const mockVault = {
        id: 'vault-1',
        owner_id: 'user-1',
      };
      const mockEntry = {
        id: 'entry-1',
        name: 'resolved entry',
        vault_id: 'vault-1',
      };

      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({
        hasAccess: true,
      });
      (syncService.resolveConflict as any).mockResolvedValueOnce(undefined);
      (vaultService.getEntry as any).mockResolvedValueOnce(mockEntry);

      const response = await request(app)
        .post('/api/vaults/vault-1/sync/resolve')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1')
        .send({
          entryId: 'entry-1',
          resolution: 'local',
          winningData: 'encrypted-payload',
        });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('entry-1');
      expect(response.body.name).toBe('resolved entry');
    });

    it('should return 500 on service error', async () => {
      const mockVault = {
        id: 'vault-1',
        owner_id: 'user-1',
      };

      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({
        hasAccess: true,
      });
      (syncService.resolveConflict as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/vaults/vault-1/sync/resolve')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1')
        .send({
          entryId: 'entry-1',
          resolution: 'local',
          winningData: 'encrypted-payload',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to resolve conflict');
    });
  });
});
