import { getDb } from '../db/connection.js';

export interface UserVaultKey {
  user_id: string;
  public_key: string;
  encrypted_private_key: string;
  private_key_nonce: string;
  kdf_salt: string;
  kdf_params: { iterations: number; memory: number; parallelism: number };
  created_at: Date;
}

/**
 * Stores opaque key material only. The server never sees a private key,
 * a vault DEK, or any vault master password — every value here is either
 * a public key or something already encrypted client-side.
 */
export class VaultKeyService {
  private db = getDb();

  async registerKey(
    userId: string,
    publicKey: string,
    encryptedPrivateKey: string,
    privateKeyNonce: string,
    kdfSalt: string,
    kdfParams: { iterations: number; memory: number; parallelism: number }
  ): Promise<UserVaultKey> {
    const result = await this.db`
      INSERT INTO user_vault_keys (user_id, public_key, encrypted_private_key, private_key_nonce, kdf_salt, kdf_params)
      VALUES (${userId}, ${publicKey}, ${encryptedPrivateKey}, ${privateKeyNonce}, ${kdfSalt}, ${this.db.json(kdfParams)})
      ON CONFLICT (user_id) DO UPDATE SET
        public_key = EXCLUDED.public_key,
        encrypted_private_key = EXCLUDED.encrypted_private_key,
        private_key_nonce = EXCLUDED.private_key_nonce,
        kdf_salt = EXCLUDED.kdf_salt,
        kdf_params = EXCLUDED.kdf_params
      RETURNING *
    `;
    return result[0] as UserVaultKey;
  }

  async getKey(userId: string): Promise<UserVaultKey | null> {
    const result = await this.db`
      SELECT * FROM user_vault_keys WHERE user_id = ${userId}
    `;
    return result.length > 0 ? (result[0] as UserVaultKey) : null;
  }

  async getPublicKey(userId: string): Promise<string | null> {
    const result = await this.db`
      SELECT public_key FROM user_vault_keys WHERE user_id = ${userId}
    `;
    return result.length > 0 ? (result[0] as any).public_key : null;
  }

  async setOwnerWrappedDek(vaultId: string, wrappedDek: string): Promise<void> {
    await this.db`
      UPDATE vaults SET owner_wrapped_dek = ${wrappedDek} WHERE id = ${vaultId}
    `;
  }

  async getOwnerWrappedDek(vaultId: string): Promise<string | null> {
    const result = await this.db`
      SELECT owner_wrapped_dek FROM vaults WHERE id = ${vaultId}
    `;
    return result.length > 0 ? (result[0] as any).owner_wrapped_dek : null;
  }

  async setShareWrappedDek(shareId: string, wrappedDek: string): Promise<void> {
    await this.db`
      UPDATE vault_shares SET encrypted_master_key = ${wrappedDek} WHERE id = ${shareId}
    `;
  }

  async getWrappedDekForUser(vaultId: string, userId: string): Promise<{ source: 'owner' | 'share'; wrappedDek: string } | null> {
    const owner = await this.db`
      SELECT owner_wrapped_dek FROM vaults WHERE id = ${vaultId} AND owner_id = ${userId}
    `;
    if (owner.length > 0 && (owner[0] as any).owner_wrapped_dek) {
      return { source: 'owner', wrappedDek: (owner[0] as any).owner_wrapped_dek };
    }
    const share = await this.db`
      SELECT encrypted_master_key FROM vault_shares
      WHERE vault_id = ${vaultId} AND grantee_id = ${userId} AND revoked_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `;
    if (share.length > 0 && (share[0] as any).encrypted_master_key) {
      return { source: 'share', wrappedDek: (share[0] as any).encrypted_master_key };
    }
    return null;
  }
}
