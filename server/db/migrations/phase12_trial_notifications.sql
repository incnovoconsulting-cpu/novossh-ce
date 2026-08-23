-- Phase 12: Trial Notifications & Plan Downgrades

-- Add trial_ends_at to subscriptions for tracking trial end date
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;

-- Add read_at to trial_notifications for tracking read status
ALTER TABLE trial_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;

-- Plan downgrades: track grace period and resource enforcement
CREATE TABLE IF NOT EXISTS plan_downgrade_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('read_only', 'archived', 'pending_delete')),
  downgraded_at TIMESTAMP DEFAULT NOW(),
  grace_period_ends_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_downgrade_resources_user_id ON plan_downgrade_resources(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_downgrade_resources_grace ON plan_downgrade_resources(grace_period_ends_at) WHERE resolved_at IS NULL;
