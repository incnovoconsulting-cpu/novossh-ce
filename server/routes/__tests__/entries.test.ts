import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { entriesRouter, vaultService, shareService, syncService } from '../entries';

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
  app.use('/api/vaults', entriesRouter);

  vi.spyOn(vaultService, 'getVault');
  vi.spyOn(vaultService, 'createEntry');
  vi.spyOn(vaultService, 'listEntries');
  vi.spyOn(vaultService, 'getEntry');
  vi.spyOn(vaultService, 'updateEntry');
  vi.spyOn(vaultService, 'deleteEntry');
  vi.spyOn(shareService, 'checkAccess');
  vi.spyOn(syncService, 'recordChange');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Entries Routes', () => {
  describe('POST /api/vaults/:vaultId/entries - Create entry', () => {
    it('should create entry with valid data', async () => {
      const mockVault = { id: 'vault-1', owner_id: 'user-1', name: 'Test Vault' };
      const mockEntry = { id: 'entry-1', vault_id: 'vault-1', type: 'password', name: 'API Key' };

      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({ hasAccess: true });
      (vaultService.createEntry as any).mockResolvedValueOnce(mockEntry);
      (syncService.recordChange as any).mockResolvedValueOnce({ id: 'change-1' });

      const res = await request(app)
        .post('/api/vaults/vault-1/entries')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1')
        .send({ type: 'password', name: 'API Key', encryptedData: 'enc...' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('entry-1');
    });

    it('should deny access to unauthorized users', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce({ id: 'vault-1', owner_id: 'user-2' });
      (shareService.checkAccess as any).mockResolvedValueOnce({ hasAccess: false });

      const res = await request(app)
        .post('/api/vaults/vault-1/entries')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1')
        .send({ type: 'password', name: 'API Key', encryptedData: 'enc...' });

      expect(res.status).toBe(403);
    });

    it('should return 500 on service error', async () => {
      const mockVault = { id: 'vault-1', owner_id: 'user-1' };
      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({ hasAccess: true });
      (vaultService.createEntry as any).mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .post('/api/vaults/vault-1/entries')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1')
        .send({ type: 'password', name: 'API Key', encryptedData: 'enc...' });

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/vaults/:vaultId/entries - List entries', () => {
    it('should list entries for vault', async () => {
      const mockVault = { id: 'vault-1', owner_id: 'user-1' };
      const mockEntries = [
        { id: 'entry-1', type: 'password', name: 'API Key' },
        { id: 'entry-2', type: 'note', name: 'Todo' },
      ];

      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({ hasAccess: true });
      (vaultService.listEntries as any).mockResolvedValueOnce(mockEntries);

      const res = await request(app)
        .get('/api/vaults/vault-1/entries')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe('entry-1');
    });

    it('should deny access without permissions', async () => {
      const mockVault = { id: 'vault-1', owner_id: 'user-2' };
      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({ hasAccess: false });

      const res = await request(app)
        .get('/api/vaults/vault-1/entries')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/vaults/:vaultId/entries/:entryId - Get entry', () => {
    it('should return 404 when vault not found', async () => {
      (vaultService.getVault as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/vaults/vault-1/entries/entry-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(404);
    });

    it('should return 404 when entry not found', async () => {
      const mockVault = { id: 'vault-1', owner_id: 'user-1' };
      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({ hasAccess: true });
      (vaultService.getEntry as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/vaults/vault-1/entries/entry-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/vaults/:vaultId/entries/:entryId - Update entry', () => {
    it('should update entry successfully', async () => {
      const mockVault = { id: 'vault-1', owner_id: 'user-1' };
      const mockEntry = { id: 'entry-1', vault_id: 'vault-1', type: 'password', name: 'API Key', local_version: 1 };
      const updatedEntry = { ...mockEntry, name: 'Updated Key' };

      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({ hasAccess: true });
      (vaultService.getEntry as any).mockResolvedValueOnce(mockEntry);
      (vaultService.updateEntry as any).mockResolvedValueOnce(updatedEntry);
      (syncService.recordChange as any).mockResolvedValueOnce({ id: 'change-1' });

      const res = await request(app)
        .put('/api/vaults/vault-1/entries/entry-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1')
        .send({ name: 'Updated Key' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Key');
    });

    it('should return 404 when entry not found', async () => {
      const mockVault = { id: 'vault-1', owner_id: 'user-1' };
      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({ hasAccess: true });
      (vaultService.getEntry as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/vaults/vault-1/entries/entry-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1')
        .send({ name: 'Updated Key' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/vaults/:vaultId/entries/:entryId - Delete entry', () => {
    it('should delete entry successfully', async () => {
      const mockVault = { id: 'vault-1', owner_id: 'user-1' };
      const mockEntry = { id: 'entry-1', vault_id: 'vault-1', type: 'password', local_version: 1 };

      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({ hasAccess: true });
      (vaultService.getEntry as any).mockResolvedValueOnce(mockEntry);
      (vaultService.deleteEntry as any).mockResolvedValueOnce(undefined);
      (syncService.recordChange as any).mockResolvedValueOnce({ id: 'change-1' });

      const res = await request(app)
        .delete('/api/vaults/vault-1/entries/entry-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1');

      expect(res.status).toBe(204);
    });

    it('should return 404 when entry not found', async () => {
      const mockVault = { id: 'vault-1', owner_id: 'user-1' };
      (vaultService.getVault as any).mockResolvedValueOnce(mockVault);
      (shareService.checkAccess as any).mockResolvedValueOnce({ hasAccess: true });
      (vaultService.getEntry as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .delete('/api/vaults/vault-1/entries/entry-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .set('x-device-id', 'device-1');

      expect(res.status).toBe(404);
    });
  });
});
