-- Phase 9: Advanced Team Role Management - Granular Permissions

-- Team Roles: Team-specific roles with custom permissions
CREATE TABLE IF NOT EXISTS team_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,

  -- Permissions stored as JSONB array of permission strings
  permissions JSONB DEFAULT '[]'::jsonb,

  -- Built-in roles flag (owner, editor, viewer, manager)
  is_built_in BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_roles_team_id ON team_roles(team_id);
CREATE INDEX IF NOT EXISTS idx_team_roles_name ON team_roles(team_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_roles_unique ON team_roles(team_id, name);

-- Team Member Roles: Assign custom roles to team members
CREATE TABLE IF NOT EXISTS team_member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES team_roles(id) ON DELETE CASCADE,

  -- Assignment tracking
  assigned_by UUID,

  -- Timestamps
  assigned_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_member_roles_team_id ON team_member_roles(team_id);
CREATE INDEX IF NOT EXISTS idx_team_member_roles_user_id ON team_member_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_team_member_roles_role_id ON team_member_roles(role_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_member_roles_unique ON team_member_roles(team_id, user_id);

-- Create built-in roles for existing teams
-- This will be run separately for each team creation
-- Built-in roles: owner (all perms), editor (create/read/update), viewer (read-only), manager (all except billing)

-- Insert permission set for built-in roles (this is a reference for documentation)
-- Owner: All permissions
-- Editor: CRUD hosts/snippets/vaults, view sessions
-- Viewer: Read-only hosts/snippets/vaults, view sessions
-- Manager: All owner permissions except billing/license management
