-- Phase 10: Usage-Based Billing and Resource Quotas
-- Comprehensive metering infrastructure for real-time quota enforcement

-- 1. Usage events table: Real-time meter collection (time-series)
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'api_call', 'storage_bytes', 'session_minutes', 'sftp_bytes'
  resource_type VARCHAR(50) NOT NULL, -- 'api', 'storage', 'session', 'sftp'
  quantity BIGINT NOT NULL DEFAULT 1,
  unit VARCHAR(20) NOT NULL, -- 'calls', 'bytes', 'minutes'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_resource ON usage_events(user_id, resource_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(event_type);

-- 2. Hourly aggregation table (materialized view source)
CREATE TABLE IF NOT EXISTS usage_aggregates_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  hour_start TIMESTAMP NOT NULL,
  total_usage BIGINT NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, resource_type, hour_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_hourly_user_id ON usage_aggregates_hourly(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_hourly_hour ON usage_aggregates_hourly(hour_start DESC);
CREATE INDEX IF NOT EXISTS idx_usage_hourly_user_hour ON usage_aggregates_hourly(user_id, hour_start DESC);

-- 3. Daily aggregation table
CREATE TABLE IF NOT EXISTS usage_aggregates_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  day_start DATE NOT NULL,
  total_usage BIGINT NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, resource_type, day_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_daily_user_id ON usage_aggregates_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_daily_day ON usage_aggregates_daily(day_start DESC);
CREATE INDEX IF NOT EXISTS idx_usage_daily_user_day ON usage_aggregates_daily(user_id, day_start DESC);

-- 4. Monthly aggregation table
CREATE TABLE IF NOT EXISTS usage_aggregates_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  month_start DATE NOT NULL, -- First day of month
  total_usage BIGINT NOT NULL DEFAULT 0,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, resource_type, month_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_monthly_user_id ON usage_aggregates_monthly(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_monthly_month ON usage_aggregates_monthly(month_start DESC);
CREATE INDEX IF NOT EXISTS idx_usage_monthly_user_month ON usage_aggregates_monthly(user_id, month_start DESC);

-- 5. Resource quotas table: Define soft/hard limits per plan + resource
CREATE TABLE IF NOT EXISTS resource_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan VARCHAR(50) NOT NULL, -- 'free', 'starter', 'pro'
  resource_type VARCHAR(50) NOT NULL,
  hard_limit BIGINT NOT NULL, -- 100% limit (HTTP 429 blocking)
  soft_limit_warning BIGINT NOT NULL, -- 80% warning threshold
  soft_limit_critical BIGINT NOT NULL, -- 95% critical threshold
  period VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'daily', 'hourly'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(plan, resource_type, period)
);

CREATE INDEX IF NOT EXISTS idx_quotas_plan ON resource_quotas(plan);
CREATE INDEX IF NOT EXISTS idx_quotas_resource ON resource_quotas(resource_type);
CREATE INDEX IF NOT EXISTS idx_quotas_plan_resource ON resource_quotas(plan, resource_type);

-- 6. User quota usage table: Current usage status per resource/period
CREATE TABLE IF NOT EXISTS user_quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  period VARCHAR(20) NOT NULL, -- 'monthly', 'daily', 'hourly'
  period_start TIMESTAMP NOT NULL,
  current_usage BIGINT NOT NULL DEFAULT 0,
  last_checked TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, resource_type, period, period_start)
);

CREATE INDEX IF NOT EXISTS idx_user_quota_user_id ON user_quota_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quota_resource ON user_quota_usage(resource_type);
CREATE INDEX IF NOT EXISTS idx_user_quota_period ON user_quota_usage(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_user_quota_user_resource_period ON user_quota_usage(user_id, resource_type, period_start DESC);

-- 7. Quota alerts table: Track soft/hard limit violations
CREATE TABLE IF NOT EXISTS quota_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  alert_type VARCHAR(20) NOT NULL, -- 'soft_warning', 'critical', 'hard_limit'
  threshold_percent INTEGER NOT NULL, -- 80, 95, 100
  current_usage BIGINT NOT NULL,
  limit_value BIGINT NOT NULL,
  period VARCHAR(20) NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quota_alerts_user_id ON quota_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_alert_type ON quota_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_created_at ON quota_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_user_resource ON quota_alerts(user_id, resource_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quota_alerts_unacknowledged ON quota_alerts(user_id) WHERE acknowledged = FALSE;

-- 8. Usage forecasting table: Store projected month-end usage
CREATE TABLE IF NOT EXISTS usage_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  forecast_date DATE NOT NULL,
  month_start DATE NOT NULL,
  projected_end_of_month_usage BIGINT NOT NULL,
  confidence_low BIGINT NOT NULL, -- 68% confidence interval lower bound
  confidence_high BIGINT NOT NULL, -- 68% confidence interval upper bound
  daily_average NUMERIC(12,2) NOT NULL,
  current_usage BIGINT NOT NULL,
  days_elapsed INTEGER NOT NULL,
  days_remaining INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, resource_type, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_forecasts_user_id ON usage_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_forecast_date ON usage_forecasts(forecast_date DESC);
CREATE INDEX IF NOT EXISTS idx_forecasts_user_month ON usage_forecasts(user_id, month_start DESC);

-- Insert default quotas for all plans and resources
INSERT INTO resource_quotas (plan, resource_type, hard_limit, soft_limit_warning, soft_limit_critical, period)
VALUES
  -- Free plan: 100 API calls, 1GB storage, 600 min sessions, 1GB SFTP per month
  ('free', 'api_calls', 100, 80, 95, 'monthly'),
  ('free', 'storage_bytes', 1073741824, 858993459, 1020054732, 'monthly'), -- 1GB
  ('free', 'session_minutes', 600, 480, 570, 'monthly'),
  ('free', 'sftp_bytes', 1073741824, 858993459, 1020054732, 'monthly'), -- 1GB

  -- Starter plan: 10K calls, 100GB storage, 60K min, 100GB SFTP per month
  ('starter', 'api_calls', 10000, 8000, 9500, 'monthly'),
  ('starter', 'storage_bytes', 107374182400, 85899345920, 102005473280, 'monthly'), -- 100GB
  ('starter', 'session_minutes', 60000, 48000, 57000, 'monthly'),
  ('starter', 'sftp_bytes', 107374182400, 85899345920, 102005473280, 'monthly'), -- 100GB

  -- Pro plan: Unlimited (soft limits at 1M calls, 5TB storage)
  ('pro', 'api_calls', 1000000000, 800000000, 950000000, 'monthly'), -- Soft limit at 1M
  ('pro', 'storage_bytes', 5497558138880, 4398046511104, 5223372036096, 'monthly'), -- 5TB soft limit
  ('pro', 'session_minutes', 999999999, 999999999, 999999999, 'monthly'), -- Practically unlimited
  ('pro', 'sftp_bytes', 5497558138880, 4398046511104, 5223372036096, 'monthly') -- 5TB soft limit
ON CONFLICT DO NOTHING;

-- Create a function to check if user has exceeded quota
CREATE OR REPLACE FUNCTION check_quota_exceeded(p_user_id UUID, p_resource_type VARCHAR, p_current_usage BIGINT)
RETURNS TABLE(exceeded BOOLEAN, limit_value BIGINT, usage_percent NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_current_usage > rq.hard_limit,
    rq.hard_limit,
    ROUND((p_current_usage::NUMERIC / rq.hard_limit) * 100, 2)
  FROM resource_quotas rq
  JOIN subscriptions s ON TRUE
  WHERE s.user_id = p_user_id
    AND rq.plan = s.plan
    AND rq.resource_type = p_resource_type
    AND rq.period = 'monthly'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get current month start
CREATE OR REPLACE FUNCTION get_month_start(p_date TIMESTAMP DEFAULT NOW())
RETURNS DATE AS $$
BEGIN
  RETURN DATE_TRUNC('month', p_date)::DATE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get current hour start
CREATE OR REPLACE FUNCTION get_hour_start(p_date TIMESTAMP DEFAULT NOW())
RETURNS TIMESTAMP AS $$
BEGIN
  RETURN DATE_TRUNC('hour', p_date);
END;
$$ LANGUAGE plpgsql;

-- Grants (if needed - uncomment if using specific roles)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
