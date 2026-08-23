-- Phase 7: Plan Downgrades Tracking

-- Plan downgrades log: Track subscription downgrades
CREATE TABLE IF NOT EXISTS plan_downgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_plan VARCHAR(50) NOT NULL CHECK (previous_plan IN ('free', 'starter', 'pro')),
  new_plan VARCHAR(50) NOT NULL CHECK (new_plan IN ('free', 'starter', 'pro')),
  downgraded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_downgrades_user_id ON plan_downgrades(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_downgrades_downgraded_at ON plan_downgrades(downgraded_at);
