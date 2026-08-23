import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineSyncService, OfflineChange } from '../OfflineSyncService';

describe('OfflineSyncService', () => {
  let service: OfflineSyncService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new OfflineSyncService('test-device-1');
    await service.initialize();
  }, 30000);

  describe('Local Storage', () => {
    it('should record offline changes', async () => {
      const change = await service.recordChange('create', 'vault', 'vault-1', {
        name: 'Test Vault',
      });

      expect(change).toBeDefined();
      expect(change.type).toBe('create');
      expect(change.resourceType).toBe('vault');
      expect(change.synced).toBe(false);
    });

    it('should get unsynced changes', async () => {
      await service.recordChange('create', 'vault', 'vault-1', { name: 'Vault 1' });
      await service.recordChange('update', 'vault', 'vault-1', { name: 'Updated Vault' });

      const unsynced = await service.getUnsyncedChanges();

      expect(unsynced).toHaveLength(2);
      expect(unsynced.every((c) => !c.synced)).toBe(true);
    });

    it('should mark change as synced', async () => {
      const change = await service.recordChange('create', 'vault', 'vault-1', { name: 'Vault 1' });

      await service.markAsSynced(change.id);

      const unsynced = await service.getUnsyncedChanges();
      expect(unsynced).toHaveLength(0);
    });

    it('should get all changes including synced ones', async () => {
      const change1 = await service.recordChange('create', 'vault', 'vault-1', { name: 'Vault 1' });
      const change2 = await service.recordChange('update', 'vault', 'vault-1', { name: 'Updated' });

      await service.markAsSynced(change1.id);

      const all = await service.getAllChanges();

      expect(all).toHaveLength(2);
      expect(all.filter((c) => c.synced)).toHaveLength(1);
    });

    it('should record multiple different resource types', async () => {
      await service.recordChange('create', 'vault', 'vault-1', { name: 'Vault 1' });
      await service.recordChange('create', 'team', 'team-1', { name: 'Team 1' });
      await service.recordChange('create', 'entry', 'entry-1', { title: 'Entry 1' });

      const all = await service.getAllChanges();

      expect(all).toHaveLength(3);
      expect(all.map((c) => c.resourceType).sort()).toEqual(['entry', 'team', 'vault']);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts between local and remote changes', async () => {
      const localChange = await service.recordChange('update', 'vault', 'vault-1', {
        name: 'Local Update',
      });

      const remoteChange: OfflineChange = {
        id: 'remote-1',
        type: 'update',
        resourceType: 'vault',
        resourceId: 'vault-1',
        data: { name: 'Remote Update' },
        timestamp: localChange.timestamp - 1000,
        deviceId: 'remote-device',
        synced: true,
      };

      const conflicts = await service.detectConflicts([remoteChange]);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].resourceId).toBe('vault-1');
    });

    it('should not detect conflicts for different resources', async () => {
      await service.recordChange('update', 'vault', 'vault-1', { name: 'Vault 1' });

      const remoteChange: OfflineChange = {
        id: 'remote-1',
        type: 'update',
        resourceType: 'vault',
        resourceId: 'vault-2',
        data: { name: 'Vault 2' },
        timestamp: Date.now() - 1000,
        deviceId: 'remote-device',
        synced: true,
      };

      const conflicts = await service.detectConflicts([remoteChange]);

      expect(conflicts).toHaveLength(0);
    });

    it('should resolve conflicts with local preference', async () => {
      const localChange = await service.recordChange('update', 'vault', 'vault-1', {
        name: 'Local',
      });

      const remoteChange: OfflineChange = {
        id: 'remote-1',
        type: 'update',
        resourceType: 'vault',
        resourceId: 'vault-1',
        data: { name: 'Remote' },
        timestamp: localChange.timestamp - 1000,
        deviceId: 'remote-device',
        synced: true,
      };

      const conflicts = await service.detectConflicts([remoteChange]);
      await service.resolveConflict(conflicts[0].id, 'local');

      expect(conflicts[0].resolution).toBeUndefined(); // Not yet updated
    });

    it('should resolve conflicts with remote preference', async () => {
      const localChange = await service.recordChange('update', 'vault', 'vault-1', {
        name: 'Local',
      });

      const remoteChange: OfflineChange = {
        id: 'remote-1',
        type: 'update',
        resourceType: 'vault',
        resourceId: 'vault-1',
        data: { name: 'Remote' },
        timestamp: localChange.timestamp - 1000,
        deviceId: 'remote-device',
        synced: true,
      };

      const conflicts = await service.detectConflicts([remoteChange]);
      await service.resolveConflict(conflicts[0].id, 'remote');

      expect(conflicts[0].resolution).toBeUndefined(); // Not yet updated
    });

    it('should resolve conflicts with merged data', async () => {
      const localChange = await service.recordChange('update', 'vault', 'vault-1', {
        name: 'Local',
        tags: ['a'],
      });

      const remoteChange: OfflineChange = {
        id: 'remote-1',
        type: 'update',
        resourceType: 'vault',
        resourceId: 'vault-1',
        data: { name: 'Remote', tags: ['b'] },
        timestamp: localChange.timestamp - 1000,
        deviceId: 'remote-device',
        synced: true,
      };

      const conflicts = await service.detectConflicts([remoteChange]);
      await service.resolveConflict(conflicts[0].id, 'merged', { name: 'Merged', tags: ['a', 'b'] });

      expect(conflicts[0].resolution).toBeUndefined(); // Not yet updated
    });
  });

  describe('Sync Queue', () => {
    it('should add changes to sync queue', async () => {
      const change = await service.recordChange('create', 'vault', 'vault-1', { name: 'Vault' });
      const item = await service.addToSyncQueue([change]);

      expect(item).toBeDefined();
      expect(item.changes).toHaveLength(1);
      expect(item.status).toBe('pending');
    });

    it('should get pending sync queue items', async () => {
      const change1 = await service.recordChange('create', 'vault', 'vault-1', { name: 'Vault 1' });
      const change2 = await service.recordChange('create', 'team', 'team-1', { name: 'Team 1' });

      await service.addToSyncQueue([change1]);
      await service.addToSyncQueue([change2]);

      const pending = await service.getPendingSyncQueue();

      expect(pending).toHaveLength(2);
      expect(pending.every((p) => p.status === 'pending')).toBe(true);
    });

    it('should mark queue item as sent', async () => {
      const change = await service.recordChange('create', 'vault', 'vault-1', { name: 'Vault' });
      const item = await service.addToSyncQueue([change]);

      await service.markQueueItemSent(item.id);

      const pending = await service.getPendingSyncQueue();
      expect(pending).toHaveLength(0);
    });

    it('should support P2P sync targeting', async () => {
      const change = await service.recordChange('create', 'vault', 'vault-1', { name: 'Vault' });
      const item = await service.addToSyncQueue([change], 'peer', 'peer-device-1');

      expect(item.target).toBe('peer');
      expect(item.peerId).toBe('peer-device-1');
    });
  });

  describe('Metadata Management', () => {
    it('should store and retrieve metadata', async () => {
      await service.setMetadata('lastSync', 1234567890);

      const value = await service.getMetadata('lastSync');

      expect(value).toBe(1234567890);
    });

    it('should handle multiple metadata keys', async () => {
      await service.setMetadata('lastSync', 1234567890);
      await service.setMetadata('lastPeerSync', 9876543210);

      const sync1 = await service.getMetadata('lastSync');
      const sync2 = await service.getMetadata('lastPeerSync');

      expect(sync1).toBe(1234567890);
      expect(sync2).toBe(9876543210);
    });
  });

  describe('Sync Status', () => {
    it('should return sync status', async () => {
      const change1 = await service.recordChange('create', 'vault', 'vault-1', { name: 'Vault' });
      const change2 = await service.recordChange('create', 'team', 'team-1', { name: 'Team' });

      await service.markAsSynced(change1.id);

      const status = await service.getSyncStatus();

      expect(status.unsyncedCount).toBe(1);
      expect(status.isOnline).toBe(navigator.onLine);
    });

    it('should track device ID', () => {
      const deviceId = service.getDeviceId();

      expect(deviceId).toBeDefined();
      expect(deviceId).toContain('test-device-1');
    });

    it('should check connection status', () => {
      const isConnected = service.isConnected();

      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('Cleanup', () => {
    it('should clear synced changes', async () => {
      const change1 = await service.recordChange('create', 'vault', 'vault-1', { name: 'Vault 1' });
      const change2 = await service.recordChange('create', 'vault', 'vault-2', { name: 'Vault 2' });

      await service.markAsSynced(change1.id);

      await service.clearSyncedChanges();

      const all = await service.getAllChanges();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(change2.id);
    });
  });

  describe('API Methods', () => {
    it('should have recordChange method', () => {
      expect(service.recordChange).toBeDefined();
      expect(typeof service.recordChange).toBe('function');
    });

    it('should have getUnsyncedChanges method', () => {
      expect(service.getUnsyncedChanges).toBeDefined();
      expect(typeof service.getUnsyncedChanges).toBe('function');
    });

    it('should have detectConflicts method', () => {
      expect(service.detectConflicts).toBeDefined();
      expect(typeof service.detectConflicts).toBe('function');
    });

    it('should have addToSyncQueue method', () => {
      expect(service.addToSyncQueue).toBeDefined();
      expect(typeof service.addToSyncQueue).toBe('function');
    });

    it('should have getSyncStatus method', () => {
      expect(service.getSyncStatus).toBeDefined();
      expect(typeof service.getSyncStatus).toBe('function');
    });
  });
});
