-- Phase 3: Team Collaboration & RBAC - Database Schema

-- Teams: Group users for collaboration
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Team metadata
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_org_id ON teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);

-- Team Members: Users in teams with roles
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Role-based access control
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',

  -- Membership metadata
  is_active BOOLEAN DEFAULT TRUE,
  invited_by UUID,

  -- Timestamps
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_unique ON team_members(team_id, user_id) WHERE is_active = TRUE;

-- Roles: Define available roles
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(50) NOT NULL,
  description TEXT,

  -- Built-in roles flag
  is_built_in BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_org_id ON roles(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name ON roles(organization_id, name);

-- Role Permissions: Map roles to permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_unique ON role_permissions(role_id, permission);

-- Vault Teams: Assign vaults to teams
CREATE TABLE IF NOT EXISTS vault_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Default access level for team members
  default_access_level VARCHAR(50) DEFAULT 'viewer',

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_teams_vault_id ON vault_teams(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_teams_team_id ON vault_teams(team_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_teams_unique ON vault_teams(vault_id, team_id);

-- Sessions: Multiplayer terminal sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,

  -- Session metadata
  name VARCHAR(255),
  description TEXT,

  -- Session state
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_vault_id ON sessions(vault_id);
CREATE INDEX IF NOT EXISTS idx_sessions_team_id ON sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);

-- Session Participants: Users in multiplayer sessions
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Participation metadata
  is_observer BOOLEAN DEFAULT FALSE,

  -- Timestamps
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON session_participants(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_participants_unique ON session_participants(session_id, user_id) WHERE left_at IS NULL;

-- Session Commands: Track terminal commands in multiplayer sessions
CREATE TABLE IF NOT EXISTS session_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Command data
  command TEXT NOT NULL,
  output TEXT,

  -- Metadata
  exit_code INT,

  -- Timestamps
  executed_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_commands_session_id ON session_commands(session_id);
CREATE INDEX IF NOT EXISTS idx_session_commands_user_id ON session_commands(user_id);
CREATE INDEX IF NOT EXISTS idx_session_commands_executed_at ON session_commands(executed_at);

-- Recordings: Encrypted session recordings
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  -- Encrypted recording data
  encrypted_data BYTEA NOT NULL,

  -- Encryption metadata
  nonce VARCHAR(255) NOT NULL,
  tag VARCHAR(255) NOT NULL,

  -- Recording metadata
  duration_seconds INT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recordings_session_id ON recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at);

-- Recording Keys: Encryption keys for session recordings
CREATE TABLE IF NOT EXISTS recording_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,

  -- Encrypted key data
  encrypted_key TEXT NOT NULL,

  -- Key metadata
  key_algorithm VARCHAR(50) NOT NULL DEFAULT 'aes-256-gcm',

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recording_keys_recording_id ON recording_keys(recording_id);

-- Audit Logs: Team and session audit trail
CREATE TABLE IF NOT EXISTS team_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  team_id UUID,
  user_id UUID NOT NULL,

  -- Action metadata
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB,

  -- Request context
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_audit_logs_org_id ON team_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_team_id ON team_audit_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_user_id ON team_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_logs_created_at ON team_audit_logs(created_at);

-- Retention Policies: Data retention configuration
CREATE TABLE IF NOT EXISTS audit_retention (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,

  -- Retention settings (in days)
  team_audit_retention_days INT DEFAULT 90,
  session_recording_retention_days INT DEFAULT 30,

  -- Last purge tracking
  last_purged_at TIMESTAMP,

  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_retention_org_id ON audit_retention(organization_id);

-- Insert default roles
INSERT INTO roles (organization_id, name, description, is_built_in) VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner', 'Full control over team and resources', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'editor', 'Can create and modify resources', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'viewer', 'Read-only access to resources', TRUE)
ON CONFLICT DO NOTHING;

-- Insert default permissions for owner role
INSERT INTO role_permissions (role_id, permission)
SELECT id, permission FROM (
  SELECT r.id, unnest(ARRAY[
    'team:create',
    'team:read',
    'team:update',
    'team:delete',
    'member:add',
    'member:remove',
    'member:update',
    'vault:create',
    'vault:read',
    'vault:update',
    'vault:delete',
    'session:create',
    'session:read',
    'session:record',
    'recording:play',
    'audit:read'
  ]) AS permission
  FROM roles r
  WHERE r.name = 'owner' AND r.is_built_in = TRUE
) AS perms
ON CONFLICT DO NOTHING;

-- Insert default permissions for editor role
INSERT INTO role_permissions (role_id, permission)
SELECT id, permission FROM (
  SELECT r.id, unnest(ARRAY[
    'team:read',
    'member:read',
    'vault:create',
    'vault:read',
    'vault:update',
    'session:create',
    'session:read',
    'session:record',
    'recording:play',
    'audit:read'
  ]) AS permission
  FROM roles r
  WHERE r.name = 'editor' AND r.is_built_in = TRUE
) AS perms
ON CONFLICT DO NOTHING;

-- Insert default permissions for viewer role
INSERT INTO role_permissions (role_id, permission)
SELECT id, permission FROM (
  SELECT r.id, unnest(ARRAY[
    'team:read',
    'vault:read',
    'session:read',
    'recording:play',
    'audit:read'
  ]) AS permission
  FROM roles r
  WHERE r.name = 'viewer' AND r.is_built_in = TRUE
) AS perms
ON CONFLICT DO NOTHING;
