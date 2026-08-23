-- Phase 2: Cloud Sync & Vault System - Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Vaults: Container for encrypted data
CREATE TABLE IF NOT EXISTS vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Encryption metadata (not the key itself)
  encryption_algorithm VARCHAR(50) DEFAULT 'xchacha20-poly1305',
  key_derivation_algorithm VARCHAR(50) DEFAULT 'argon2id',

  -- Sync metadata
  last_modified_at TIMESTAMP DEFAULT NOW(),
  version INT DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,

  -- Access control
  is_shared BOOLEAN DEFAULT FALSE,
  default_access_level VARCHAR(50) DEFAULT 'owner',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vaults_org_id ON vaults(organization_id);
CREATE INDEX IF NOT EXISTS idx_vaults_owner_id ON vaults(owner_id);
CREATE INDEX IF NOT EXISTS idx_vaults_is_deleted ON vaults(is_deleted);

-- Vault Entries: Individual encrypted items in vault
CREATE TABLE IF NOT EXISTS vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,

  -- Entry metadata
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,

  -- Encrypted data (stored as base64 ciphertext)
  encrypted_data TEXT NOT NULL,

  -- Sync metadata
  local_version INT DEFAULT 1,
  device_sync_id VARCHAR(255),

  is_deleted BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vault_entries_vault_id ON vault_entries(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_entries_updated_at ON vault_entries(updated_at);

-- Vault Shares: Grant access to other users
CREATE TABLE IF NOT EXISTS vault_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  grantor_id UUID NOT NULL,
  grantee_id UUID,

  -- Share metadata
  access_level VARCHAR(50) NOT NULL,
  share_token VARCHAR(255) UNIQUE,

  -- Encryption key sharing
  encrypted_master_key TEXT,

  -- Expiration
  expires_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vault_shares_vault_id ON vault_shares(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_shares_grantee_id ON vault_shares(grantee_id);
CREATE INDEX IF NOT EXISTS idx_vault_shares_share_token ON vault_shares(share_token);

-- Sync Logs: Track changes for conflict resolution
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  device_id VARCHAR(255) NOT NULL,

  -- Change metadata
  operation VARCHAR(50) NOT NULL,
  entry_id UUID,
  previous_version INT,
  new_version INT,

  -- Conflict detection
  has_conflict BOOLEAN DEFAULT FALSE,
  conflicting_device_id VARCHAR(255),
  resolution_strategy VARCHAR(50),

  -- Timestamp for ordering
  operation_timestamp TIMESTAMP NOT NULL,
  logged_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_vault_id ON sync_logs(vault_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_operation_timestamp ON sync_logs(operation_timestamp);

-- Encryption Keys: Store user key derivation parameters
CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,

  -- Key derivation (never store the actual key)
  kdf_algorithm VARCHAR(50),
  kdf_params JSONB,
  salt VARCHAR(255) NOT NULL,

  -- Encryption state
  is_active BOOLEAN DEFAULT TRUE,
  can_derive_keys BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  rotated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_encryption_keys_user_id ON encryption_keys(user_id);

-- Audit Log (for compliance)
CREATE TABLE IF NOT EXISTS vault_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  vault_id UUID,
  user_id UUID,

  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_audit_logs_org_id ON vault_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_vault_audit_logs_vault_id ON vault_audit_logs(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_audit_logs_created_at ON vault_audit_logs(created_at);
