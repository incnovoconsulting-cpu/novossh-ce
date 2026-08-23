import { isPrivateIPRange, isTailscaleIP } from '../lib/networkValidation';

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

declare global {
  interface Window {
    electronAPI?: {
      ssh?: {
        connect: (sessionId: string, msg: any) => Promise<{ status: string }>;
        send: (sessionId: string, data: string) => Promise<void>;
        resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
        disconnect: (sessionId: string) => Promise<void>;
        onData: (sessionId: string, cb: (data: string) => void) => () => void;
        onClosed: (sessionId: string, cb: () => void) => () => void;
      };
    };
  }
}

export type ConnectionType = 'direct' | 'relay' | 'tailscale';

export interface SSHConnectionOptions {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  certificate?: string;
  cols?: number;
  rows?: number;
  term?: string;
}

interface Session {
  sessionId: string;
  connectionType: ConnectionType;
  unsubscribeData: () => void;
  unsubscribeClosed: () => void;
}

class ElectronSSHAdapter {
  private sessions = new Map<string, Session>();
  private isElectron = typeof window !== 'undefined' && !!window.electronAPI?.ssh;

  isAvailable(): boolean {
    return this.isElectron;
  }

  determineConnectionType(
    host: string,
    connectionMode: string | undefined,
  ): ConnectionType {
    if (!this.isElectron) return 'relay';

    const isTailscale = isTailscaleIP(host);
    const isPrivate = isPrivateIPRange(host);

    // Tailscale always routes through local tunnel
    if (connectionMode === 'tailscale' && isTailscale) {
      return 'tailscale';
    }

    // Direct to public or Tailscale
    if (connectionMode === 'direct' && (isTailscale || !isPrivate)) {
      return 'direct';
    }

    // Fallback to relay
    return 'relay';
  }

  async connect(
    opts: SSHConnectionOptions,
    connectionMode: string | undefined,
    onData: (data: string) => void,
    onStatusChange: (status: 'connecting' | 'connected' | 'error' | 'disconnected') => void,
  ): Promise<{
    sessionId: string;
    connectionType: ConnectionType;
    disconnect: () => Promise<void>;
  }> {
    const sessionId = generateSessionId();
    const connectionType = this.determineConnectionType(opts.host, connectionMode);

    // Relay always uses WebSocket (handled by TerminalPane)
    if (connectionType === 'relay') {
      throw new Error(
        'Relay mode not supported by ElectronSSHAdapter. Use WebSocket-based connection.',
      );
    }

    if (!this.isElectron || !window.electronAPI?.ssh) {
      throw new Error('Electron SSH not available');
    }

    const ssh = window.electronAPI.ssh;

    try {
      onStatusChange('connecting');

      // For Tailscale, connect through local tunnel
      const connectMsg = {
        ...opts,
        host: connectionType === 'tailscale' ? '127.0.0.1' : opts.host,
        port: connectionType === 'tailscale' ? 2222 : opts.port,
      };

      await ssh.connect(sessionId, connectMsg);

      onStatusChange('connected');

      const unsubscribeData = ssh.onData(sessionId, onData);
      const unsubscribeClosed = ssh.onClosed(sessionId, () => {
        onStatusChange('disconnected');
        const session = this.sessions.get(sessionId);
        if (session) {
          session.unsubscribeData();
          session.unsubscribeClosed();
          this.sessions.delete(sessionId);
        }
      });

      const session: Session = {
        sessionId,
        connectionType,
        unsubscribeData,
        unsubscribeClosed,
      };

      this.sessions.set(sessionId, session);

      return {
        sessionId,
        connectionType,
        disconnect: async () => {
          const s = this.sessions.get(sessionId);
          if (s) {
            s.unsubscribeData();
            s.unsubscribeClosed();
            await ssh.disconnect(sessionId);
            this.sessions.delete(sessionId);
          }
        },
      };
    } catch (err) {
      onStatusChange('error');
      this.sessions.delete(sessionId);
      throw err;
    }
  }

  async send(sessionId: string, data: string): Promise<void> {
    if (!this.isElectron || !window.electronAPI?.ssh) {
      throw new Error('Electron SSH not available');
    }
    return window.electronAPI.ssh.send(sessionId, data);
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    if (!this.isElectron || !window.electronAPI?.ssh) {
      throw new Error('Electron SSH not available');
    }
    return window.electronAPI.ssh.resize(sessionId, cols, rows);
  }

  async disconnect(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.unsubscribeData();
      session.unsubscribeClosed();
      this.sessions.delete(sessionId);
    }

    if (this.isElectron && window.electronAPI?.ssh) {
      return window.electronAPI.ssh.disconnect(sessionId);
    }
  }
}

export const electronSSHAdapter = new ElectronSSHAdapter();
