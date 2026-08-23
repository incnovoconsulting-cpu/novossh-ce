-- Phase 11: Direct SSH Connection Support
-- Add connection type metadata to vault_entries for host entries

-- Add connection metadata columns to vault_entries
ALTER TABLE IF EXISTS vault_entries ADD COLUMN IF NOT EXISTS connection_type VARCHAR(20) DEFAULT 'relay';
ALTER TABLE IF EXISTS vault_entries ADD COLUMN IF NOT EXISTS connection_requires_relay BOOLEAN DEFAULT true;
ALTER TABLE IF EXISTS vault_entries ADD COLUMN IF NOT EXISTS connection_metadata JSONB;

-- Index for filtering hosts by connection type
CREATE INDEX IF NOT EXISTS idx_vault_entries_connection_type ON vault_entries(connection_type) WHERE type = 'host';

-- Track connection attempts and failures for fallback logic
CREATE TABLE IF NOT EXISTS connection_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES vault_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  device_id VARCHAR(255) NOT NULL,

  -- Attempt details
  connection_type VARCHAR(20) NOT NULL,
  target_host VARCHAR(255) NOT NULL,
  target_port INT NOT NULL,

  -- Result tracking
  success BOOLEAN,
  error_message TEXT,
  fallback_used BOOLEAN DEFAULT FALSE,
  fallback_type VARCHAR(20),

  -- Duration and performance
  duration_ms INT,

  -- Timestamps
  attempted_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_connection_attempts_entry_id ON connection_attempts(entry_id);
CREATE INDEX IF NOT EXISTS idx_connection_attempts_user_id ON connection_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_attempts_attempted_at ON connection_attempts(attempted_at);

-- Connection type hints for clients
CREATE TABLE IF NOT EXISTS connection_hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES vault_entries(id) ON DELETE CASCADE,

  -- Classification hints
  is_private_ip BOOLEAN,
  is_tailscale BOOLEAN,
  is_public BOOLEAN,

  -- Reachability info
  last_direct_success_at TIMESTAMP,
  last_direct_failure_at TIMESTAMP,
  consecutive_direct_failures INT DEFAULT 0,

  -- Recommendations
  recommended_mode VARCHAR(20),

  -- Timestamps
  last_classified_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connection_hints_entry_id ON connection_hints(entry_id);
CREATE INDEX IF NOT EXISTS idx_connection_hints_is_private_ip ON connection_hints(is_private_ip);
CREATE INDEX IF NOT EXISTS idx_connection_hints_is_tailscale ON connection_hints(is_tailscale);
