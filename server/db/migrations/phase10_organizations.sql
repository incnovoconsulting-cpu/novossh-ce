-- Phase 5 Week 1: Organization Management and Team Invitations - Database Schema

-- Organizations: Multi-level organizational hierarchy
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,

  -- Hierarchy and metadata
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON organizations(parent_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations(deleted_at);

-- Organization Members: Users in organizations with RBAC
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Role-based access control (owner, admin, member, viewer)
  role VARCHAR(50) NOT NULL DEFAULT 'member',

  -- Membership metadata
  is_active BOOLEAN DEFAULT TRUE,
  invited_by UUID,
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,

  -- Timestamps
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON org_members(role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique ON org_members(organization_id, user_id) WHERE is_active = TRUE;

-- Organization Invitations: Secure token-based invitations (7-day expiry)
CREATE TABLE IF NOT EXISTS org_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',

  -- Secure token (32-byte random hex)
  token VARCHAR(64) NOT NULL UNIQUE,

  -- Invitation state
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, expired
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,

  -- Invitation metadata
  invited_by UUID NOT NULL,
  invited_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON org_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON org_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON org_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON org_invitations(status);
CREATE INDEX IF NOT EXISTS idx_org_invitations_expires_at ON org_invitations(expires_at);

-- Organization Audit Logs: Audit trail for org changes
CREATE TABLE IF NOT EXISTS org_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID,

  -- Action metadata
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  details JSONB,

  -- Request context
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_audit_logs_org_id ON org_audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs_user_id ON org_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs_action ON org_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs_created_at ON org_audit_logs(created_at);
