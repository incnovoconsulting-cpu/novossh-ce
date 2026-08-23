import crypto from 'crypto';
import { getDb } from '../db/connection.js';

export interface VaultShare {
  id: string;
  vault_id: string;
  grantor_id: string;
  grantee_id?: string;
  access_level: string;
  share_token?: string;
  encrypted_master_key?: string;
  expires_at?: Date;
  created_at: Date;
  revoked_at?: Date;
}

export class ShareService {
  private db = getDb();

  async shareWithUser(
    vaultId: string,
    grantorId: string,
    granteeId: string,
    accessLevel: string
  ): Promise<VaultShare> {
    const result = await this.db`
      INSERT INTO vault_shares (vault_id, grantor_id, grantee_id, access_level)
      VALUES (${vaultId}, ${grantorId}, ${granteeId}, ${accessLevel})
      RETURNING *
    `;

    // Update vault is_shared flag
    await this.db`
      UPDATE vaults SET is_shared = true, updated_at = NOW()
      WHERE id = ${vaultId}
    `;

    return result[0] as VaultShare;
  }

  async generateShareLink(
    vaultId: string,
    grantorId: string,
    accessLevel: string,
    expiresIn?: number
  ): Promise<VaultShare> {
    const shareToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : null;

    const result = await this.db`
      INSERT INTO vault_shares (
        vault_id, grantor_id, access_level, share_token, expires_at
      )
      VALUES (${vaultId}, ${grantorId}, ${accessLevel}, ${shareToken}, ${expiresAt || null})
      RETURNING *
    `;

    // Update vault is_shared flag
    await this.db`
      UPDATE vaults SET is_shared = true, updated_at = NOW()
      WHERE id = ${vaultId}
    `;

    return result[0] as VaultShare;
  }

  async getShareByToken(shareToken: string): Promise<VaultShare | null> {
    const result = await this.db`
      SELECT * FROM vault_shares
      WHERE share_token = ${shareToken}
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    `;
    return result.length > 0 ? (result[0] as VaultShare) : null;
  }

  async listShares(vaultId: string): Promise<VaultShare[]> {
    const result = await this.db`
      SELECT * FROM vault_shares
      WHERE vault_id = ${vaultId} AND revoked_at IS NULL
      ORDER BY created_at DESC
    `;
    return result as unknown as VaultShare[];
  }

  async revokeShare(shareId: string): Promise<void> {
    await this.db`
      UPDATE vault_shares
      SET revoked_at = NOW()
      WHERE id = ${shareId}
    `;
  }

  async checkAccess(
    vaultId: string,
    userId: string
  ): Promise<{ hasAccess: boolean; accessLevel: string }> {
    // Check if user is owner
    const ownerCheck = await this.db`
      SELECT access_level FROM vaults WHERE id = ${vaultId} AND owner_id = ${userId}
    `;

    if (ownerCheck.length > 0) {
      return { hasAccess: true, accessLevel: 'owner' };
    }

    // Check if user has share
    const shareCheck = await this.db`
      SELECT access_level FROM vault_shares
      WHERE vault_id = ${vaultId}
      AND grantee_id = ${userId}
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    `;

    if (shareCheck.length > 0) {
      return {
        hasAccess: true,
        accessLevel: (shareCheck[0] as any).access_level,
      };
    }

    return { hasAccess: false, accessLevel: '' };
  }
}
