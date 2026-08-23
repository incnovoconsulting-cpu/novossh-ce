CREATE TABLE IF NOT EXISTS feature_flags (
  key VARCHAR(100) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255)
);

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('offline_sync', false, 'Enable offline-first sync for web client'),
  ('p2p_sync', false, 'Enable P2P sync between devices via Tailscale'),
  ('session_recording', false, 'Record SSH session commands'),
  ('port_forwarding', true, 'Enable local/remote port forwarding'),
  ('saml', false, 'Enable SAML SSO for organizations'),
  ('webauthn', false, 'Enable WebAuthn/FIDO2 MFA'),
  ('tailscale', false, 'Enable Tailscale integration')
ON CONFLICT (key) DO NOTHING;
