-- Phase 17: Real E2E vault encryption (was previously a no-op stub on the client).
-- Each user has an X25519 keypair; the private key is encrypted with a key derived
-- (Argon2id) from a per-user "vault master password" and never leaves the client in
-- plaintext. Each vault has a random DEK used to encrypt entries (XChaCha20-Poly1305);
-- the DEK is sealed (crypto_box_seal) to each authorized user's public key so the
-- server only ever stores ciphertext it cannot decrypt.

CREATE TABLE IF NOT EXISTS user_vault_keys (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  private_key_nonce TEXT NOT NULL,
  kdf_salt TEXT NOT NULL,
  kdf_params JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Owner's own sealed copy of the vault DEK (vault_shares.encrypted_master_key already
-- exists for grantee copies, but the owner isn't a row in vault_shares).
ALTER TABLE vaults ADD COLUMN IF NOT EXISTS owner_wrapped_dek TEXT;
