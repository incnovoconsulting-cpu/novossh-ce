import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockElectronAPI = {
  ssh: {
    connect: vi.fn().mockResolvedValue({ status: 'connected' }),
    send: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    onData: vi.fn().mockReturnValue(() => {}),
    onClosed: vi.fn().mockReturnValue(() => {}),
  },
};

describe('ElectronSSHAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function loadAdapter(electronAPI?: any) {
    if (electronAPI !== undefined) {
      (window as any).electronAPI = electronAPI;
    } else {
      delete (window as any).electronAPI;
    }
    const mod = await import('../ElectronSSHAdapter');
    return mod.electronSSHAdapter;
  }

  describe('isAvailable', () => {
    it('returns false when electronAPI is not present', async () => {
      const adapter = await loadAdapter(undefined);
      expect(adapter.isAvailable()).toBe(false);
    });

    it('returns false when electronAPI.ssh is not present', async () => {
      const adapter = await loadAdapter({});
      expect(adapter.isAvailable()).toBe(false);
    });

    it('returns true when electronAPI.ssh is present', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      expect(adapter.isAvailable()).toBe(true);
    });
  });

  describe('determineConnectionType', () => {
    it('returns relay when not in Electron', async () => {
      const adapter = await loadAdapter(undefined);
      expect(adapter.determineConnectionType('8.8.8.8', 'direct')).toBe('relay');
      expect(adapter.determineConnectionType('192.168.1.1', 'direct')).toBe('relay');
      expect(adapter.determineConnectionType('100.64.0.1', 'tailscale')).toBe('relay');
    });

    it('returns tailscale for Tailscale IP with tailscale mode', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      expect(adapter.determineConnectionType('100.64.0.1', 'tailscale')).toBe('tailscale');
      expect(adapter.determineConnectionType('myhost.ts.net', 'tailscale')).toBe('tailscale');
      expect(adapter.determineConnectionType('fd7a:115c:1234::1', 'tailscale')).toBe('tailscale');
    });

    it('returns direct for public IP with direct mode', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      expect(adapter.determineConnectionType('8.8.8.8', 'direct')).toBe('direct');
      expect(adapter.determineConnectionType('1.1.1.1', 'direct')).toBe('direct');
    });

    it('returns direct for Tailscale IP with direct mode', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      expect(adapter.determineConnectionType('100.64.0.1', 'direct')).toBe('direct');
    });

    it('returns relay for private IP with direct mode', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      expect(adapter.determineConnectionType('192.168.1.1', 'direct')).toBe('relay');
      expect(adapter.determineConnectionType('10.0.0.1', 'direct')).toBe('relay');
      expect(adapter.determineConnectionType('172.16.0.1', 'direct')).toBe('relay');
    });

    it('returns relay for undefined mode', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      expect(adapter.determineConnectionType('8.8.8.8', undefined)).toBe('relay');
    });

    it('returns relay for unknown mode', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      expect(adapter.determineConnectionType('8.8.8.8', 'unknown')).toBe('relay');
    });
  });

  describe('connect', () => {
    it('throws for relay mode', async () => {
      const adapter = await loadAdapter(undefined);
      await expect(
        adapter.connect(
          { host: '192.168.1.1', username: 'user' },
          'relay',
          vi.fn(),
          vi.fn(),
        ),
      ).rejects.toThrow('Relay mode not supported');
    });

    it('connects to public IP in direct mode', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      const onStatusChange = vi.fn();
      const onData = vi.fn();

      const result = await adapter.connect(
        { host: '8.8.8.8', username: 'user', port: 22 },
        'direct',
        onData,
        onStatusChange,
      );

      expect(result.sessionId).toBeDefined();
      expect(result.connectionType).toBe('direct');
      expect(result.disconnect).toBeInstanceOf(Function);
      expect(onStatusChange).toHaveBeenCalledWith('connecting');
      expect(onStatusChange).toHaveBeenCalledWith('connected');
      expect(mockElectronAPI.ssh.connect).toHaveBeenCalled();
    });

    it('connects to Tailscale IP via local tunnel', async () => {
      const adapter = await loadAdapter(mockElectronAPI);

      const result = await adapter.connect(
        { host: '100.64.0.1', username: 'user', port: 22 },
        'tailscale',
        vi.fn(),
        vi.fn(),
      );

      expect(result.connectionType).toBe('tailscale');
      expect(mockElectronAPI.ssh.connect).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ host: '127.0.0.1', port: 2222 }),
      );
    });

    it('calls onStatusChange error on connect failure', async () => {
      const failAPI = {
        ssh: {
          ...mockElectronAPI.ssh,
          connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
        },
      };
      const adapter = await loadAdapter(failAPI);
      const onStatusChange = vi.fn();

      await expect(
        adapter.connect(
          { host: '8.8.8.8', username: 'user' },
          'direct',
          vi.fn(),
          onStatusChange,
        ),
      ).rejects.toThrow('Connection failed');

      expect(onStatusChange).toHaveBeenCalledWith('connecting');
      expect(onStatusChange).toHaveBeenCalledWith('error');
    });

    it('disconnect cleans up session', async () => {
      const adapter = await loadAdapter(mockElectronAPI);

      const result = await adapter.connect(
        { host: '8.8.8.8', username: 'user' },
        'direct',
        vi.fn(),
        vi.fn(),
      );

      await result.disconnect();
      expect(mockElectronAPI.ssh.disconnect).toHaveBeenCalled();
    });
  });

  describe('send', () => {
    it('throws when electronAPI not available', async () => {
      const adapter = await loadAdapter(undefined);
      await expect(adapter.send('session-1', 'ls')).rejects.toThrow('Electron SSH not available');
    });

    it('sends data via electronAPI', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      await adapter.send('session-1', 'ls -la');
      expect(mockElectronAPI.ssh.send).toHaveBeenCalledWith('session-1', 'ls -la');
    });
  });

  describe('resize', () => {
    it('throws when electronAPI not available', async () => {
      const adapter = await loadAdapter(undefined);
      await expect(adapter.resize('session-1', 80, 24)).rejects.toThrow('Electron SSH not available');
    });

    it('resizes via electronAPI', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      await adapter.resize('session-1', 120, 40);
      expect(mockElectronAPI.ssh.resize).toHaveBeenCalledWith('session-1', 120, 40);
    });
  });

  describe('disconnect', () => {
    it('does not throw when session does not exist', async () => {
      const adapter = await loadAdapter(mockElectronAPI);
      await expect(adapter.disconnect('nonexistent')).resolves.toBeUndefined();
    });

    it('disconnects existing session', async () => {
      const adapter = await loadAdapter(mockElectronAPI);

      const result = await adapter.connect(
        { host: '8.8.8.8', username: 'user' },
        'direct',
        vi.fn(),
        vi.fn(),
      );

      await adapter.disconnect(result.sessionId);
      expect(mockElectronAPI.ssh.disconnect).toHaveBeenCalledWith(result.sessionId);
    });
  });
});
