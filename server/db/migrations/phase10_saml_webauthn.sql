-- Phase 5 Week 1: SAML SSO and WebAuthn MFA
-- Adds enterprise authentication support with SAML 2.0 and FIDO2 WebAuthn

-- SAML Configuration table: per-organization IdP settings
CREATE TABLE IF NOT EXISTS saml_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,

  -- SAML Provider metadata
  entity_id VARCHAR(255) NOT NULL UNIQUE,
  sso_url VARCHAR(255) NOT NULL,
  idp_metadata_url VARCHAR(255),
  idp_public_cert TEXT,

  -- Request signing
  sign_requests BOOLEAN DEFAULT TRUE,

  -- Attribute mappings
  name_id_format VARCHAR(100) DEFAULT 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
  email_attribute VARCHAR(100) DEFAULT 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  given_name_attribute VARCHAR(100),
  family_name_attribute VARCHAR(100),

  -- Assertion consumer service URL (required by SamlService)
  assertion_consumer_service_url VARCHAR(255),

  -- User provisioning
  auto_provision_users BOOLEAN DEFAULT TRUE,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saml_org_id ON saml_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_saml_entity_id ON saml_configurations(entity_id);

-- WebAuthn Credentials table: registered FIDO2 devices
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,

  -- Credential data
  credential_id BYTEA NOT NULL UNIQUE,
  public_key BYTEA NOT NULL,

  -- Counter for replay attack prevention
  counter INT DEFAULT 0,

  -- Metadata
  transports VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR[],
  is_backup BOOLEAN DEFAULT FALSE,
  is_backup_eligibility_eligible BOOLEAN DEFAULT FALSE,

  -- Credential type and state (required by WebAuthnService)
  credential_type VARCHAR(50) DEFAULT 'public-key',
  backup_state BOOLEAN DEFAULT FALSE,
  aaguid UUID,

  -- Soft-delete support
  is_active BOOLEAN DEFAULT TRUE,

  -- User-facing name
  name VARCHAR(255),

  -- When registered and last used
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_org_id ON webauthn_credentials(organization_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credential_id ON webauthn_credentials(credential_id);

-- WebAuthn Registration Sessions table: ongoing registration challenges
CREATE TABLE IF NOT EXISTS webauthn_registration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  challenge TEXT NOT NULL,
  user_verification VARCHAR(50) DEFAULT 'preferred',
  resident_key VARCHAR(50) DEFAULT 'preferred',
  attestation VARCHAR(50) DEFAULT 'direct',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wr_session_user ON webauthn_registration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_wr_session_expires ON webauthn_registration_sessions(expires_at);

-- WebAuthn Sessions table: ongoing authentication challenges
CREATE TABLE IF NOT EXISTS webauthn_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  organization_id UUID NOT NULL,

  -- Challenge data
  challenge BYTEA NOT NULL,
  operation VARCHAR(20) NOT NULL, -- 'register' or 'authenticate'

  -- Session state
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'expired', 'cancelled'

  -- Verification data (after challenge response)
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_webauthn_session_user_id ON webauthn_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_session_org_id ON webauthn_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_session_status ON webauthn_sessions(status);
CREATE INDEX IF NOT EXISTS idx_webauthn_session_expires_at ON webauthn_sessions(expires_at);

-- MFA Settings table: per-user MFA configuration
CREATE TABLE IF NOT EXISTS mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  organization_id UUID NOT NULL,

  -- MFA methods enabled
  webauthn_enabled BOOLEAN DEFAULT FALSE,
  webauthn_required BOOLEAN DEFAULT FALSE,
  totp_enabled BOOLEAN DEFAULT FALSE,

  -- Backup codes
  backup_codes_hash VARCHAR(255),
  backup_codes_count INT DEFAULT 10,

  -- Organization enforcement
  required_by_org BOOLEAN DEFAULT FALSE,

  -- Grace period for enforcement
  enforcement_grace_until TIMESTAMP,

  -- Timestamps
  last_modified_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mfa_settings_user_id ON mfa_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_settings_org_id ON mfa_settings(organization_id);

-- SAML Assertions log table: for audit trail
CREATE TABLE IF NOT EXISTS saml_assertions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,

  -- Assertion details
  assertion_id VARCHAR(255) NOT NULL UNIQUE,
  issuer VARCHAR(255),
  subject VARCHAR(255),

  -- Attribute data
  attributes JSONB,

  -- Validation
  is_valid BOOLEAN DEFAULT TRUE,
  validation_error TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saml_assertions_org_id ON saml_assertions(organization_id);
CREATE INDEX IF NOT EXISTS idx_saml_assertions_user_id ON saml_assertions(user_id);
CREATE INDEX IF NOT EXISTS idx_saml_assertions_created_at ON saml_assertions(created_at);

-- Add MFA-related fields to users table if not already present
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS saml_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_mfa_verified_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_saml_id ON users(saml_id);
CREATE INDEX IF NOT EXISTS idx_users_mfa_required ON users(mfa_required);
