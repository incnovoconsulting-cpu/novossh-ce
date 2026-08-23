-- Phase 13: Performance Indexes for Hot Query Paths

-- Composite index for vault filtering (org + ownership check)
CREATE INDEX IF NOT EXISTS idx_vaults_org_owner ON vaults(organization_id, owner_id);

-- Composite index for usage counting (user + resource type)
CREATE INDEX IF NOT EXISTS idx_usage_counts_user_resource ON usage_counts(user_id, resource_type);

-- Index for subscription lookups by user
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Composite index for participant checks (session + user)
CREATE INDEX IF NOT EXISTS idx_session_participants_session_user ON session_participants(session_id, user_id);

-- Composite index for sync conflict detection
CREATE INDEX IF NOT EXISTS idx_sync_logs_vault_device ON sync_logs(vault_id, device_id);

-- Index for connection attempt tracking
CREATE INDEX IF NOT EXISTS idx_connection_attempts_entry_time ON connection_attempts(entry_id, attempted_at);

-- Index for audit log queries (org + timestamp)
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_org_time ON team_audit_logs(organization_id, created_at DESC);

-- Index for session lookups by team
CREATE INDEX IF NOT EXISTS idx_sessions_team_created ON sessions(team_id, created_at DESC);

-- Index for vault entry searches (vault + updated)
CREATE INDEX IF NOT EXISTS idx_vault_entries_vault_updated ON vault_entries(vault_id, updated_at DESC);

-- Index for share access checks (grantee + vault)
CREATE INDEX IF NOT EXISTS idx_vault_shares_grantee_vault ON vault_shares(grantee_id, vault_id);
