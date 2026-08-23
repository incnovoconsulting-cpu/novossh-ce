import { EventEmitter } from 'events';

/**
 * Vault: Container for encrypted user data (credentials, keys, tokens, configs)
 */
export interface Vault {
  id: string;
  organizationId: string;
  ownerId: string;
  name: string;
  description?: string;
  encryptionAlgorithm: 'xchacha20-poly1305';
  keyDerivationAlgorithm: 'argon2id';
  lastModifiedAt: Date;
  version: number;
  isShared: boolean;
  defaultAccessLevel: 'owner' | 'editor' | 'viewer';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * VaultEntry: Individual encrypted item in a vault
 * Can be a password, SSH key, API token, or configuration
 */
export interface VaultEntry {
  id: string;
  vaultId: string;
  type: 'password' | 'key' | 'token' | 'config';
  name: string; // Encrypted name/label
  encryptedData: string; // Base64-encoded ciphertext
  localVersion: number; // For conflict resolution
  deviceSyncId?: string; // Device that last modified
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date;
}

/**
 * VaultShare: Grant access to another user
 */
export interface VaultShare {
  id: string;
  vaultId: string;
  grantorId: string;
  granteeId?: string; // NULL for shareable links
  accessLevel: 'viewer' | 'editor' | 'owner';
  shareToken?: string; // For anonymous shares
  encryptedMasterKey?: string; // Key encrypted with grantee's public key
  expiresAt?: Date;
  createdAt: Date;
  revokedAt?: Date;
}

/**
 * VaultService: Manages vault operations including CRUD, sharing, and permissions
 *
 * Events emitted:
 * - 'vaultCreated': When a new vault is created
 * - 'vaultUpdated': When a vault is modified
 * - 'vaultDeleted': When a vault is deleted
 * - 'entryCreated': When an entry is added
 * - 'entryUpdated': When an entry is modified
 * - 'entryDeleted': When an entry is deleted
 * - 'vaultShared': When vault is shared with a user
 * - 'shareRevoked': When access is revoked
 * - 'error': When an error occurs
 */
export class VaultService extends EventEmitter {
  private vaults = new Map<string, Vault>();
  private entries = new Map<string, VaultEntry[]>();
  private shares = new Map<string, VaultShare[]>();

  /**
   * Create a new vault
   */
  async createVault(vault: Omit<Vault, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Vault> {
    try {
      const newVault: Vault = {
        ...vault,
        id: this.generateId(),
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.vaults.set(newVault.id, newVault);
      this.emit('vaultCreated', newVault);

      return newVault;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get a vault by ID
   */
  async getVault(vaultId: string): Promise<Vault | null> {
    return this.vaults.get(vaultId) || null;
  }

  /**
   * List all vaults for an organization
   */
  async listVaults(organizationId: string): Promise<Vault[]> {
    return Array.from(this.vaults.values()).filter(
      (v) => v.organizationId === organizationId
    );
  }

  /**
   * Update a vault
   */
  async updateVault(vaultId: string, updates: Partial<Vault>): Promise<Vault> {
    const vault = this.vaults.get(vaultId);
    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    const updated: Vault = {
      ...vault,
      ...updates,
      id: vault.id, // Preserve ID
      organizationId: vault.organizationId, // Preserve org
      ownerId: vault.ownerId, // Preserve owner
      createdAt: vault.createdAt, // Preserve creation time
      version: updates.version ?? vault.version + 1,
      updatedAt: new Date(),
    };

    this.vaults.set(vaultId, updated);
    this.emit('vaultUpdated', updated);

    return updated;
  }

  /**
   * Delete a vault (soft delete)
   */
  async deleteVault(vaultId: string): Promise<void> {
    const vault = this.vaults.get(vaultId);
    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    // Clear entries and shares
    this.entries.delete(vaultId);
    this.shares.delete(vaultId);

    // Soft delete
    this.vaults.delete(vaultId);
    this.emit('vaultDeleted', vault);
  }

  /**
   * Add an entry to a vault
   */
  async createEntry(vaultId: string, entry: Omit<VaultEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<VaultEntry> {
    const vault = this.vaults.get(vaultId);
    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    const newEntry: VaultEntry = {
      ...entry,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!this.entries.has(vaultId)) {
      this.entries.set(vaultId, []);
    }
    this.entries.get(vaultId)!.push(newEntry);

    // Update vault version
    await this.updateVault(vaultId, { version: vault.version + 1 });
    this.emit('entryCreated', newEntry);

    return newEntry;
  }

  /**
   * Update an entry
   */
  async updateEntry(entryId: string, updates: Partial<VaultEntry>): Promise<VaultEntry> {
    // Find entry across all vaults
    let entry: VaultEntry | undefined;
    let vaultId: string | undefined;

    for (const [vid, entries] of this.entries.entries()) {
      const found = entries.find((e) => e.id === entryId);
      if (found) {
        entry = found;
        vaultId = vid;
        break;
      }
    }

    if (!entry || !vaultId) {
      throw new Error(`Entry not found: ${entryId}`);
    }

    const updated: VaultEntry = {
      ...entry,
      ...updates,
      id: entry.id, // Preserve ID
      vaultId: entry.vaultId, // Preserve vault
      createdAt: entry.createdAt, // Preserve creation time
      updatedAt: new Date(),
    };

    const vaultEntries = this.entries.get(vaultId)!;
    const index = vaultEntries.findIndex((e) => e.id === entryId);
    vaultEntries[index] = updated;

    // Update vault version
    const vault = this.vaults.get(vaultId)!;
    await this.updateVault(vaultId, { version: vault.version + 1 });
    this.emit('entryUpdated', updated);

    return updated;
  }

  /**
   * Delete an entry
   */
  async deleteEntry(entryId: string): Promise<void> {
    for (const [vaultId, entries] of this.entries.entries()) {
      const index = entries.findIndex((e) => e.id === entryId);
      if (index >= 0) {
        const entry = entries[index];
        entries.splice(index, 1);

        // Update vault version
        const vault = this.vaults.get(vaultId)!;
        await this.updateVault(vaultId, { version: vault.version + 1 });
        this.emit('entryDeleted', entry);
        return;
      }
    }

    throw new Error(`Entry not found: ${entryId}`);
  }

  /**
   * List entries in a vault
   */
  async listEntries(vaultId: string): Promise<VaultEntry[]> {
    const vault = this.vaults.get(vaultId);
    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    return this.entries.get(vaultId) || [];
  }

  /**
   * Share a vault with another user
   */
  async shareVault(
    vaultId: string,
    userId: string,
    accessLevel: 'viewer' | 'editor' | 'owner',
    grantorId: string
  ): Promise<VaultShare> {
    const vault = this.vaults.get(vaultId);
    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    const share: VaultShare = {
      id: this.generateId(),
      vaultId,
      grantorId,
      granteeId: userId,
      accessLevel,
      createdAt: new Date(),
    };

    if (!this.shares.has(vaultId)) {
      this.shares.set(vaultId, []);
    }
    this.shares.get(vaultId)!.push(share);

    // Update vault as shared
    await this.updateVault(vaultId, { isShared: true });
    this.emit('vaultShared', share);

    return share;
  }

  /**
   * Revoke access to a vault
   */
  async unshareVault(vaultId: string, userId: string): Promise<void> {
    const shares = this.shares.get(vaultId) || [];
    const index = shares.findIndex((s) => s.granteeId === userId);

    if (index < 0) {
      throw new Error(`Share not found for user: ${userId}`);
    }

    const share = shares[index];
    shares.splice(index, 1);

    this.emit('shareRevoked', share);
  }

  /**
   * List shares for a vault
   */
  async listShares(vaultId: string): Promise<VaultShare[]> {
    return this.shares.get(vaultId) || [];
  }

  /**
   * Generate a shareable link (anonymous share)
   */
  async createShareLink(
    vaultId: string,
    accessLevel: 'viewer' | 'editor',
    expiresIn?: number
  ): Promise<VaultShare> {
    const vault = this.vaults.get(vaultId);
    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    const share: VaultShare = {
      id: this.generateId(),
      vaultId,
      grantorId: vault.ownerId,
      shareToken: this.generateShareToken(),
      accessLevel,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
      createdAt: new Date(),
    };

    if (!this.shares.has(vaultId)) {
      this.shares.set(vaultId, []);
    }
    this.shares.get(vaultId)!.push(share);

    await this.updateVault(vaultId, { isShared: true });

    return share;
  }

  /**
   * Get share by token (for link-based access)
   */
  async getShareByToken(token: string): Promise<VaultShare | null> {
    for (const shares of this.shares.values()) {
      const share = shares.find((s) => s.shareToken === token);
      if (share) {
        // Check expiration
        if (share.expiresAt && new Date() > share.expiresAt) {
          return null;
        }
        return share;
      }
    }
    return null;
  }

  /**
   * Private helper to generate unique IDs
   */
  private generateId(): string {
    return `vault_${crypto.randomUUID()}`;
  }

  /**
   * Private helper to generate share tokens
   */
  private generateShareToken(): string {
    return `share_${crypto.randomUUID()}`;
  }
}
