-- Phase 10: Advanced Session Analytics and User Behavior Tracking

-- Session Metrics: Aggregate session statistics
CREATE TABLE IF NOT EXISTS session_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,

  -- Duration metrics
  duration_seconds INT,

  -- Command metrics
  command_count INT DEFAULT 0,
  successful_commands INT DEFAULT 0,
  failed_commands INT DEFAULT 0,
  command_success_rate NUMERIC(5,2),

  -- Performance metrics
  avg_command_execution_ms NUMERIC(10,2),
  min_command_execution_ms INT,
  max_command_execution_ms INT,

  -- Participant metrics
  participant_count INT DEFAULT 0,
  observer_count INT DEFAULT 0,

  -- Recording metrics
  is_recorded BOOLEAN DEFAULT FALSE,
  recording_duration_seconds INT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_metrics_team_id ON session_metrics(team_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_session_id ON session_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_created_at ON session_metrics(created_at);

-- Command Analytics: Detailed command usage patterns
CREATE TABLE IF NOT EXISTS command_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Command metadata
  command_pattern VARCHAR(500) NOT NULL,
  command_category VARCHAR(100),

  -- Execution statistics
  total_executions INT DEFAULT 0,
  successful_executions INT DEFAULT 0,
  failed_executions INT DEFAULT 0,
  success_rate NUMERIC(5,2),

  -- Performance statistics
  avg_execution_ms NUMERIC(10,2),
  median_execution_ms NUMERIC(10,2),
  p95_execution_ms NUMERIC(10,2),

  -- Last execution tracking
  last_executed_at TIMESTAMP,
  first_seen_at TIMESTAMP DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_command_analytics_team_id ON command_analytics(team_id);
CREATE INDEX IF NOT EXISTS idx_command_analytics_user_id ON command_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_command_analytics_command_pattern ON command_analytics(command_pattern);
CREATE INDEX IF NOT EXISTS idx_command_analytics_updated_at ON command_analytics(updated_at);

-- Feature Adoption: Track which features users are using
CREATE TABLE IF NOT EXISTS feature_adoption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Feature metadata
  feature_name VARCHAR(100) NOT NULL,
  feature_category VARCHAR(50),

  -- Adoption tracking
  first_used_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  usage_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  -- Adoption stage
  adoption_stage VARCHAR(50) DEFAULT 'discovery', -- discovery, onboarding, regular, power_user

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_adoption_team_id ON feature_adoption(team_id);
CREATE INDEX IF NOT EXISTS idx_feature_adoption_user_id ON feature_adoption(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_adoption_feature_name ON feature_adoption(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_adoption_adoption_stage ON feature_adoption(adoption_stage);

-- User Behavior Profile: Aggregate user behavior patterns
CREATE TABLE IF NOT EXISTS user_behavior_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Engagement metrics
  total_sessions INT DEFAULT 0,
  total_commands_executed INT DEFAULT 0,
  total_session_duration_seconds INT DEFAULT 0,
  avg_session_duration_seconds NUMERIC(10,2),

  -- Activity patterns
  most_active_hour INT,
  most_active_day_of_week INT,
  sessions_per_day NUMERIC(5,2),

  -- Behavior classification
  user_type VARCHAR(50) DEFAULT 'inactive', -- inactive, light, moderate, heavy, power_user
  engagement_level VARCHAR(50) DEFAULT 'low', -- low, medium, high

  -- Last activity tracking
  last_activity_at TIMESTAMP,
  inactive_days INT DEFAULT 0,

  -- Risk indicators
  churn_risk_score NUMERIC(5,2) DEFAULT 0,
  is_at_risk BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_behavior_profiles_team_id ON user_behavior_profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_profiles_user_id ON user_behavior_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behavior_profiles_user_type ON user_behavior_profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_user_behavior_profiles_is_at_risk ON user_behavior_profiles(is_at_risk);

-- Performance Metrics: Track system and session performance
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,

  -- Request metrics
  total_requests INT DEFAULT 0,
  avg_response_time_ms NUMERIC(10,2),
  p95_response_time_ms NUMERIC(10,2),
  p99_response_time_ms NUMERIC(10,2),

  -- Throughput metrics
  commands_per_second NUMERIC(10,2),
  bytes_transferred INT DEFAULT 0,

  -- Reliability metrics
  request_success_rate NUMERIC(5,2),
  error_rate NUMERIC(5,2),

  -- Connection stability
  connection_drop_count INT DEFAULT 0,
  avg_time_to_reconnect_ms NUMERIC(10,2),

  measurement_period_seconds INT,
  measured_at TIMESTAMP DEFAULT NOW(),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_team_id ON performance_metrics(team_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_session_id ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_measured_at ON performance_metrics(measured_at);

-- Anomalies: Detect and track unusual patterns
CREATE TABLE IF NOT EXISTS anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,

  -- Anomaly details
  anomaly_type VARCHAR(100) NOT NULL, -- unusual_command, high_latency, unusual_time, session_drop, etc
  severity VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
  description TEXT,
  details JSONB,

  -- Context
  baseline_value NUMERIC(15,2),
  anomaly_value NUMERIC(15,2),
  deviation_percentage NUMERIC(10,2),

  -- Tracking
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_team_id ON anomalies(team_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_user_id ON anomalies(user_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_anomaly_type ON anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_is_resolved ON anomalies(is_resolved);
CREATE INDEX IF NOT EXISTS idx_anomalies_created_at ON anomalies(created_at);

-- Churn Risk: Track users at risk of churning
CREATE TABLE IF NOT EXISTS churn_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Risk assessment
  risk_score NUMERIC(5,2) NOT NULL DEFAULT 0, -- 0-100
  risk_level VARCHAR(50) DEFAULT 'low', -- low, medium, high, critical

  -- Risk factors
  days_since_last_activity INT,
  session_drop_rate NUMERIC(5,2),
  feature_adoption_rate NUMERIC(5,2),
  engagement_trend VARCHAR(50), -- increasing, stable, declining

  -- Outreach tracking
  has_outreach_flag BOOLEAN DEFAULT FALSE,
  outreach_reasons JSONB, -- array of reasons for outreach
  last_outreach_at TIMESTAMP,
  outreach_count INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_churn_risk_assessments_team_id ON churn_risk_assessments(team_id);
CREATE INDEX IF NOT EXISTS idx_churn_risk_assessments_user_id ON churn_risk_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_churn_risk_assessments_risk_level ON churn_risk_assessments(risk_level);
CREATE INDEX IF NOT EXISTS idx_churn_risk_assessments_has_outreach_flag ON churn_risk_assessments(has_outreach_flag);
CREATE INDEX IF NOT EXISTS idx_churn_risk_assessments_updated_at ON churn_risk_assessments(updated_at);

-- User Activity Heatmap: Track activity patterns by hour and day
CREATE TABLE IF NOT EXISTS user_activity_heatmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Time dimension
  hour_of_day INT NOT NULL, -- 0-23
  day_of_week INT NOT NULL, -- 0-6 (Sunday-Saturday)

  -- Activity metrics
  session_count INT DEFAULT 0,
  command_count INT DEFAULT 0,
  total_duration_seconds INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_heatmap_team_id ON user_activity_heatmap(team_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_heatmap_user_id ON user_activity_heatmap(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_heatmap_hour_of_day ON user_activity_heatmap(hour_of_day);
CREATE INDEX IF NOT EXISTS idx_user_activity_heatmap_day_of_week ON user_activity_heatmap(day_of_week);
