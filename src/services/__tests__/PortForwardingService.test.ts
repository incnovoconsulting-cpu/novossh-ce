import { describe, it, expect, beforeEach } from 'vitest';
import { portForwardingService, PortForward } from '../src/services/PortForwardingService';

describe('PortForwardingService', () => {
  const testHostId = 'test-host';

  beforeEach(() => {
    // Clear all forwards before each test
    portForwardingService.getAllForwards().forEach(forward => {
      portForwardingService.deleteForward(forward.id).catch(() => {});
    });
  });

  describe('Forward Creation', () => {
    it('should create a local port forward', async () => {
      const forward = await portForwardingService.createForward({
        hostId: testHostId,
        label: 'MySQL Server',
        type: 'local',
        bindAddress: '127.0.0.1',
        bindPort: 3306,
        destinationHost: 'db.example.com',
        destinationPort: 3306,
        autoStart: false,
        category: 'Database',
        notes: 'Test forward',
        active: false,
      });

      expect(forward.id).toBeDefined();
      expect(forward.label).toBe('MySQL Server');
      expect(forward.type).toBe('local');
    });

    it('should emit forwardCreated event', (done) => {
      portForwardingService.once('forwardCreated', (forward) => {
        expect(forward.label).toBe('Test Forward');
        done();
      });

      portForwardingService.createForward({
        hostId: testHostId,
        label: 'Test Forward',
        type: 'local',
        bindAddress: '127.0.0.1',
        bindPort: 8080,
        destinationHost: 'localhost',
        destinationPort: 8080,
        autoStart: false,
        category: 'Web',
        notes: '',
        active: false,
      }).catch(() => {});
    });

    it('should create remote port forward', async () => {
      const forward = await portForwardingService.createForward({
        hostId: testHostId,
        label: 'Remote Web Server',
        type: 'remote',
        bindAddress: '0.0.0.0',
        bindPort: 8080,
        destinationHost: 'localhost',
        destinationPort: 3000,
        autoStart: false,
        category: 'Web',
        notes: '',
        active: false,
      });

      expect(forward.type).toBe('remote');
    });

    it('should create dynamic SOCKS forward', async () => {
      const forward = await portForwardingService.createForward({
        hostId: testHostId,
        label: 'SOCKS Proxy',
        type: 'dynamic',
        bindAddress: '127.0.0.1',
        bindPort: 1080,
        destinationHost: 'localhost',
        destinationPort: 1080,
        autoStart: false,
        category: 'Proxy',
        notes: '',
        active: false,
      });

      expect(forward.type).toBe('dynamic');
    });
  });

  describe('Forward Management', () => {
    let testForwardId: string;

    beforeEach(async () => {
      const forward = await portForwardingService.createForward({
        hostId: testHostId,
        label: 'Test',
        type: 'local',
        bindAddress: '127.0.0.1',
        bindPort: 3306,
        destinationHost: 'localhost',
        destinationPort: 3306,
        autoStart: false,
        category: 'Database',
        notes: '',
        active: false,
      });
      testForwardId = forward.id;
    });

    it('should update forward', async () => {
      const updated = await portForwardingService.updateForward(testForwardId, {
        label: 'Updated Label',
      });

      expect(updated.label).toBe('Updated Label');
    });

    it('should delete forward', async () => {
      await portForwardingService.deleteForward(testForwardId);
      const forward = portForwardingService.getForward(testForwardId);
      expect(forward).toBeUndefined();
    });

    it('should emit forwardDeleted event', (done) => {
      portForwardingService.once('forwardDeleted', (forward) => {
        expect(forward.id).toBe(testForwardId);
        done();
      });

      portForwardingService.deleteForward(testForwardId).catch(() => {});
    });

    it('should get forward by ID', () => {
      const forward = portForwardingService.getForward(testForwardId);
      expect(forward?.id).toBe(testForwardId);
    });

    it('should get all forwards for host', async () => {
      const forwards = portForwardingService.getForwardsForHost(testHostId);
      expect(forwards.length).toBeGreaterThan(0);
      expect(forwards.every(f => f.hostId === testHostId)).toBe(true);
    });
  });

  describe('Forward Activation', () => {
    let testForwardId: string;

    beforeEach(async () => {
      const forward = await portForwardingService.createForward({
        hostId: testHostId,
        label: 'Test',
        type: 'local',
        bindAddress: '127.0.0.1',
        bindPort: 3306,
        destinationHost: 'localhost',
        destinationPort: 3306,
        autoStart: false,
        category: 'Database',
        notes: '',
        active: false,
      });
      testForwardId = forward.id;
    });

    it('should activate forward', async () => {
      await portForwardingService.activateForward(testForwardId);
      const forward = portForwardingService.getForward(testForwardId);
      expect(forward?.active).toBe(true);
    });

    it('should emit forwardActivated event', (done) => {
      portForwardingService.once('forwardActivated', (forward) => {
        expect(forward.active).toBe(true);
        done();
      });

      portForwardingService.activateForward(testForwardId).catch(() => {});
    });

    it('should deactivate forward', async () => {
      await portForwardingService.activateForward(testForwardId);
      await portForwardingService.deactivateForward(testForwardId);
      const forward = portForwardingService.getForward(testForwardId);
      expect(forward?.active).toBe(false);
    });

    it('should emit forwardDeactivated event', async (done) => {
      await portForwardingService.activateForward(testForwardId);
      portForwardingService.once('forwardDeactivated', () => {
        done();
      });

      portForwardingService.deactivateForward(testForwardId).catch(() => {});
    });
  });

  describe('Template System', () => {
    it('should list available templates', () => {
      const templates = portForwardingService.getTemplates();
      expect(templates.length).toBe(9);
    });

    it('should get template by ID', () => {
      const template = portForwardingService.getTemplate('tpl_mysql');
      expect(template?.name).toBe('MySQL/MariaDB');
      expect(template?.destinationPort).toBe(3306);
    });

    it('should create forward from template', async () => {
      const forward = await portForwardingService.createFromTemplate(
        testHostId,
        'tpl_postgres',
        { bindPort: 5432 }
      );

      expect(forward.label).toBe('PostgreSQL');
      expect(forward.destinationPort).toBe(5432);
    });

    it('should have all required templates', () => {
      const templates = portForwardingService.getTemplates();
      const templateIds = templates.map(t => t.id);

      expect(templateIds).toContain('tpl_mysql');
      expect(templateIds).toContain('tpl_postgres');
      expect(templateIds).toContain('tpl_mongodb');
      expect(templateIds).toContain('tpl_redis');
      expect(templateIds).toContain('tpl_web');
      expect(templateIds).toContain('tpl_http');
      expect(templateIds).toContain('tpl_https');
      expect(templateIds).toContain('tpl_vnc');
      expect(templateIds).toContain('tpl_rdp');
    });

    it('should template have correct port numbers', () => {
      const mysql = portForwardingService.getTemplate('tpl_mysql');
      const postgres = portForwardingService.getTemplate('tpl_postgres');
      const redis = portForwardingService.getTemplate('tpl_redis');

      expect(mysql?.destinationPort).toBe(3306);
      expect(postgres?.destinationPort).toBe(5432);
      expect(redis?.destinationPort).toBe(6379);
    });
  });

  describe('Forward Status', () => {
    let testForwardId: string;

    beforeEach(async () => {
      const forward = await portForwardingService.createForward({
        hostId: testHostId,
        label: 'Test',
        type: 'local',
        bindAddress: '127.0.0.1',
        bindPort: 3306,
        destinationHost: 'localhost',
        destinationPort: 3306,
        autoStart: false,
        category: 'Database',
        notes: '',
        active: false,
      });
      testForwardId = forward.id;
    });

    it('should get forward status', async () => {
      await portForwardingService.activateForward(testForwardId);
      const status = portForwardingService.getStatus(testForwardId);
      expect(status?.active).toBe(true);
    });

    it('should get active forwards', async () => {
      await portForwardingService.activateForward(testForwardId);
      const active = portForwardingService.getActiveForwards();
      expect(active.length).toBeGreaterThan(0);
      expect(active.some(f => f.id === testForwardId)).toBe(true);
    });

    it('should test forward connectivity', async () => {
      const result = await portForwardingService.testForward(testForwardId);
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid forward ID', async () => {
      await expect(portForwardingService.getForward('invalid-id')).toBeUndefined();
    });

    it('should throw on invalid template', async () => {
      await expect(
        portForwardingService.createFromTemplate(testHostId, 'invalid-template')
      ).rejects.toThrow();
    });
  });
});
