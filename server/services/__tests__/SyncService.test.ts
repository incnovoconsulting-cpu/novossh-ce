import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncService, SyncLog, SyncConflict } from '../SyncService';

// Mock the database connection
vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(() => mockDb),
}));

const mockDb = vi.fn();
mockDb.mockImplementation(() => Promise.resolve([]));
// Support db.begin() for transaction-based methods
(mockDb as unknown as { begin: ReturnType<typeof vi.fn> }).begin = vi.fn(async (callback: Function) => {
  return callback(mockDb);
});

describe('SyncService', () => {
  let service: SyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SyncService();
  });

  describe('recordChange', () => {
    it('should record a vault creation operation', async () => {
      const mockLog: SyncLog = {
        id: 'log-1',
        vault_id: 'vault-1',
        user_id: 'user-1',
        device_id: 'device-1',
        operation: 'create',
        entry_id: 'entry-1',
        previous_version: undefined,
        new_version: 1,
        has_conflict: false,
        operation_timestamp: new Date(),
        logged_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockLog]);

      const result = await service.recordChange(
        'vault-1',
        'user-1',
        'device-1',
        'create',
        'entry-1',
        undefined,
        1
      );

      expect(result.operation).toBe('create');
      expect(result.entry_id).toBe('entry-1');
      expect(result.new_version).toBe(1);
    });

    it('should record an update operation', async () => {
      const mockLog: SyncLog = {
        id: 'log-2',
        vault_id: 'vault-1',
        user_id: 'user-1',
        device_id: 'device-1',
        operation: 'update',
        entry_id: 'entry-1',
        previous_version: 1,
        new_version: 2,
        has_conflict: false,
        operation_timestamp: new Date(),
        logged_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([]); // conflict check SELECT → no conflict
      mockDb.mockResolvedValueOnce([mockLog]); // INSERT RETURNING

      const result = await service.recordChange(
        'vault-1',
        'user-1',
        'device-1',
        'update',
        'entry-1',
        1,
        2
      );

      expect(result.operation).toBe('update');
      expect(result.previous_version).toBe(1);
      expect(result.new_version).toBe(2);
    });

    it('should record a delete operation', async () => {
      const mockLog: SyncLog = {
        id: 'log-3',
        vault_id: 'vault-1',
        user_id: 'user-1',
        device_id: 'device-1',
        operation: 'delete',
        entry_id: 'entry-1',
        previous_version: 2,
        has_conflict: false,
        operation_timestamp: new Date(),
        logged_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([]); // conflict check SELECT → no conflict
      mockDb.mockResolvedValueOnce([mockLog]); // INSERT RETURNING

      const result = await service.recordChange(
        'vault-1',
        'user-1',
        'device-1',
        'delete',
        'entry-1',
        2
      );

      expect(result.operation).toBe('delete');
      expect(result.previous_version).toBe(2);
    });

    it('should record change without entry_id for vault operations', async () => {
      const mockLog: SyncLog = {
        id: 'log-4',
        vault_id: 'vault-1',
        user_id: 'user-1',
        device_id: 'device-1',
        operation: 'rename_vault',
        has_conflict: false,
        operation_timestamp: new Date(),
        logged_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockLog]);

      const result = await service.recordChange(
        'vault-1',
        'user-1',
        'device-1',
        'rename_vault'
      );

      expect(result.operation).toBe('rename_vault');
      expect(result.entry_id).toBeUndefined();
    });

    it('should handle rapid change recording', async () => {
      const logs: SyncLog[] = Array.from({ length: 5 }, (_, i) => ({
        id: `log-${i}`,
        vault_id: 'vault-1',
        user_id: 'user-1',
        device_id: 'device-1',
        operation: 'update',
        entry_id: `entry-${i}`,
        previous_version: i,
        new_version: i + 1,
        has_conflict: false,
        operation_timestamp: new Date(),
        logged_at: new Date(),
      }));

      // recordChange with previousVersion set does: SELECT (conflict check) then INSERT.
      // With Promise.all, all 5 SELECTs fire before any INSERTs (microtask ordering).
      for (let i = 0; i < logs.length; i++) {
        mockDb.mockResolvedValueOnce([]); // conflict check → no conflict
      }
      for (const log of logs) {
        mockDb.mockResolvedValueOnce([log]); // INSERT RETURNING
      }

      const results = await Promise.all(
        logs.map((log) =>
          service.recordChange(
            log.vault_id,
            log.user_id,
            log.device_id,
            log.operation,
            log.entry_id,
            log.previous_version,
            log.new_version
          )
        )
      );

      expect(results).toHaveLength(5);
      expect(results[0].entry_id).toBe('entry-0');
      expect(results[4].entry_id).toBe('entry-4');
    });
  });

  describe('getChanges', () => {
    it('should retrieve changes since a given timestamp', async () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const mockChanges: SyncLog[] = [
        {
          id: 'log-1',
          vault_id: 'vault-1',
          user_id: 'user-1',
          device_id: 'device-1',
          operation: 'create',
          entry_id: 'entry-1',
          new_version: 1,
          has_conflict: false,
          operation_timestamp: new Date(now.getTime() - 1 * 60 * 1000),
          logged_at: new Date(),
        },
        {
          id: 'log-2',
          vault_id: 'vault-1',
          user_id: 'user-1',
          device_id: 'device-1',
          operation: 'update',
          entry_id: 'entry-1',
          previous_version: 1,
          new_version: 2,
          has_conflict: false,
          operation_timestamp: now,
          logged_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockChanges);

      const result = await service.getChanges('vault-1', fiveMinutesAgo);

      expect(result).toHaveLength(2);
      expect(result[0].operation).toBe('create');
      expect(result[1].operation).toBe('update');
    });

    it('should return empty array when no changes since timestamp', async () => {
      const now = new Date();

      mockDb.mockResolvedValueOnce([]);

      const result = await service.getChanges('vault-1', now);

      expect(result).toHaveLength(0);
    });

    it('should order changes by operation timestamp ascending', async () => {
      const baseTime = new Date();

      const mockChanges: SyncLog[] = [
        {
          id: 'log-1',
          vault_id: 'vault-1',
          user_id: 'user-1',
          device_id: 'device-1',
          operation: 'create',
          entry_id: 'entry-1',
          new_version: 1,
          has_conflict: false,
          operation_timestamp: baseTime,
          logged_at: new Date(),
        },
        {
          id: 'log-2',
          vault_id: 'vault-1',
          user_id: 'user-1',
          device_id: 'device-1',
          operation: 'update',
          entry_id: 'entry-1',
          previous_version: 1,
          new_version: 2,
          has_conflict: false,
          operation_timestamp: new Date(baseTime.getTime() + 1000),
          logged_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockChanges);

      const result = await service.getChanges('vault-1', new Date(baseTime.getTime() - 1000));

      expect(result[0].operation_timestamp.getTime()).toBeLessThan(
        result[1].operation_timestamp.getTime()
      );
    });

    it('should filter changes by vault_id', async () => {
      const mockChanges: SyncLog[] = [
        {
          id: 'log-1',
          vault_id: 'vault-1',
          user_id: 'user-1',
          device_id: 'device-1',
          operation: 'create',
          entry_id: 'entry-1',
          new_version: 1,
          has_conflict: false,
          operation_timestamp: new Date(),
          logged_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockChanges);

      const result = await service.getChanges('vault-1', new Date());

      expect(result).toBeDefined();
      expect(mockDb).toHaveBeenCalled();
    });
  });

  describe('detectConflicts', () => {
    it('should detect version mismatches', async () => {
      const mockConflicts: any[] = [
        {
          entry_id: 'entry-1',
          local_version: 1,
          remote_version: 2,
          local_timestamp: new Date(),
          remote_timestamp: new Date(),
        },
        {
          entry_id: 'entry-2',
          local_version: 3,
          remote_version: 2,
          local_timestamp: new Date(),
          remote_timestamp: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockConflicts);

      const result = await service.detectConflicts('vault-1');

      expect(result).toHaveLength(2);
      expect(result[0].entryId).toBe('entry-1');
      expect(result[0].localVersion).toBe(1);
      expect(result[0].remoteVersion).toBe(2);
    });

    it('should return empty array when no conflicts', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.detectConflicts('vault-1');

      expect(result).toHaveLength(0);
    });

    it('should ignore deleted entries', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.detectConflicts('vault-1');

      expect(result).toHaveLength(0);
    });

    it('should map database columns to conflict object', async () => {
      const localTime = new Date();
      const remoteTime = new Date(localTime.getTime() + 1000);

      const mockConflicts: any[] = [
        {
          entry_id: 'entry-1',
          local_version: 5,
          remote_version: 3,
          local_timestamp: localTime,
          remote_timestamp: remoteTime,
        },
      ];

      mockDb.mockResolvedValueOnce(mockConflicts);

      const result = await service.detectConflicts('vault-1');

      const conflict = result[0];
      expect(conflict.entryId).toBe('entry-1');
      expect(conflict.localVersion).toBe(5);
      expect(conflict.remoteVersion).toBe(3);
      expect(conflict.localTimestamp).toEqual(localTime);
      expect(conflict.remoteTimestamp).toEqual(remoteTime);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict with local strategy', async () => {
      mockDb.mockResolvedValueOnce([{ updated: 1 }]);

      await service.resolveConflict('vault-1', 'entry-1', 'local');

      expect(mockDb).toHaveBeenCalled();
    });

    it('should resolve conflict with remote strategy', async () => {
      mockDb.mockResolvedValueOnce([{ updated: 1 }]);

      await service.resolveConflict('vault-1', 'entry-1', 'remote');

      expect(mockDb).toHaveBeenCalled();
    });

    it('should resolve conflict with merge strategy', async () => {
      mockDb.mockResolvedValueOnce([{ updated: 1 }]);

      await service.resolveConflict('vault-1', 'entry-1', 'merge');

      expect(mockDb).toHaveBeenCalled();
    });

    it('should resolve conflict with last-write-wins strategy', async () => {
      mockDb.mockResolvedValueOnce([{ updated: 1 }]);

      await service.resolveConflict('vault-1', 'entry-1', 'last-write-wins');

      expect(mockDb).toHaveBeenCalled();
    });

    it('should mark conflict as resolved in sync_logs', async () => {
      mockDb.mockResolvedValueOnce([{ updated: 1 }]);

      await service.resolveConflict('vault-1', 'entry-1', 'last-write-wins');

      expect(mockDb).toHaveBeenCalled();
    });

    it('should store resolution strategy', async () => {
      mockDb.mockResolvedValueOnce([{ updated: 1 }]);

      await service.resolveConflict('vault-1', 'entry-1', 'merge');

      expect(mockDb).toHaveBeenCalled();
    });

    it('should handle resolution of multiple conflicts', async () => {
      mockDb.mockResolvedValue([{ updated: 1 }]);

      await Promise.all([
        service.resolveConflict('vault-1', 'entry-1', 'local'),
        service.resolveConflict('vault-1', 'entry-2', 'remote'),
        service.resolveConflict('vault-1', 'entry-3', 'last-write-wins'),
      ]);

      // local → 1 call (UPDATE sync_logs, no winningData)
      // remote → 1 call (UPDATE sync_logs)
      // last-write-wins → 3 calls (UPDATE sync_logs + SELECT latest + UPDATE vault_entries)
      expect(mockDb).toHaveBeenCalledTimes(5);
    });
  });

  describe('getSyncStats', () => {
    it('should return sync statistics', async () => {
      mockDb
        .mockResolvedValueOnce([{ count: '50' }]) // total changes
        .mockResolvedValueOnce([{ count: '3' }]) // total conflicts
        .mockResolvedValueOnce([{ count: '2' }]) // resolved conflicts
        .mockResolvedValueOnce([{ device_id: 'device-1' }, { device_id: 'device-2' }]); // active devices

      const result = await service.getSyncStats('vault-1');

      expect(result.totalChanges).toBe('50');
      expect(result.totalConflicts).toBe('3');
      expect(result.resolvedConflicts).toBe('2');
      expect(result.activeDevices).toHaveLength(2);
    });

    it('should return zero stats for empty vault', async () => {
      mockDb
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);

      const result = await service.getSyncStats('vault-1');

      expect(result.totalChanges).toBe('0');
      expect(result.totalConflicts).toBe('0');
      expect(result.resolvedConflicts).toBe('0');
      expect(result.activeDevices).toHaveLength(0);
    });

    it('should list all active devices', async () => {
      mockDb
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([
          { device_id: 'device-1' },
          { device_id: 'device-2' },
          { device_id: 'device-3' },
        ]);

      const result = await service.getSyncStats('vault-1');

      expect(result.activeDevices).toEqual(['device-1', 'device-2', 'device-3']);
    });

    it('should calculate resolved conflict percentage', async () => {
      mockDb
        .mockResolvedValueOnce([{ count: '100' }])
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce([{ count: '7' }])
        .mockResolvedValueOnce([]);

      const result = await service.getSyncStats('vault-1');

      expect(result.totalChanges).toBe('100');
      expect(result.totalConflicts).toBe('10');
      expect(result.resolvedConflicts).toBe('7');
    });
  });

  describe('markSynced', () => {
    it('should mark entries as synced', async () => {
      mockDb.mockResolvedValueOnce([{ updated: 2 }]);

      await service.markSynced('vault-1', ['entry-1', 'entry-2']);

      expect(mockDb).toHaveBeenCalled();
    });

    it('should handle empty entry list', async () => {
      await service.markSynced('vault-1', []);

      expect(mockDb).not.toHaveBeenCalled();
    });

    it('should update synced_at timestamp', async () => {
      mockDb.mockResolvedValueOnce([{ updated: 1 }]);

      await service.markSynced('vault-1', ['entry-1']);

      expect(mockDb).toHaveBeenCalled();
    });

    it('should mark multiple entries at once', async () => {
      mockDb.mockResolvedValueOnce([{ updated: 5 }]);

      await service.markSynced('vault-1', [
        'entry-1',
        'entry-2',
        'entry-3',
        'entry-4',
        'entry-5',
      ]);

      expect(mockDb).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty change logs', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getChanges('vault-1', new Date());

      expect(result).toEqual([]);
    });

    it('should handle empty conflict list', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.detectConflicts('vault-1');

      expect(result).toEqual([]);
    });

    it('should handle vault with no sync activity', async () => {
      mockDb
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);

      const result = await service.getSyncStats('vault-1');

      expect(result.totalChanges).toBe('0');
      expect(result.activeDevices).toHaveLength(0);
    });

    it('should handle large change batches', async () => {
      const largeChangeLog = Array.from({ length: 1000 }, (_, i) => ({
        id: `log-${i}`,
        vault_id: 'vault-1',
        user_id: 'user-1',
        device_id: 'device-1',
        operation: 'update',
        entry_id: `entry-${i}`,
        previous_version: i,
        new_version: i + 1,
        has_conflict: false,
        operation_timestamp: new Date(),
        logged_at: new Date(),
      }));

      mockDb.mockResolvedValueOnce(largeChangeLog);

      const result = await service.getChanges('vault-1', new Date());

      expect(result).toHaveLength(1000);
    });

    it('should handle conflict resolution without prior detection', async () => {
      mockDb.mockResolvedValueOnce([{ updated: 1 }]);

      await service.resolveConflict('vault-1', 'entry-1', 'local');

      expect(mockDb).toHaveBeenCalled();
    });
  });

  describe('Multi-device Sync', () => {
    it('should track multiple devices in sync logs', async () => {
      const mockChanges: SyncLog[] = [
        {
          id: 'log-1',
          vault_id: 'vault-1',
          user_id: 'user-1',
          device_id: 'device-1',
          operation: 'update',
          entry_id: 'entry-1',
          previous_version: 1,
          new_version: 2,
          has_conflict: false,
          operation_timestamp: new Date(),
          logged_at: new Date(),
        },
        {
          id: 'log-2',
          vault_id: 'vault-1',
          user_id: 'user-1',
          device_id: 'device-2',
          operation: 'update',
          entry_id: 'entry-1',
          previous_version: 1,
          new_version: 2,
          has_conflict: true,
          conflicting_device_id: 'device-1',
          operation_timestamp: new Date(),
          logged_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockChanges);

      const result = await service.getChanges('vault-1', new Date());

      expect(result).toHaveLength(2);
      expect(result[0].device_id).toBe('device-1');
      expect(result[1].device_id).toBe('device-2');
    });

    it('should list all active devices syncing to vault', async () => {
      mockDb
        .mockResolvedValueOnce([{ count: '20' }])
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([
          { device_id: 'device-mobile' },
          { device_id: 'device-desktop' },
          { device_id: 'device-tablet' },
        ]);

      const result = await service.getSyncStats('vault-1');

      expect(result.activeDevices).toHaveLength(3);
      expect(result.activeDevices).toContain('device-mobile');
      expect(result.activeDevices).toContain('device-desktop');
      expect(result.activeDevices).toContain('device-tablet');
    });
  });
});
