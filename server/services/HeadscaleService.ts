/**
 * HeadscaleService
 * Integration with self-hosted headscale (Tailscale coordination server)
 * Manages user registration, pre-auth key generation, and node queries
 */

const HEADSCALE_URL = process.env.HEADSCALE_URL || 'http://localhost:8080';
const HEADSCALE_API_KEY = process.env.HEADSCALE_API_KEY || '';

interface HeadscaleUser {
  id: number;
  name: string;
  createdAt: string;
}

interface HeadscaleNode {
  id: number;
  name: string;
  ipAddresses: string[];
  user: { name: string };
  online: boolean;
  lastSeen?: string;
}

interface PreAuthKeyResponse {
  preAuthKey?: {
    key: string;
    expiration?: string;
    reusable?: boolean;
    ephemeral?: boolean;
  };
  key?: string;
}

async function headscaleFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${HEADSCALE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${HEADSCALE_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Headscale API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export class HeadscaleService {
  /**
   * Create a user in headscale when NovoSSH user signs up
   */
  async createUser(name: string): Promise<HeadscaleUser> {
    return headscaleFetch<HeadscaleUser>('/api/v1/user', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  /**
   * Get user by name
   */
  async getUser(name: string): Promise<HeadscaleUser | null> {
    try {
      const data = await headscaleFetch<{ users: HeadscaleUser[] }>('/api/v1/user');
      return data.users?.find(u => u.name === name) || null;
    } catch {
      return null;
    }
  }

  /**
   * Generate a pre-auth key for a user.
   * Keys are one-shot (reusable: false) and ephemeral (auto-removed when offline).
   * The userId must come from the verified JWT, never from client input.
   */
  async generateAuthKey(userName: string): Promise<string> {
    // Headscale usernames cannot start with a number, so prefix UUIDs
    const hsName = `u-${userName.replace(/[^a-zA-Z0-9-]/g, '')}`;
    let user = await this.getUser(hsName);
    if (!user) {
      // Auto-create user in Headscale if not found
      user = await this.createUser(hsName);
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const response = await headscaleFetch<PreAuthKeyResponse>(
      '/api/v1/preauthkey',
      {
        method: 'POST',
        body: JSON.stringify({
          user: user.id,
          expiration: expiresAt,
          reusable: false,
          ephemeral: true,
        }),
      }
    );

    return response.preAuthKey?.key ?? response.key ?? '';
  }

  /**
   * List all nodes in the network
   */
  async getNodes(): Promise<HeadscaleNode[]> {
    const data = await headscaleFetch<{ nodes: HeadscaleNode[] }>('/api/v1/node');
    return data.nodes ?? [];
  }

  /**
   * Get a specific user's Tailscale IP
   */
  async getNodeIP(userName: string): Promise<string> {
    const hsName = `u-${userName.replace(/[^a-zA-Z0-9-]/g, '')}`;
    const nodes = await this.getNodes();
    const node = nodes.find(n => n.user?.name === hsName);
    return node?.ipAddresses?.[0] || '';
  }

  /**
   * Check if headscale is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      await headscaleFetch('/api/v1/user');
      return true;
    } catch {
      return false;
    }
  }
}

export const headscaleService = new HeadscaleService();
