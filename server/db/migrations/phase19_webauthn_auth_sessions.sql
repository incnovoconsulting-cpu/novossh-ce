-- WebAuthn authentication challenges (login-time MFA). Registration sessions
-- already exist (webauthn_registration_sessions); this table was referenced
-- by WebAuthnService.generateAuthenticationOptions() but never created,
-- meaning authentication has always failed at the DB layer.
CREATE TABLE IF NOT EXISTS webauthn_authentication_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_session_user ON webauthn_authentication_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_session_expires ON webauthn_authentication_sessions(expires_at);
