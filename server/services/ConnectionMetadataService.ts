import { getDb } from '../db/connection.js';

export interface ConnectionMetadata {
  clientType: 'web' | 'electron' | 'ios' | 'android';
  connectionMode: 'direct' | 'tailscale' | 'relay';
  supportsDirectConnection: boolean;
  requiresRelay: boolean;
}

export interface ConnectionHints {
  isPrivateIp: boolean;
  isTailscale: boolean;
  isPublic: boolean;
  recommendedMode: 'direct' | 'tailscale' | 'relay';
  lastDirectSuccess?: Date;
  lastDirectFailure?: Date;
  consecutiveDirectFailures: number;
}

export class ConnectionMetadataService {
  private db = getDb();

  async getConnectionMetadata(entryId: string): Promise<ConnectionMetadata | null> {
    try {
      const result = await this.db`
        SELECT connection_type, connection_requires_relay, connection_metadata
        FROM vault_entries WHERE id = ${entryId}
      `;

      if (result.length === 0) return null;

      const row = result[0] as any;
      return {
        clientType: row.connection_metadata?.clientType || 'web',
        connectionMode: row.connection_type || 'relay',
        supportsDirectConnection: row.connection_metadata?.supportsDirectConnection ?? true,
        requiresRelay: row.connection_requires_relay ?? true,
      };
    } catch (err) {
      console.error('Failed to get connection metadata:', err);
      return null;
    }
  }

  async updateConnectionMetadata(entryId: string, metadata: Partial<ConnectionMetadata>): Promise<void> {
    try {
      await this.db`
        UPDATE vault_entries
        SET connection_type = ${metadata.connectionMode || 'relay'},
            connection_requires_relay = ${metadata.requiresRelay ?? true},
            connection_metadata = ${JSON.stringify(metadata)}
        WHERE id = ${entryId}
      `;
    } catch (err) {
      console.error('Failed to update connection metadata:', err);
    }
  }

  async recordConnectionAttempt(
    entryId: string,
    userId: string,
    deviceId: string,
    connectionType: string,
    targetHost: string,
    targetPort: number,
    success: boolean,
    errorMessage?: string,
    fallbackUsed?: boolean,
    fallbackType?: string,
    durationMs?: number
  ): Promise<void> {
    try {
      await this.db`
        INSERT INTO connection_attempts
        (entry_id, user_id, device_id, connection_type, target_host, target_port,
         success, error_message, fallback_used, fallback_type, duration_ms, completed_at)
        VALUES (${entryId}, ${userId}, ${deviceId}, ${connectionType}, ${targetHost}, ${targetPort},
                ${success}, ${errorMessage || null}, ${fallbackUsed || false}, ${fallbackType || null},
                ${durationMs || null}, NOW())
      `;
    } catch (err) {
      console.error('Failed to record connection attempt:', err);
    }
  }

  async getConnectionHints(entryId: string): Promise<ConnectionHints | null> {
    try {
      const result = await this.db`
        SELECT is_private_ip, is_tailscale, is_public, recommended_mode,
               last_direct_success_at, last_direct_failure_at, consecutive_direct_failures
        FROM connection_hints WHERE entry_id = ${entryId}
      `;

      if (result.length === 0) return null;

      const row = result[0] as any;
      return {
        isPrivateIp: row.is_private_ip ?? false,
        isTailscale: row.is_tailscale ?? false,
        isPublic: row.is_public ?? false,
        recommendedMode: row.recommended_mode || 'relay',
        lastDirectSuccess: row.last_direct_success_at,
        lastDirectFailure: row.last_direct_failure_at,
        consecutiveDirectFailures: row.consecutive_direct_failures || 0,
      };
    } catch (err) {
      console.error('Failed to get connection hints:', err);
      return null;
    }
  }

  async updateConnectionHints(entryId: string, hints: Partial<ConnectionHints>): Promise<void> {
    try {
      await this.db`
        INSERT INTO connection_hints
        (entry_id, is_private_ip, is_tailscale, is_public, recommended_mode, consecutive_direct_failures, created_at, updated_at)
        VALUES (${entryId}, ${hints.isPrivateIp ?? false}, ${hints.isTailscale ?? false},
                ${hints.isPublic ?? false}, ${hints.recommendedMode || 'relay'},
                ${hints.consecutiveDirectFailures ?? 0}, NOW(), NOW())
        ON CONFLICT (entry_id) DO UPDATE SET
          is_private_ip = COALESCE(${hints.isPrivateIp ?? null}, connection_hints.is_private_ip),
          is_tailscale = COALESCE(${hints.isTailscale ?? null}, connection_hints.is_tailscale),
          is_public = COALESCE(${hints.isPublic ?? null}, connection_hints.is_public),
          recommended_mode = COALESCE(${hints.recommendedMode || null}, connection_hints.recommended_mode),
          consecutive_direct_failures = COALESCE(${hints.consecutiveDirectFailures ?? null}, connection_hints.consecutive_direct_failures),
          updated_at = NOW()
      `;
    } catch (err) {
      console.error('Failed to update connection hints:', err);
    }
  }

  async recordDirectConnectionSuccess(entryId: string): Promise<void> {
    try {
      await this.db`
        UPDATE connection_hints
        SET last_direct_success_at = NOW(),
            consecutive_direct_failures = 0,
            updated_at = NOW()
        WHERE entry_id = ${entryId}
      `;
    } catch (err) {
      console.error('Failed to record direct connection success:', err);
    }
  }

  async recordDirectConnectionFailure(entryId: string): Promise<void> {
    try {
      await this.db`
        UPDATE connection_hints
        SET last_direct_failure_at = NOW(),
            consecutive_direct_failures = COALESCE(consecutive_direct_failures, 0) + 1,
            updated_at = NOW()
        WHERE entry_id = ${entryId}
      `;
    } catch (err) {
      console.error('Failed to record direct connection failure:', err);
    }
  }

  async getRecentConnectionStats(entryId: string, days: number = 7) {
    try {
      const safeDays = Math.max(1, Math.min(days, 365));
      const result = await this.db`
        SELECT
          COUNT(*) as total_attempts,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_attempts,
          SUM(CASE WHEN fallback_used THEN 1 ELSE 0 END) as fallback_attempts,
          AVG(duration_ms) as avg_duration_ms,
          MAX(completed_at) as last_attempt
        FROM connection_attempts
        WHERE entry_id = ${entryId} AND attempted_at > NOW() - (${safeDays} * INTERVAL '1 day')
      `;

      if (result.length === 0) return null;
      return result[0];
    } catch (err) {
      console.error('Failed to get connection stats:', err);
      return null;
    }
  }
}

export const connectionMetadataService = new ConnectionMetadataService();
