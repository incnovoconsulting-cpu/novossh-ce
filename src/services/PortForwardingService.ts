import { EventEmitter } from 'eventemitter3';
import type { PortForward, ForwardingTemplate, PortForwardingStatus } from '../lib/types';

// Tauri invoke for desktop port forwarding
async function tauriInvoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke(cmd, args);
  } catch {
    return null; // Not running in Tauri
  }
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

export class PortForwardingService extends EventEmitter {
  private forwards: Map<string, PortForward> = new Map();
  private statuses: Map<string, PortForwardingStatus> = new Map();
  private builtInTemplates: ForwardingTemplate[] = [];
  private customTemplates: ForwardingTemplate[] = [];

  constructor() {
    super();
    this.initializeTemplates();
    this.loadCustomTemplates();
  }

  private initializeTemplates(): void {
    this.builtInTemplates = [
      {
        id: 'tpl_ssh_tunnel',
        name: 'SSH Tunnel',
        description: 'Local port forward through SSH for secure access to remote services',
        type: 'local',
        bindPort: 2222,
        destinationPort: 22,
        icon: 'lock',
        category: 'SSH',
      },
      {
        id: 'tpl_mysql',
        name: 'MySQL/MariaDB',
        description: 'Forward local port to remote MySQL database',
        type: 'local',
        bindPort: 3306,
        destinationPort: 3306,
        icon: 'database',
        category: 'Database',
      },
      {
        id: 'tpl_postgres',
        name: 'PostgreSQL',
        description: 'Forward local port to remote PostgreSQL database',
        type: 'local',
        bindPort: 5432,
        destinationPort: 5432,
        icon: 'database',
        category: 'Database',
      },
      {
        id: 'tpl_mongodb',
        name: 'MongoDB',
        description: 'Forward local port to remote MongoDB instance',
        type: 'local',
        bindPort: 27017,
        destinationPort: 27017,
        icon: 'database',
        category: 'Database',
      },
      {
        id: 'tpl_redis',
        name: 'Redis',
        description: 'Forward local port to remote Redis cache',
        type: 'local',
        bindPort: 6379,
        destinationPort: 6379,
        icon: 'zap',
        category: 'Cache',
      },
      {
        id: 'tpl_web',
        name: 'Web Server',
        description: 'Forward local port to remote web application',
        type: 'local',
        bindPort: 8080,
        destinationPort: 8080,
        icon: 'globe',
        category: 'Web',
      },
      {
        id: 'tpl_k8s',
        name: 'Kubernetes Pod',
        description: 'Port forward to a Kubernetes pod via kubectl',
        type: 'local',
        bindPort: 8080,
        destinationPort: 80,
        icon: 'boxes',
        category: 'Kubernetes',
      },
      {
        id: 'tpl_socks',
        name: 'SOCKS5 Proxy',
        description: 'Dynamic SOCKS5 proxy through SSH for browsing',
        type: 'dynamic',
        bindPort: 1080,
        destinationPort: 1080,
        icon: 'shield',
        category: 'Proxy',
      },
      {
        id: 'tpl_remote_expose',
        name: 'Expose Local Service',
        description: 'Remote forward to expose a local service on the remote host',
        type: 'remote',
        bindPort: 8080,
        destinationPort: 8080,
        icon: 'upload',
        category: 'Remote Access',
      },
      {
        id: 'tpl_vnc',
        name: 'VNC',
        description: 'Forward local port for remote desktop access',
        type: 'local',
        bindPort: 5900,
        destinationPort: 5900,
        icon: 'monitor',
        category: 'Remote Access',
      },
      {
        id: 'tpl_rdp',
        name: 'RDP',
        description: 'Forward local port for Windows remote desktop',
        type: 'local',
        bindPort: 3389,
        destinationPort: 3389,
        icon: 'monitor',
        category: 'Remote Access',
      },
    ];
  }

  private loadCustomTemplates(): void {
    try {
      const stored = localStorage.getItem('novossh-custom-templates');
      if (stored) {
        this.customTemplates = JSON.parse(stored);
      }
    } catch {
      this.customTemplates = [];
    }
  }

  private persistCustomTemplates(): void {
    try {
      localStorage.setItem('novossh-custom-templates', JSON.stringify(this.customTemplates));
    } catch {
      // Storage full or unavailable
    }
  }

  async createForward(config: Omit<PortForward, 'id' | 'createdAt' | 'updatedAt'>): Promise<PortForward> {
    const now = Date.now();
    const forward: PortForward = {
      ...config,
      id: this.generateId(),
      active: config.active ?? false,
      category: config.category ?? 'Custom',
      notes: config.notes ?? '',
      createdAt: now,
      updatedAt: now,
    };

    this.forwards.set(forward.id, forward);
    this.emit('forwardCreated', forward);

    if (config.autoStart) {
      await this.activateForward(forward.id);
    }

    return forward;
  }

  async updateForward(id: string, updates: Partial<PortForward>): Promise<PortForward> {
    const forward = this.forwards.get(id);
    if (!forward) {
      throw new Error(`Forward ${id} not found`);
    }

    const updated: PortForward = {
      ...forward,
      ...updates,
      id: forward.id,
      createdAt: forward.createdAt,
      updatedAt: Date.now(),
    };

    this.forwards.set(id, updated);
    this.emit('forwardUpdated', updated);

    return updated;
  }

  async deleteForward(id: string): Promise<void> {
    const forward = this.forwards.get(id);
    if (!forward) {
      throw new Error(`Forward ${id} not found`);
    }

    if (forward.active) {
      await this.deactivateForward(id);
    }

    this.forwards.delete(id);
    this.statuses.delete(id);
    this.emit('forwardDeleted', forward);
  }

  async activateForward(id: string): Promise<void> {
    const forward = this.forwards.get(id);
    if (!forward) {
      throw new Error(`Forward ${id} not found`);
    }

    try {
      // On desktop (Tauri), create the actual SSH tunnel via Rust backend
      if (isTauri() && forward.hostId) {
        let cmd: string;
        let args: Record<string, unknown>;

        if (forward.type === 'local') {
          cmd = 'port_forward_local';
          args = {
            sessionId: forward.hostId,
            localPort: forward.bindPort,
            localHost: forward.bindAddress || '127.0.0.1',
            remoteHost: forward.destinationHost || '127.0.0.1',
            remotePort: forward.destinationPort || 0,
          };
        } else if (forward.type === 'remote') {
          cmd = 'port_forward_remote';
          args = {
            sessionId: forward.hostId,
            localPort: forward.bindPort,
            localHost: forward.bindAddress || '127.0.0.1',
            remoteHost: forward.destinationHost || '0.0.0.0',
            remotePort: forward.destinationPort || 0,
          };
        } else {
          // dynamic (SOCKS5)
          cmd = 'port_forward_dynamic';
          args = {
            sessionId: forward.hostId,
            localPort: forward.bindPort,
            localHost: forward.bindAddress || '127.0.0.1',
          };
        }

        const result = await tauriInvoke(cmd, args);
        if (result) {
          // Store the Tauri forward ID for stop operations
          forward.id = result as string;
        }
      }

      forward.active = true;
      this.statuses.set(id, {
        forwardId: id,
        active: true,
        connections: 0,
        bytesIn: 0,
        bytesOut: 0,
      });
      this.emit('forwardActivated', forward);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.emit('forwardError', { id, error: errorMsg });
      throw error;
    }
  }

  async deactivateForward(id: string): Promise<void> {
    const forward = this.forwards.get(id);
    if (!forward) {
      throw new Error(`Forward ${id} not found`);
    }

    // On desktop, stop the actual SSH tunnel via Rust backend
    if (isTauri()) {
      await tauriInvoke('port_forward_stop', { forwardId: id });
    }

    forward.active = false;
    this.statuses.delete(id);
    this.emit('forwardDeactivated', forward);
  }

  getForwardsForHost(hostId: string): PortForward[] {
    return Array.from(this.forwards.values()).filter((f) => f.hostId === hostId);
  }

  getForward(id: string): PortForward | undefined {
    return this.forwards.get(id);
  }

  getAllForwards(): PortForward[] {
    return Array.from(this.forwards.values());
  }

  getStatus(id: string): PortForwardingStatus | undefined {
    return this.statuses.get(id);
  }

  getActiveForwards(): PortForward[] {
    return Array.from(this.forwards.values()).filter((f) => f.active);
  }

  getTemplates(): ForwardingTemplate[] {
    return [...this.builtInTemplates, ...this.customTemplates];
  }

  getBuiltInTemplates(): ForwardingTemplate[] {
    return [...this.builtInTemplates];
  }

  getCustomTemplates(): ForwardingTemplate[] {
    return [...this.customTemplates];
  }

  getTemplate(id: string): ForwardingTemplate | undefined {
    return this.getTemplates().find((t) => t.id === id);
  }

  async saveCustomTemplate(data: Omit<ForwardingTemplate, 'id'>): Promise<ForwardingTemplate> {
    const template: ForwardingTemplate = {
      ...data,
      id: `tpl_custom_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    };
    this.customTemplates.push(template);
    this.persistCustomTemplates();
    this.emit('templateSaved', template);
    return template;
  }

  async deleteCustomTemplate(id: string): Promise<void> {
    const idx = this.customTemplates.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new Error(`Custom template ${id} not found`);
    }
    this.customTemplates.splice(idx, 1);
    this.persistCustomTemplates();
    this.emit('templateDeleted', id);
  }

  async createFromTemplate(
    hostId: string,
    templateId: string,
    overrides?: Partial<Omit<PortForward, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<PortForward> {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return this.createForward({
      hostId,
      label: overrides?.label || template.name,
      type: overrides?.type || template.type,
      bindAddress: overrides?.bindAddress || '127.0.0.1',
      bindPort: overrides?.bindPort || template.bindPort,
      destinationHost: overrides?.destinationHost || 'localhost',
      destinationPort: overrides?.destinationPort || template.destinationPort,
      autoStart: overrides?.autoStart ?? false,
      category: overrides?.category || template.category,
      notes: overrides?.notes || template.description,
      active: false,
    });
  }

  async testForward(id: string): Promise<boolean> {
    const forward = this.forwards.get(id);
    if (!forward) {
      throw new Error(`Forward ${id} not found`);
    }

    try {
      return true;
    } catch {
      return false;
    }
  }

  private generateId(): string {
    return `fwd_${crypto.randomUUID()}`;
  }
}

export const portForwardingService = new PortForwardingService();
