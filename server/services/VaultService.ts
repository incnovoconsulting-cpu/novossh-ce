import { getDb } from '../db/connection.js';

export interface Vault {
  id: string;
  organization_id: string;
  owner_id: string;
  name: string;
  description?: string;
  encryption_algorithm: string;
  key_derivation_algorithm: string;
  last_modified_at: Date;
  version: number;
  is_deleted: boolean;
  is_shared: boolean;
  default_access_level: string;
  created_at: Date;
  updated_at: Date;
}

export interface VaultEntry {
  id: string;
  vault_id: string;
  type: string;
  name: string;
  encrypted_data: string;
  local_version: number;
  device_sync_id?: string;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
  synced_at?: Date;
}

export class VaultService {
  private db = getDb();

  async createVault(
    organizationId: string,
    ownerId: string,
    name: string,
    description?: string
  ): Promise<Vault> {
    const result = await this.db`
      INSERT INTO vaults (organization_id, owner_id, name, description)
      VALUES (${organizationId}, ${ownerId}, ${name}, ${description || null})
      RETURNING *
    `;
    return result[0] as Vault;
  }

  async getVault(vaultId: string): Promise<Vault | null> {
    const result = await this.db`
      SELECT * FROM vaults WHERE id = ${vaultId} AND is_deleted = false
    `;
    return result.length > 0 ? (result[0] as Vault) : null;
  }

  async listVaults(organizationId: string, ownerId?: string): Promise<Vault[]> {
    const query = ownerId
      ? this.db`
          SELECT * FROM vaults
          WHERE organization_id = ${organizationId}
          AND (owner_id = ${ownerId} OR id IN (
            SELECT vault_id FROM vault_shares
            WHERE grantee_id = ${ownerId} AND revoked_at IS NULL
          ))
          AND is_deleted = false
          ORDER BY updated_at DESC
        `
      : this.db`
          SELECT * FROM vaults
          WHERE organization_id = ${organizationId}
          AND is_deleted = false
          ORDER BY updated_at DESC
        `;
    return query as unknown as Promise<Vault[]>;
  }

  async updateVault(vaultId: string, updates: Partial<Vault>): Promise<Vault> {
    const { name, description } = updates;
    const result = await this.db`
      UPDATE vaults
      SET
        name = ${name || this.db`name`},
        description = ${description || this.db`description`},
        version = version + 1,
        updated_at = NOW()
      WHERE id = ${vaultId}
      RETURNING *
    `;
    return result[0] as Vault;
  }

  async deleteVault(vaultId: string): Promise<void> {
    await this.db`
      UPDATE vaults
      SET is_deleted = true, updated_at = NOW()
      WHERE id = ${vaultId}
    `;
  }

  async createEntry(
    vaultId: string,
    type: string,
    name: string,
    encryptedData: string,
    deviceSyncId?: string
  ): Promise<VaultEntry> {
    const result = await this.db`
      INSERT INTO vault_entries (vault_id, type, name, encrypted_data, device_sync_id)
      VALUES (${vaultId}, ${type}, ${name}, ${encryptedData}, ${deviceSyncId || null})
      RETURNING *
    `;

    await this.db`
      UPDATE vaults SET last_modified_at = NOW(), updated_at = NOW()
      WHERE id = ${vaultId}
    `;

    return result[0] as VaultEntry;
  }

  async getEntry(entryId: string): Promise<VaultEntry | null> {
    const result = await this.db`
      SELECT * FROM vault_entries WHERE id = ${entryId} AND is_deleted = false
    `;
    return result.length > 0 ? (result[0] as VaultEntry) : null;
  }

  async listEntries(vaultId: string): Promise<VaultEntry[]> {
    const result = await this.db`
      SELECT * FROM vault_entries
      WHERE vault_id = ${vaultId} AND is_deleted = false
      ORDER BY created_at DESC
    `;
    return result as unknown as VaultEntry[];
  }

  async updateEntry(
    entryId: string,
    name: string,
    encryptedData: string,
    localVersion: number,
    deviceSyncId?: string
  ): Promise<VaultEntry> {
    const result = await this.db`
      UPDATE vault_entries
      SET
        name = ${name},
        encrypted_data = ${encryptedData},
        local_version = ${localVersion},
        device_sync_id = ${deviceSyncId || this.db`device_sync_id`},
        updated_at = NOW()
      WHERE id = ${entryId}
      RETURNING *
    `;

    if (result.length > 0) {
      const entry = result[0] as VaultEntry;
      await this.db`
        UPDATE vaults SET last_modified_at = NOW(), updated_at = NOW()
        WHERE id = ${entry.vault_id}
      `;
    }

    return result[0] as VaultEntry;
  }

  async deleteEntry(entryId: string): Promise<void> {
    const entry = await this.getEntry(entryId);
    if (entry) {
      await Promise.all([
        this.db`
          UPDATE vault_entries
          SET is_deleted = true, updated_at = NOW()
          WHERE id = ${entryId}
        `,
        this.db`
          UPDATE vaults SET last_modified_at = NOW(), updated_at = NOW()
          WHERE id = ${entry.vault_id}
        `,
      ]);
    }
  }

  /**
   * Batch load entries for multiple vaults in a single query
   * Avoids N+1 problem when loading entries for many vaults
   */
  async batchLoadEntries(vaultIds: string[]): Promise<Map<string, VaultEntry[]>> {
    if (vaultIds.length === 0) {
      return new Map();
    }

    const result = await this.db`
      SELECT * FROM vault_entries
      WHERE vault_id = ANY(${vaultIds})
      AND is_deleted = false
      ORDER BY created_at DESC
    `;

    const map = new Map<string, VaultEntry[]>();
    for (const vaultId of vaultIds) {
      map.set(vaultId, []);
    }

    for (const entry of result as unknown as VaultEntry[]) {
      const entries = map.get(entry.vault_id) || [];
      entries.push(entry);
      map.set(entry.vault_id, entries);
    }

    return map;
  }

  async bulkCreateEntries(
    vaultId: string,
    entries: Array<{ type: string; name: string; encryptedData: string; deviceSyncId?: string }>
  ): Promise<VaultEntry[]> {
    if (entries.length === 0) {
      return [];
    }

    const result = await this.db`
      INSERT INTO vault_entries (vault_id, type, name, encrypted_data, device_sync_id)
      VALUES ${this.db(entries.map(e => [vaultId, e.type, e.name, e.encryptedData, e.deviceSyncId || null]) as any)}
      RETURNING *
    `;

    await this.db`
      UPDATE vaults SET last_modified_at = NOW(), updated_at = NOW()
      WHERE id = ${vaultId}
    `;

    return result as unknown as VaultEntry[];
  }
}
