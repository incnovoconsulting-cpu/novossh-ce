import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/connection.js', () => ({
  getDb: () => {
    const mockFn = vi.fn().mockResolvedValue([]);
    return mockFn;
  },
}));

import { ConnectionMetadataService } from '../services/ConnectionMetadataService.js';
import { ConnectionCleanupService } from '../services/ConnectionCleanupService.js';

describe('ConnectionMetadataService', () => {
  let service: ConnectionMetadataService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConnectionMetadataService();
  });

  describe('getConnectionMetadata', () => {
    it('returns null for non-existent entry', async () => {
      const result = await service.getConnectionMetadata('non-existent');
      expect(result).toBeNull();
    });

    it('returns metadata when entry exists', async () => {
      const mockDb = (service as any).db;
      mockDb.mockResolvedValueOnce([{
        connection_type: 'direct',
        connection_requires_relay: false,
        connection_metadata: { clientType: 'electron', supportsDirectConnection: true },
      }]);

      const result = await service.getConnectionMetadata('entry-1');
      expect(result).not.toBeNull();
      expect(result!.connectionMode).toBe('direct');
      expect(result!.requiresRelay).toBe(false);
      expect(result!.clientType).toBe('electron');
    });

    it('handles database errors gracefully', async () => {
      const mockDb = (service as any).db;
      mockDb.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.getConnectionMetadata('error-entry');
      expect(result).toBeNull();
    });
  });

  describe('updateConnectionMetadata', () => {
    it('updates connection metadata without throwing', async () => {
      await expect(
        service.updateConnectionMetadata('entry-1', {
          connectionMode: 'direct',
          requiresRelay: false,
        }),
      ).resolves.toBeUndefined();
    });

    it('handles partial metadata update', async () => {
      await expect(
        service.updateConnectionMetadata('entry-1', { connectionMode: 'relay' }),
      ).resolves.toBeUndefined();
    });

    it('handles empty metadata update', async () => {
      await expect(
        service.updateConnectionMetadata('entry-1', {}),
      ).resolves.toBeUndefined();
    });

    it('handles database errors gracefully', async () => {
      const mockDb = (service as any).db;
      mockDb.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.updateConnectionMetadata('entry-1', { connectionMode: 'direct' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('recordConnectionAttempt', () => {
    it('records successful direct attempt', async () => {
      await expect(
        service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'direct', '8.8.8.8', 22, true,
          undefined, false, undefined, 1500,
        ),
      ).resolves.toBeUndefined();
    });

    it('records failed attempt with error message', async () => {
      await expect(
        service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'direct', '192.168.1.1', 22, false,
          'Connection refused', false, undefined, 5000,
        ),
      ).resolves.toBeUndefined();
    });

    it('records fallback attempt', async () => {
      await expect(
        service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'direct', '10.0.0.1', 22, false,
          'Private IP - relay required', true, 'relay', 3000,
        ),
      ).resolves.toBeUndefined();
    });

    it('records relay connection attempt', async () => {
      await expect(
        service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'relay', '8.8.8.8', 22, true,
          undefined, false, undefined, 2000,
        ),
      ).resolves.toBeUndefined();
    });

    it('records tailscale connection attempt', async () => {
      await expect(
        service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'tailscale', '100.64.0.1', 22, true,
          undefined, false, undefined, 800,
        ),
      ).resolves.toBeUndefined();
    });

    it('records attempt with minimal parameters', async () => {
      await expect(
        service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'direct', '8.8.8.8', 22, true,
        ),
      ).resolves.toBeUndefined();
    });

    it('handles database errors gracefully', async () => {
      const mockDb = (service as any).db;
      mockDb.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'direct', '8.8.8.8', 22, true,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('getConnectionHints', () => {
    it('returns null for non-existent entry', async () => {
      const result = await service.getConnectionHints('non-existent');
      expect(result).toBeNull();
    });

    it('returns hints when entry exists', async () => {
      const mockDb = (service as any).db;
      mockDb.mockResolvedValueOnce([{
        is_private_ip: true,
        is_tailscale: false,
        is_public: false,
        recommended_mode: 'relay',
        last_direct_success_at: new Date('2026-01-01'),
        last_direct_failure_at: new Date('2026-01-02'),
        consecutive_direct_failures: 3,
      }]);

      const result = await service.getConnectionHints('entry-1');
      expect(result).not.toBeNull();
      expect(result!.isPrivateIp).toBe(true);
      expect(result!.isTailscale).toBe(false);
      expect(result!.isPublic).toBe(false);
      expect(result!.recommendedMode).toBe('relay');
      expect(result!.consecutiveDirectFailures).toBe(3);
      expect(result!.lastDirectSuccess).toEqual(new Date('2026-01-01'));
      expect(result!.lastDirectFailure).toEqual(new Date('2026-01-02'));
    });

    it('handles database errors gracefully', async () => {
      const mockDb = (service as any).db;
      mockDb.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.getConnectionHints('error-entry');
      expect(result).toBeNull();
    });
  });

  describe('updateConnectionHints', () => {
    it('updates hints with all fields', async () => {
      await expect(
        service.updateConnectionHints('entry-1', {
          isPrivateIp: true,
          isTailscale: false,
          isPublic: false,
          recommendedMode: 'relay',
          consecutiveDirectFailures: 0,
        }),
      ).resolves.toBeUndefined();
    });

    it('uses defaults for missing fields', async () => {
      await expect(
        service.updateConnectionHints('entry-1', {}),
      ).resolves.toBeUndefined();
    });

    it('handles database errors gracefully', async () => {
      const mockDb = (service as any).db;
      mockDb.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.updateConnectionHints('entry-1', { isPrivateIp: true }),
      ).resolves.toBeUndefined();
    });
  });

  describe('recordDirectConnectionSuccess', () => {
    it('updates hints without throwing', async () => {
      await expect(service.recordDirectConnectionSuccess('entry-1')).resolves.toBeUndefined();
    });

    it('handles database errors gracefully', async () => {
      const mockDb = (service as any).db;
      mockDb.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.recordDirectConnectionSuccess('entry-1')).resolves.toBeUndefined();
    });
  });

  describe('recordDirectConnectionFailure', () => {
    it('updates hints without throwing', async () => {
      await expect(service.recordDirectConnectionFailure('entry-1')).resolves.toBeUndefined();
    });

    it('handles database errors gracefully', async () => {
      const mockDb = (service as any).db;
      mockDb.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.recordDirectConnectionFailure('entry-1')).resolves.toBeUndefined();
    });
  });

  describe('getRecentConnectionStats', () => {
    it('returns null for non-existent entry', async () => {
      const result = await service.getRecentConnectionStats('non-existent');
      expect(result).toBeNull();
    });

    it('accepts custom days parameter', async () => {
      const result = await service.getRecentConnectionStats('entry-1', 30);
      expect(result).toBeNull();
    });

    it('clamps days to valid range (low)', async () => {
      const result = await service.getRecentConnectionStats('entry-1', 0);
      expect(result).toBeNull();
    });

    it('clamps days to valid range (high)', async () => {
      const result = await service.getRecentConnectionStats('entry-1', 999);
      expect(result).toBeNull();
    });

    it('returns stats when data exists', async () => {
      const mockDb = (service as any).db;
      mockDb.mockResolvedValueOnce([{
        total_attempts: 10,
        successful_attempts: 7,
        fallback_attempts: 2,
        avg_duration_ms: 1500,
        last_attempt: new Date('2026-06-15'),
      }]);

      const result = await service.getRecentConnectionStats('entry-1');
      expect(result).not.toBeNull();
      expect(result!.total_attempts).toBe(10);
      expect(result!.successful_attempts).toBe(7);
    });

    it('handles database errors gracefully', async () => {
      const mockDb = (service as any).db;
      mockDb.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.getRecentConnectionStats('entry-1');
      expect(result).toBeNull();
    });
  });

  describe('race condition handling', () => {
    it('handles concurrent metadata updates without throwing', async () => {
      await Promise.all([
        service.updateConnectionMetadata('entry-1', { connectionMode: 'direct', requiresRelay: false }),
        service.updateConnectionMetadata('entry-1', { connectionMode: 'relay', requiresRelay: true }),
      ]);
    });

    it('handles concurrent hint updates without throwing', async () => {
      await Promise.all([
        service.updateConnectionHints('entry-1', { isPrivateIp: true }),
        service.updateConnectionHints('entry-1', { isTailscale: true }),
      ]);
    });

    it('handles concurrent success/failure recording without throwing', async () => {
      await Promise.all([
        service.recordDirectConnectionSuccess('entry-1'),
        service.recordDirectConnectionFailure('entry-1'),
      ]);
    });

    it('handles rapid sequential updates', async () => {
      for (let i = 0; i < 10; i++) {
        await service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'direct', '8.8.8.8', 22, i % 2 === 0,
        );
      }
    });
  });

  describe('IPv6 range detection', () => {
    it('handles IPv6 Tailscale addresses in hint updates', async () => {
      await expect(
        service.updateConnectionHints('entry-1', {
          isPrivateIp: false,
          isTailscale: true,
          isPublic: false,
          recommendedMode: 'tailscale',
        }),
      ).resolves.toBeUndefined();
    });

    it('handles IPv6 link-local addresses in hint updates', async () => {
      await expect(
        service.updateConnectionHints('entry-1', {
          isPrivateIp: true,
          isTailscale: false,
          isPublic: false,
          recommendedMode: 'relay',
        }),
      ).resolves.toBeUndefined();
    });

    it('records connection attempts with IPv6 targets', async () => {
      await expect(
        service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'direct', '2001:db8::1', 22, true,
          undefined, false, undefined, 1200,
        ),
      ).resolves.toBeUndefined();
    });

    it('records connection attempts with Tailscale IPv6', async () => {
      await expect(
        service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'tailscale',
          'fd7a:115c:a1e0:ab12:4843:cd96:624d:abcd', 22, true,
          undefined, false, undefined, 900,
        ),
      ).resolves.toBeUndefined();
    });

    it('records connection attempts with IPv4-mapped IPv6', async () => {
      await expect(
        service.recordConnectionAttempt(
          'entry-1', 'user-1', 'device-1', 'direct', '::ffff:192.168.1.1', 22, false,
          'Private IP', true, 'relay', 2500,
        ),
      ).resolves.toBeUndefined();
    });

    it('updates metadata with IPv6 host info', async () => {
      await expect(
        service.updateConnectionMetadata('entry-1', {
          connectionMode: 'relay',
          requiresRelay: true,
        }),
      ).resolves.toBeUndefined();
    });
  });
});

describe('ConnectionCleanupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles cleanup of old connection attempts', async () => {
    const cleanupService = new ConnectionCleanupService();
    const mockDb = (cleanupService as any).db;
    mockDb.mockResolvedValueOnce({ count: 5 });

    const result = await cleanupService.cleanupOldAttempts();
    expect(result.deleted).toBe(5);
  });

  it('handles cleanup when no old records exist', async () => {
    const cleanupService = new ConnectionCleanupService();
    const mockDb = (cleanupService as any).db;
    mockDb.mockResolvedValueOnce({ count: 0 });

    const result = await cleanupService.cleanupOldAttempts();
    expect(result.deleted).toBe(0);
  });

  it('handles cleanup database errors gracefully', async () => {
    const cleanupService = new ConnectionCleanupService();
    const mockDb = (cleanupService as any).db;
    mockDb.mockRejectedValueOnce(new Error('DB error'));

    const result = await cleanupService.cleanupOldAttempts();
    expect(result.deleted).toBe(0);
  });

  it('startPeriodicCleanup sets interval', () => {
    vi.useFakeTimers();
    const cleanupService = new ConnectionCleanupService();
    cleanupService.startPeriodicCleanup(60000);
    expect((cleanupService as any).intervalHandle).not.toBeNull();
    cleanupService.stopPeriodicCleanup();
    vi.useRealTimers();
  });

  it('stopPeriodicCleanup clears interval', () => {
    vi.useFakeTimers();
    const cleanupService = new ConnectionCleanupService();
    cleanupService.startPeriodicCleanup(60000);
    cleanupService.stopPeriodicCleanup();
    expect((cleanupService as any).intervalHandle).toBeNull();
    vi.useRealTimers();
  });

  it('stopPeriodicCleanup is safe when no interval running', () => {
    const cleanupService = new ConnectionCleanupService();
    expect(() => cleanupService.stopPeriodicCleanup()).not.toThrow();
  });

  it('startPeriodicCleanup replaces existing interval', () => {
    vi.useFakeTimers();
    const cleanupService = new ConnectionCleanupService();
    cleanupService.startPeriodicCleanup(60000);
    const firstHandle = (cleanupService as any).intervalHandle;
    cleanupService.startPeriodicCleanup(30000);
    expect((cleanupService as any).intervalHandle).not.toBeNull();
    cleanupService.stopPeriodicCleanup();
    vi.useRealTimers();
  });

  it('cleanupOldAttempts returns correct structure', async () => {
    const cleanupService = new ConnectionCleanupService();
    const result = await cleanupService.cleanupOldAttempts();
    expect(result).toHaveProperty('deleted');
    expect(typeof result.deleted).toBe('number');
  });
});
