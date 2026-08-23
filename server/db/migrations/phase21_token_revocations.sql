-- Phase 21: Persistent token revocation
-- Revoked tokens must survive process restarts and work across instances.

CREATE TABLE IF NOT EXISTS token_revocations (
  jti VARCHAR(255) PRIMARY KEY,
  user_id UUID NOT NULL,
  revoked_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_token_revocations_user_id ON token_revocations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_revocations_revoked_at ON token_revocations(revoked_at);
