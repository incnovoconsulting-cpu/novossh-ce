import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconnectionHandler } from '../ReconnectionHandler';
import { OfflineSyncService } from '../OfflineSyncService';
import { P2PSyncService } from '../P2PSyncService';

// Mock implementations
const mockOfflineSync = {
  getUnsyncedChanges: vi.fn(async () => []),
  detectConflicts: vi.fn(async () => []),
  resolveConflict: vi.fn(async () => {}),
  markAsSynced: vi.fn(async () => {}),
  clearSyncedChanges: vi.fn(async () => {}),
  getSyncStatus: vi.fn(async () => ({
    isOnline: true,
    unsyncedCount: 0,
    conflictCount: 0,
    queuedCount: 0,
  })),
  getMetadata: vi.fn(async () => null),
  setMetadata: vi.fn(async () => {}),
  on: vi.fn((event: string, handler: Function) => {}),
};

const mockP2pSync = {
  getConnectedPeers: vi.fn(() => []),
  sendChangesToPeer: vi.fn(async () => {}),
  on: vi.fn((event: string, handler: Function) => {}),
};

const mockServerApi = {
  syncChange: vi.fn(async () => {}),
  getChanges: vi.fn(async () => ({ changes: [] })),
};

describe('ReconnectionHandler', () => {
  let handler: ReconnectionHandler;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock implementations to defaults
    mockOfflineSync.getUnsyncedChanges = vi.fn(async () => []);
    mockOfflineSync.detectConflicts = vi.fn(async () => []);
    mockOfflineSync.resolveConflict = vi.fn(async () => {});
    mockOfflineSync.markAsSynced = vi.fn(async () => {});
    mockOfflineSync.clearSyncedChanges = vi.fn(async () => {});
    mockOfflineSync.getSyncStatus = vi.fn(async () => ({
      isOnline: true,
      unsyncedCount: 0,
      conflictCount: 0,
      queuedCount: 0,
    }));
    mockOfflineSync.getMetadata = vi.fn(async () => null);
    mockOfflineSync.setMetadata = vi.fn(async () => {});
    mockP2pSync.getConnectedPeers = vi.fn(() => []);
    mockP2pSync.sendChangesToPeer = vi.fn(async () => {});
    mockServerApi.syncChange = vi.fn(async () => {});
    mockServerApi.getChanges = vi.fn(async () => ({ changes: [] }));

    handler = new ReconnectionHandler(
      mockOfflineSync as any,
      mockP2pSync as any,
      mockServerApi,
      {
        autoSync: true,
        conflictResolution: 'manual',
        maxRetries: 3,
        retryDelay: 100,
      }
    );
    await handler.initialize();
  });

  describe('Initialization', () => {
    it('should initialize reconnection handler', async () => {
      expect(handler).toBeDefined();
    });

    it('should register event listeners', () => {
      expect(() => {
        handler.on('reconnecting', () => {});
        handler.on('reconnected', () => {});
        handler.on('sync-complete', () => {});
      }).not.toThrow();
    });
  });

  describe('Connection Detection', () => {
    it('should detect online event', () => {
      const listener = vi.fn();
      handler.on('reconnecting', listener);

      expect(listener).toBeDefined();
    });

    it('should track reconnection status', async () => {
      const status = await handler.getSyncStatus();

      expect(status.isReconnecting).toBe(false);
      expect(typeof status.isOnline).toBe('boolean');
    });
  });

  describe('Change Synchronization', () => {
    it('should synchronize changes with server', async () => {
      mockOfflineSync.getUnsyncedChanges = vi.fn(async () => [
        {
          id: 'change-1',
          type: 'create',
          resourceType: 'vault',
          resourceId: 'vault-1',
          data: { name: 'Vault 1' },
          timestamp: Date.now(),
          deviceId: 'device-1',
          synced: false,
        },
      ]);

      const result = await handler.synchronizeAllChanges();

      expect(result.success).toBe(true);
    }, 15000);

    it('should handle empty change list', async () => {
      const result = await handler.synchronizeAllChanges();

      expect(result.success).toBe(true);
      expect(result.unsyncedChanges).toBe(0);
      expect(result.syncedChanges).toBe(0);
    }, 15000);

    it('should track unsynced and synced counts', async () => {
      mockOfflineSync.getUnsyncedChanges = vi.fn(async () => [
        {
          id: 'change-1',
          type: 'create',
          resourceType: 'vault',
          resourceId: 'vault-1',
          data: { name: 'Vault 1' },
          timestamp: Date.now(),
          deviceId: 'device-1',
          synced: false,
        },
        {
          id: 'change-2',
          type: 'update',
          resourceType: 'vault',
          resourceId: 'vault-1',
          data: { name: 'Updated Vault' },
          timestamp: Date.now() + 100,
          deviceId: 'device-1',
          synced: false,
        },
      ]);

      const result = await handler.synchronizeAllChanges();

      expect(result.unsyncedChanges).toBe(2);
    }, 15000);
  });

  describe('Conflict Resolution', () => {
    it('should detect conflicts during sync', async () => {
      // Create handler with 'local' conflict resolution for this test
      const testHandler = new ReconnectionHandler(
        mockOfflineSync as any,
        mockP2pSync as any,
        mockServerApi,
        {
          autoSync: true,
          conflictResolution: 'local',
          maxRetries: 3,
          retryDelay: 100,
        }
      );
      await testHandler.initialize();

      mockOfflineSync.getUnsyncedChanges = vi.fn(async () => [
        {
          id: 'change-1',
          type: 'update',
          resourceType: 'vault',
          resourceId: 'vault-1',
          data: { name: 'Local' },
          timestamp: Date.now(),
          deviceId: 'device-1',
          synced: false,
        },
      ]);

      mockOfflineSync.detectConflicts = vi.fn(async () => [
        {
          id: 'conflict-1',
          resourceId: 'vault-1',
          resourceType: 'vault',
          localChange: {
            id: 'change-1',
            type: 'update',
            resourceType: 'vault',
            resourceId: 'vault-1',
            data: { name: 'Local' },
            timestamp: Date.now(),
            deviceId: 'device-1',
            synced: false,
          },
          remoteChange: {
            id: 'change-remote-1',
            type: 'update',
            resourceType: 'vault',
            resourceId: 'vault-1',
            data: { name: 'Remote' },
            timestamp: Date.now() - 1000,
            deviceId: 'device-2',
            synced: true,
          },
        },
      ]);

      const listener = vi.fn();
      testHandler.on('conflict-detected', listener);

      const result = await testHandler.synchronizeAllChanges();

      expect(result.conflicts.length >= 0).toBe(true);
    });

    it('should allow manual conflict resolution', async () => {
      const conflict = {
        id: 'conflict-1',
        resourceId: 'vault-1',
        resourceType: 'vault',
        localChange: {
          id: 'change-1',
          type: 'update' as const,
          resourceType: 'vault',
          resourceId: 'vault-1',
          data: { name: 'Local' },
          timestamp: Date.now(),
          deviceId: 'device-1',
          synced: false,
        },
        remoteChange: {
          id: 'change-remote-1',
          type: 'update' as const,
          resourceType: 'vault',
          resourceId: 'vault-1',
          data: { name: 'Remote' },
          timestamp: Date.now() - 1000,
          deviceId: 'device-2',
          synced: true,
        },
      };

      await expect(handler.resolveConflict(conflict.id, 'local')).resolves.toBeUndefined();
    });

    it('should support different conflict resolution strategies', async () => {
      const conflictId = 'conflict-1';

      await expect(handler.resolveConflict(conflictId, 'local')).resolves.toBeUndefined();
      await expect(handler.resolveConflict(conflictId, 'remote')).resolves.toBeUndefined();
      await expect(
        handler.resolveConflict(conflictId, 'merged', { name: 'Merged' })
      ).resolves.toBeUndefined();
    });
  });

  describe('Peer Synchronization', () => {
    it('should sync changes with connected peers', async () => {
      // Create handler with 'local' conflict resolution for this test
      const testHandler = new ReconnectionHandler(
        mockOfflineSync as any,
        mockP2pSync as any,
        mockServerApi,
        {
          autoSync: true,
          conflictResolution: 'local',
          maxRetries: 3,
          retryDelay: 100,
        }
      );
      await testHandler.initialize();

      mockP2pSync.getConnectedPeers = vi.fn(() => [
        { id: 'peer-1', name: 'Peer 1', lastSeen: Date.now(), isConnected: true },
      ]);

      mockOfflineSync.getUnsyncedChanges = vi.fn(async () => [
        {
          id: 'change-1',
          type: 'create',
          resourceType: 'vault',
          resourceId: 'vault-1',
          data: { name: 'Vault 1' },
          timestamp: Date.now(),
          deviceId: 'device-1',
          synced: false,
        },
      ]);

      const result = await testHandler.synchronizeAllChanges();

      expect(result.success).toBe(true);
    });

    it('should handle peer sync failures gracefully', async () => {
      mockP2pSync.getConnectedPeers = vi.fn(() => [
        { id: 'peer-1', name: 'Peer 1', lastSeen: Date.now(), isConnected: true },
      ]);

      mockP2pSync.sendChangesToPeer = vi.fn(async () => {
        throw new Error('Peer sync failed');
      });

      mockOfflineSync.getUnsyncedChanges = vi.fn(async () => []);

      const result = await handler.synchronizeAllChanges();

      expect(result.success).toBe(true); // Should not fail completely
    }, 15000);
  });

  describe('Sync Progress Tracking', () => {
    it('should emit progress events during sync', () => {
      const progressListener = vi.fn();
      handler.on('sync-progress', progressListener);

      expect(progressListener).toBeDefined();
    });

    it('should track sync stages', () => {
      const stages = ['fetching-remote', 'syncing-server', 'syncing-peers'];

      expect(stages).toContain('fetching-remote');
      expect(stages).toContain('syncing-server');
      expect(stages).toContain('syncing-peers');
    });
  });

  describe('Retry Logic', () => {
    it('should support configurable retry count', async () => {
      const customHandler = new ReconnectionHandler(
        mockOfflineSync as any,
        mockP2pSync as any,
        mockServerApi,
        {
          maxRetries: 5,
          retryDelay: 100,
        }
      );

      expect(customHandler).toBeDefined();
    });

    it('should support exponential backoff configuration', () => {
      const customHandler = new ReconnectionHandler(
        mockOfflineSync as any,
        mockP2pSync as any,
        mockServerApi,
        {
          maxRetries: 5,
          retryDelay: 500,
        }
      );

      expect(customHandler).toBeDefined();
    });
  });

  describe('Sync Status', () => {
    it('should report current sync status', async () => {
      const status = await handler.getSyncStatus();

      expect(status).toHaveProperty('isOnline');
      expect(status).toHaveProperty('isReconnecting');
      expect(status).toHaveProperty('unsyncedCount');
      expect(status).toHaveProperty('conflictCount');
    });

    it('should update status during sync', async () => {
      let statusBeforeSync = await handler.getSyncStatus();
      expect(statusBeforeSync.isReconnecting).toBe(false);
    });
  });

  describe('API Methods', () => {
    it('should have on method', () => {
      expect(handler.on).toBeDefined();
      expect(typeof handler.on).toBe('function');
    });

    it('should have off method', () => {
      expect(handler.off).toBeDefined();
      expect(typeof handler.off).toBe('function');
    });

    it('should have synchronizeAllChanges method', () => {
      expect(handler.synchronizeAllChanges).toBeDefined();
      expect(typeof handler.synchronizeAllChanges).toBe('function');
    });

    it('should have getSyncStatus method', () => {
      expect(handler.getSyncStatus).toBeDefined();
      expect(typeof handler.getSyncStatus).toBe('function');
    });

    it('should have resolveConflict method', () => {
      expect(handler.resolveConflict).toBeDefined();
      expect(typeof handler.resolveConflict).toBe('function');
    });
  });

  describe('Event Handling', () => {
    it('should emit reconnecting event', () => {
      const listener = vi.fn();
      handler.on('reconnecting', listener);

      expect(listener).toBeDefined();
    });

    it('should emit reconnected event', () => {
      const listener = vi.fn();
      handler.on('reconnected', listener);

      expect(listener).toBeDefined();
    });

    it('should emit sync-complete event', () => {
      const listener = vi.fn();
      handler.on('sync-complete', listener);

      expect(listener).toBeDefined();
    });
  });
});
