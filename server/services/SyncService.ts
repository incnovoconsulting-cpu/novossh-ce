import { getDb } from '../db/connection.js';

export interface SyncConflict {
  entryId: string;
  localVersion: number;
  remoteVersion: number;
  localTimestamp: Date;
  remoteTimestamp: Date;
  localDeviceId: string;
  remoteDeviceId: string;
}

export interface SyncLog {
  id: string;
  vault_id: string;
  user_id: string;
  device_id: string;
  operation: string;
  entry_id?: string;
  previous_version?: number;
  new_version?: number;
  has_conflict: boolean;
  conflicting_device_id?: string;
  resolution_strategy?: string;
  operation_timestamp: Date;
  logged_at: Date;
}

export class SyncService {
  private db = getDb();

  async recordChange(
    vaultId: string,
    userId: string,
    deviceId: string,
    operation: string,
    entryId?: string,
    previousVersion?: number,
    newVersion?: number
  ): Promise<SyncLog> {
    // Detect conflict within a transaction to prevent race conditions
    const result = await this.db.begin(async (sql) => {
      let hasConflict = false;
      let conflictingDeviceId: string | undefined;

      if (entryId && previousVersion != null) {
        const existing = await sql`
          SELECT device_id FROM sync_logs
          WHERE entry_id = ${entryId}
            AND previous_version = ${previousVersion}
            AND device_id != ${deviceId}
            AND has_conflict = false
          LIMIT 1
          FOR UPDATE
        `;
        if (existing.length > 0) {
          hasConflict = true;
          conflictingDeviceId = (existing[0] as any).device_id;
          const conflictDevice = conflictingDeviceId as string;
          const conflictEntry = entryId as string;
          const conflictVersion = previousVersion as number;
          await sql`
            UPDATE sync_logs
            SET has_conflict = true,
                conflicting_device_id = ${deviceId}
            WHERE entry_id = ${conflictEntry}
              AND previous_version = ${conflictVersion}
              AND device_id = ${conflictDevice}
              AND has_conflict = false
          `;
        }
      }

      const rows = await sql`
        INSERT INTO sync_logs (
          vault_id, user_id, device_id, operation, entry_id,
          previous_version, new_version, has_conflict, conflicting_device_id,
          operation_timestamp
        )
        VALUES (
          ${vaultId}, ${userId}, ${deviceId}, ${operation}, ${entryId || null},
          ${previousVersion || null}, ${newVersion || null},
          ${hasConflict}, ${conflictingDeviceId || null},
          NOW()
        )
        RETURNING *
      `;
      return rows[0] as SyncLog;
    });

    return result;
  }

  async getChanges(vaultId: string, since: Date): Promise<SyncLog[]> {
    const result = await this.db`
      SELECT * FROM sync_logs
      WHERE vault_id = ${vaultId} AND operation_timestamp > ${since}
      ORDER BY operation_timestamp ASC
    `;
    return result as unknown as SyncLog[];
  }

  async detectConflicts(vaultId: string): Promise<SyncConflict[]> {
    // Find entries where two different devices both modified from the same base version
    const result = await this.db`
      SELECT DISTINCT ON (sl1.entry_id)
        sl1.entry_id,
        sl1.new_version          AS local_version,
        sl2.new_version          AS remote_version,
        sl1.operation_timestamp  AS local_timestamp,
        sl2.operation_timestamp  AS remote_timestamp,
        sl1.device_id            AS local_device_id,
        sl2.device_id            AS remote_device_id
      FROM sync_logs sl1
      JOIN sync_logs sl2
        ON  sl1.entry_id         = sl2.entry_id
        AND sl1.device_id        != sl2.device_id
        AND sl1.previous_version  = sl2.previous_version
      WHERE sl1.vault_id    = ${vaultId}
        AND sl1.has_conflict = true
        AND sl1.entry_id    IS NOT NULL
        AND sl1.id           < sl2.id
      ORDER BY sl1.entry_id, sl1.operation_timestamp DESC
    `;

    return result.map((row: any) => ({
      entryId: row.entry_id,
      localVersion: row.local_version,
      remoteVersion: row.remote_version,
      localTimestamp: row.local_timestamp,
      remoteTimestamp: row.remote_timestamp,
      localDeviceId: row.local_device_id,
      remoteDeviceId: row.remote_device_id,
    }));
  }

  async resolveConflict(
    vaultId: string,
    entryId: string,
    strategy: 'local' | 'remote' | 'merge' | 'last-write-wins',
    winningEncryptedData?: string
  ): Promise<void> {
    // Mark all conflicting log rows for this entry as resolved
    await this.db`
      UPDATE sync_logs
      SET has_conflict = false,
          resolution_strategy = ${strategy}
      WHERE vault_id    = ${vaultId}
        AND entry_id    = ${entryId}
        AND has_conflict = true
    `;

    if (strategy === 'last-write-wins') {
      // Pick the row with the latest operation_timestamp and use its version
      const latest = await this.db`
        SELECT new_version FROM sync_logs
        WHERE vault_id = ${vaultId} AND entry_id = ${entryId}
        ORDER BY operation_timestamp DESC
        LIMIT 1
      `;
      if (latest.length > 0) {
        await this.db`
          UPDATE vault_entries
          SET local_version = ${(latest[0] as any).new_version},
              updated_at    = NOW()
          WHERE id = ${entryId}
        `;
      }
      return;
    }

    if ((strategy === 'local' || strategy === 'merge') && winningEncryptedData) {
      // Client sends the winning encrypted payload; write it to vault_entries
      await this.db`
        UPDATE vault_entries
        SET encrypted_data = ${winningEncryptedData},
            local_version  = local_version + 1,
            updated_at     = NOW(),
            synced_at      = NOW()
        WHERE id = ${entryId}
      `;
      return;
    }

    // strategy === 'remote': vault_entries already holds the server version; nothing to do
  }

  async getSyncStats(vaultId: string): Promise<{
    totalChanges: number;
    totalConflicts: number;
    resolvedConflicts: number;
    activeDevices: string[];
  }> {
    const changes = await this.db`
      SELECT COUNT(*) as count FROM sync_logs WHERE vault_id = ${vaultId}
    `;
    const conflicts = await this.db`
      SELECT COUNT(*) as count FROM sync_logs
      WHERE vault_id = ${vaultId} AND has_conflict = true
    `;
    const resolved = await this.db`
      SELECT COUNT(*) as count FROM sync_logs
      WHERE vault_id = ${vaultId} AND has_conflict = true AND resolution_strategy IS NOT NULL
    `;
    const devices = await this.db`
      SELECT DISTINCT device_id FROM sync_logs WHERE vault_id = ${vaultId}
    `;

    return {
      totalChanges: (changes[0] as any).count,
      totalConflicts: (conflicts[0] as any).count,
      resolvedConflicts: (resolved[0] as any).count,
      activeDevices: devices.map((d: any) => d.device_id),
    };
  }

  async markSynced(vaultId: string, entryIds: string[]): Promise<void> {
    if (entryIds.length === 0) return;
    await this.db`
      UPDATE vault_entries
      SET synced_at = NOW()
      WHERE vault_id = ${vaultId} AND id IN ${this.db(entryIds)}
    `;
  }
}
