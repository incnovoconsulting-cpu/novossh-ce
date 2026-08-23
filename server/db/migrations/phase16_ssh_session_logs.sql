-- Phase 16: SSH session logs for analytics
-- The existing `sessions` table is for multiplayer vault sessions (requires vault_id/team_id).
-- These tables track individual SSH terminal connections for the analytics dashboard.

CREATE TABLE IF NOT EXISTS ssh_session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  host_id TEXT,                          -- ssh_hosts.id (nullable: direct connections may not have one)
  host_address TEXT NOT NULL,
  host_port INT NOT NULL DEFAULT 22,
  host_username TEXT NOT NULL,
  connection_mode TEXT NOT NULL DEFAULT 'relay', -- 'direct' | 'relay' | 'tailscale'
  status TEXT NOT NULL DEFAULT 'connecting',     -- 'connecting' | 'connected' | 'disconnected' | 'error'
  error_message TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ssh_session_logs_user_id ON ssh_session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ssh_session_logs_started_at ON ssh_session_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_ssh_session_logs_host_address ON ssh_session_logs(user_id, host_address);

CREATE TABLE IF NOT EXISTS ssh_command_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ssh_session_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  command TEXT NOT NULL,
  logged_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssh_command_logs_session_id ON ssh_command_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_ssh_command_logs_user_id ON ssh_command_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ssh_command_logs_logged_at ON ssh_command_logs(logged_at);
