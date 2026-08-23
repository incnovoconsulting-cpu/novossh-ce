import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../services/ConnectionMetadataService.js', () => ({
  connectionMetadataService: {
    getConnectionMetadata: vi.fn().mockResolvedValue(null),
    getConnectionHints: vi.fn().mockResolvedValue(null),
    getRecentConnectionStats: vi.fn().mockResolvedValue(null),
    recordConnectionAttempt: vi.fn().mockResolvedValue(undefined),
    recordDirectConnectionSuccess: vi.fn().mockResolvedValue(undefined),
    recordDirectConnectionFailure: vi.fn().mockResolvedValue(undefined),
    updateConnectionMetadata: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../routes/vaults.js', () => ({
  vaultService: {
    getEntry: vi.fn().mockResolvedValue(null),
    getVault: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../routes/entries.js', () => ({
  shareService: {
    checkAccess: vi.fn().mockResolvedValue({ hasAccess: false, accessLevel: 'viewer' }),
  },
}));

vi.mock('../middleware/auth.js', () => ({
  optionalAuthMiddleware: vi.fn((req: any, _res: any, next: any) => {
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      req.user = {
        id: 'user-1',
        organizationId: 'org-1',
        deviceId: 'device-1',
      };
    }
    next();
  }),
}));

import { connectionsRouter } from '../routes/connections.js';
import { connectionMetadataService } from '../services/ConnectionMetadataService.js';

const vaultService = (await import('../routes/vaults.js')).vaultService;
const shareService = (await import('../routes/entries.js')).shareService;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/connections', connectionsRouter);
  return app;
}

describe('Connections Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  describe('GET /api/connections/:entryId', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/connections/entry-1');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('returns 404 when entry not found', async () => {
      (vaultService.getEntry as any).mockResolvedValue(null);
      const res = await request(app)
        .get('/api/connections/entry-1')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entry not found');
    });

    it('returns 403 when user lacks access', async () => {
      (vaultService.getEntry as any).mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
      });
      (vaultService.getVault as any).mockResolvedValue({
        id: 'vault-1',
        owner_id: 'other-user',
      });
      (shareService.checkAccess as any).mockResolvedValue({
        hasAccess: false,
        accessLevel: 'viewer',
      });

      const res = await request(app)
        .get('/api/connections/entry-1')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');
    });

    it('returns connection metadata when user is owner', async () => {
      (vaultService.getEntry as any).mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
      });
      (vaultService.getVault as any).mockResolvedValue({
        id: 'vault-1',
        owner_id: 'user-1',
      });
      (connectionMetadataService.getConnectionMetadata as any).mockResolvedValue({
        clientType: 'web',
        connectionMode: 'relay',
      });
      (connectionMetadataService.getConnectionHints as any).mockResolvedValue({
        isPrivateIp: true,
        recommendedMode: 'relay',
      });
      (connectionMetadataService.getRecentConnectionStats as any).mockResolvedValue({
        total_attempts: 5,
        successful_attempts: 3,
      });

      const res = await request(app)
        .get('/api/connections/entry-1')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.metadata).toEqual({
        clientType: 'web',
        connectionMode: 'relay',
      });
      expect(res.body.hints).toEqual({
        isPrivateIp: true,
        recommendedMode: 'relay',
      });
      expect(res.body.stats).toEqual({
        total_attempts: 5,
        successful_attempts: 3,
      });
    });

    it('returns connection metadata when user has shared access', async () => {
      (vaultService.getEntry as any).mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
      });
      (vaultService.getVault as any).mockResolvedValue({
        id: 'vault-1',
        owner_id: 'other-user',
      });
      (shareService.checkAccess as any).mockResolvedValue({
        hasAccess: true,
        accessLevel: 'editor',
      });
      (connectionMetadataService.getConnectionMetadata as any).mockResolvedValue(null);
      (connectionMetadataService.getConnectionHints as any).mockResolvedValue(null);
      (connectionMetadataService.getRecentConnectionStats as any).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/connections/entry-1')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(200);
      expect(res.body.metadata).toEqual({});
    });

    it('returns 500 on server error', async () => {
      (vaultService.getEntry as any).mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .get('/api/connections/entry-1')
        .set('Authorization', 'Bearer token');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to get connection metadata');
    });
  });

  describe('POST /api/connections/:entryId/attempt', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/connections/entry-1/attempt')
        .send({ connectionType: 'direct', targetHost: '8.8.8.8', targetPort: 22 });
      expect(res.status).toBe(401);
    });

    it('returns 400 when missing required fields', async () => {
      const res = await request(app)
        .post('/api/connections/entry-1/attempt')
        .set('Authorization', 'Bearer token')
        .send({ connectionType: 'direct' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing required fields');
    });

    it('returns 400 for invalid port (over 65535)', async () => {
      const res = await request(app)
        .post('/api/connections/entry-1/attempt')
        .set('Authorization', 'Bearer token')
        .send({
          connectionType: 'direct',
          targetHost: '8.8.8.8',
          targetPort: 99999,
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid port number');
    });

    it('returns 400 for port 0', async () => {
      const res = await request(app)
        .post('/api/connections/entry-1/attempt')
        .set('Authorization', 'Bearer token')
        .send({
          connectionType: 'direct',
          targetHost: '8.8.8.8',
          targetPort: 0,
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 for negative port', async () => {
      const res = await request(app)
        .post('/api/connections/entry-1/attempt')
        .set('Authorization', 'Bearer token')
        .send({
          connectionType: 'direct',
          targetHost: '8.8.8.8',
          targetPort: -1,
        });
      expect(res.status).toBe(400);
    });

    it('returns 404 when entry not found', async () => {
      (vaultService.getEntry as any).mockResolvedValue(null);
      const res = await request(app)
        .post('/api/connections/entry-1/attempt')
        .set('Authorization', 'Bearer token')
        .send({
          connectionType: 'direct',
          targetHost: '8.8.8.8',
          targetPort: 22,
        });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Entry not found');
    });

    it('records successful direct connection attempt', async () => {
      (vaultService.getEntry as any).mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
      });
      const res = await request(app)
        .post('/api/connections/entry-1/attempt')
        .set('Authorization', 'Bearer token')
        .send({
          connectionType: 'direct',
          targetHost: '8.8.8.8',
          targetPort: 22,
          success: true,
          durationMs: 1500,
        });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(connectionMetadataService.recordConnectionAttempt).toHaveBeenCalledWith(
        'entry-1',
        'user-1',
        'device-1',
        'direct',
        '8.8.8.8',
        22,
        true,
        undefined,
        undefined,
        undefined,
        1500,
      );
      expect(connectionMetadataService.recordDirectConnectionSuccess).toHaveBeenCalledWith('entry-1');
    });

    it('records failed direct connection attempt', async () => {
      (vaultService.getEntry as any).mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
      });
      const res = await request(app)
        .post('/api/connections/entry-1/attempt')
        .set('Authorization', 'Bearer token')
        .send({
          connectionType: 'direct',
          targetHost: '192.168.1.1',
          targetPort: 22,
          success: false,
          errorMessage: 'Connection refused',
          fallbackUsed: true,
          fallbackType: 'relay',
          durationMs: 5000,
        });
      expect(res.status).toBe(200);
      expect(connectionMetadataService.recordDirectConnectionFailure).toHaveBeenCalledWith('entry-1');
    });

    it('does not record success/failure stats for non-direct connections', async () => {
      (vaultService.getEntry as any).mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
      });
      await request(app)
        .post('/api/connections/entry-1/attempt')
        .set('Authorization', 'Bearer token')
        .send({
          connectionType: 'relay',
          targetHost: '8.8.8.8',
          targetPort: 22,
          success: true,
        });
      expect(connectionMetadataService.recordDirectConnectionSuccess).not.toHaveBeenCalled();
      expect(connectionMetadataService.recordDirectConnectionFailure).not.toHaveBeenCalled();
    });

    it('returns 500 on server error', async () => {
      (vaultService.getEntry as any).mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .post('/api/connections/entry-1/attempt')
        .set('Authorization', 'Bearer token')
        .send({
          connectionType: 'direct',
          targetHost: '8.8.8.8',
          targetPort: 22,
        });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to record connection attempt');
    });
  });

  describe('PUT /api/connections/:entryId/metadata', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .put('/api/connections/entry-1/metadata')
        .send({ connectionMode: 'direct' });
      expect(res.status).toBe(401);
    });

    it('returns 404 when entry not found', async () => {
      (vaultService.getEntry as any).mockResolvedValue(null);
      const res = await request(app)
        .put('/api/connections/entry-1/metadata')
        .set('Authorization', 'Bearer token')
        .send({ connectionMode: 'direct' });
      expect(res.status).toBe(404);
    });

    it('returns 403 when user lacks access entirely', async () => {
      (vaultService.getEntry as any).mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
      });
      (vaultService.getVault as any).mockResolvedValue({
        id: 'vault-1',
        owner_id: 'other-user',
      });
      (shareService.checkAccess as any).mockResolvedValue({
        hasAccess: false,
        accessLevel: 'viewer',
      });

      const res = await request(app)
        .put('/api/connections/entry-1/metadata')
        .set('Authorization', 'Bearer token')
        .send({ connectionMode: 'direct' });
      expect(res.status).toBe(403);
    });

    it('allows owner to update metadata', async () => {
      (vaultService.getEntry as any).mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
      });
      (vaultService.getVault as any).mockResolvedValue({
        id: 'vault-1',
        owner_id: 'user-1',
      });

      const res = await request(app)
        .put('/api/connections/entry-1/metadata')
        .set('Authorization', 'Bearer token')
        .send({ connectionMode: 'direct', requiresRelay: false });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(connectionMetadataService.updateConnectionMetadata).toHaveBeenCalledWith('entry-1', {
        connectionMode: 'direct',
        requiresRelay: false,
      });
    });

    it('allows editor to update metadata', async () => {
      (vaultService.getEntry as any).mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
      });
      (vaultService.getVault as any).mockResolvedValue({
        id: 'vault-1',
        owner_id: 'other-user',
      });
      (shareService.checkAccess as any).mockResolvedValue({
        hasAccess: true,
        accessLevel: 'editor',
      });

      const res = await request(app)
        .put('/api/connections/entry-1/metadata')
        .set('Authorization', 'Bearer token')
        .send({ connectionMode: 'relay', requiresRelay: true });
      expect(res.status).toBe(200);
    });

    it('defaults connectionMode to relay when not provided', async () => {
      (vaultService.getEntry as any).mockResolvedValue({
        id: 'entry-1',
        vault_id: 'vault-1',
      });
      (vaultService.getVault as any).mockResolvedValue({
        id: 'vault-1',
        owner_id: 'user-1',
      });

      await request(app)
        .put('/api/connections/entry-1/metadata')
        .set('Authorization', 'Bearer token')
        .send({});
      expect(connectionMetadataService.updateConnectionMetadata).toHaveBeenCalledWith('entry-1', {
        connectionMode: 'relay',
        requiresRelay: true,
      });
    });

    it('returns 500 on server error', async () => {
      (vaultService.getEntry as any).mockRejectedValue(new Error('DB error'));
      const res = await request(app)
        .put('/api/connections/entry-1/metadata')
        .set('Authorization', 'Bearer token')
        .send({ connectionMode: 'direct' });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update connection metadata');
    });
  });
});
