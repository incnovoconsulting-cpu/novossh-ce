-- Phase 4: Post-Deployment Monitoring & Observability - Database Schema

-- Rate Limit Violations: Track rate limit breaches
CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID,
  ip_address INET,

  -- Violation metadata
  endpoint VARCHAR(255) NOT NULL,
  identifier VARCHAR(255) NOT NULL, -- Unique identifier (user:id or ip:address)
  violation_count INT DEFAULT 0,

  -- Severity and status
  severity VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
  status VARCHAR(20) DEFAULT 'open', -- open, resolved, escalated

  -- Timing
  first_violation_at TIMESTAMP NOT NULL,
  last_violation_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_endpoint ON rate_limit_violations(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_identifier ON rate_limit_violations(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_status ON rate_limit_violations(status);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_severity ON rate_limit_violations(severity);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_last_violation ON rate_limit_violations(last_violation_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_org_id ON rate_limit_violations(organization_id);

-- Auth Failures: Track authentication failures and brute force attempts
CREATE TABLE IF NOT EXISTS auth_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID,
  ip_address INET NOT NULL,

  -- Failure metadata
  endpoint VARCHAR(255) NOT NULL,
  identifier VARCHAR(255) NOT NULL, -- Unique identifier (user:id or ip:address)
  failure_type VARCHAR(50) NOT NULL, -- invalid_credentials, invalid_token, expired_token, missing_token
  failure_count INT DEFAULT 0,

  -- Severity and status
  severity VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
  status VARCHAR(20) DEFAULT 'open', -- open, resolved

  -- Timing
  first_failure_at TIMESTAMP NOT NULL,
  last_failure_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_failures_endpoint ON auth_failures(endpoint);
CREATE INDEX IF NOT EXISTS idx_auth_failures_identifier ON auth_failures(identifier);
CREATE INDEX IF NOT EXISTS idx_auth_failures_failure_type ON auth_failures(failure_type);
CREATE INDEX IF NOT EXISTS idx_auth_failures_status ON auth_failures(status);
CREATE INDEX IF NOT EXISTS idx_auth_failures_severity ON auth_failures(severity);
CREATE INDEX IF NOT EXISTS idx_auth_failures_last_failure ON auth_failures(last_failure_at);
CREATE INDEX IF NOT EXISTS idx_auth_failures_org_id ON auth_failures(organization_id);

-- API Usage Stats: Aggregate endpoint usage metrics
CREATE TABLE IF NOT EXISTS api_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,

  -- Endpoint identification
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,

  -- Metrics
  request_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  avg_response_time_ms FLOAT DEFAULT 0,
  p95_response_time_ms FLOAT DEFAULT 0,
  p99_response_time_ms FLOAT DEFAULT 0,
  max_response_time_ms INT DEFAULT 0,

  -- Time window
  stat_date DATE NOT NULL,
  stat_hour INT, -- 0-23 for hourly stats

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_stats_endpoint ON api_usage_stats(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_stats_stat_date ON api_usage_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_stats_stat_hour ON api_usage_stats(stat_hour);
CREATE INDEX IF NOT EXISTS idx_api_usage_stats_org_id ON api_usage_stats(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_usage_stats_unique ON api_usage_stats(endpoint, method, stat_date, stat_hour) WHERE stat_hour IS NOT NULL;

-- Database Query Performance: Track slow queries
CREATE TABLE IF NOT EXISTS database_query_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Query identification
  query_hash VARCHAR(64) NOT NULL,
  query_template TEXT,

  -- Metrics
  execution_count INT DEFAULT 0,
  avg_duration_ms FLOAT DEFAULT 0,
  max_duration_ms INT DEFAULT 0,
  min_duration_ms INT DEFAULT 0,
  p95_duration_ms FLOAT DEFAULT 0,

  -- Status
  is_slow BOOLEAN DEFAULT FALSE,
  slow_threshold_ms INT DEFAULT 1000,

  -- Timing
  first_seen_at TIMESTAMP NOT NULL,
  last_seen_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_database_query_metrics_query_hash ON database_query_metrics(query_hash);
CREATE INDEX IF NOT EXISTS idx_database_query_metrics_is_slow ON database_query_metrics(is_slow);
CREATE INDEX IF NOT EXISTS idx_database_query_metrics_last_seen ON database_query_metrics(last_seen_at);

-- System Events: Important system events and anomalies
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event metadata
  event_type VARCHAR(100) NOT NULL, -- rate_limit_spike, auth_anomaly, performance_degradation, resource_exhaustion, etc.
  severity VARCHAR(20) NOT NULL, -- info, warning, error, critical
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Context
  organization_id UUID,
  team_id UUID,
  user_id UUID,

  -- Details
  details JSONB,

  -- Status
  status VARCHAR(20) DEFAULT 'open', -- open, acknowledged, resolved, escalated
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID,
  resolved_at TIMESTAMP,
  resolved_by UUID,

  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_events_event_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_severity ON system_events(severity);
CREATE INDEX IF NOT EXISTS idx_system_events_status ON system_events(status);
CREATE INDEX IF NOT EXISTS idx_system_events_created_at ON system_events(created_at);
CREATE INDEX IF NOT EXISTS idx_system_events_org_id ON system_events(organization_id);

-- Alert Rules: Configuration for automated alerts
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,

  -- Rule definition
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rule_type VARCHAR(100) NOT NULL, -- rate_limit, auth_failure, performance, resource, etc.

  -- Conditions
  condition_json JSONB NOT NULL, -- { metric: 'auth_failures', operator: '>', value: 10, window_minutes: 60 }

  -- Actions
  actions_json JSONB, -- [{ type: 'webhook', url: '...' }, { type: 'email', recipients: [...] }]

  -- Status
  is_enabled BOOLEAN DEFAULT TRUE,

  -- Timing
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_org_id ON alert_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_rule_type ON alert_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_is_enabled ON alert_rules(is_enabled);

-- Alert Executions: Track when alerts fire
CREATE TABLE IF NOT EXISTS alert_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,

  -- Execution details
  triggered_at TIMESTAMP NOT NULL,
  trigger_value FLOAT,
  trigger_threshold FLOAT,

  -- Alert delivery
  channels_json JSONB, -- Which channels the alert was sent to
  status VARCHAR(20) DEFAULT 'sent', -- sent, pending, failed

  -- Response
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_executions_rule_id ON alert_executions(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_executions_org_id ON alert_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_alert_executions_triggered_at ON alert_executions(triggered_at);

-- Monitoring Config: Organization monitoring settings
CREATE TABLE IF NOT EXISTS monitoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,

  -- Alert settings
  alert_email_recipients TEXT[], -- Array of email addresses
  alert_webhook_urls TEXT[], -- Array of webhook URLs

  -- Thresholds
  rate_limit_threshold_per_hour INT DEFAULT 100,
  auth_failure_threshold_per_hour INT DEFAULT 10,
  response_time_threshold_ms INT DEFAULT 5000,
  error_rate_threshold_percent FLOAT DEFAULT 5.0,
  memory_threshold_percent FLOAT DEFAULT 85.0,

  -- Monitoring window
  metrics_retention_days INT DEFAULT 30,
  alert_retention_days INT DEFAULT 90,

  -- Feature flags
  enable_rate_limit_alerts BOOLEAN DEFAULT TRUE,
  enable_auth_alerts BOOLEAN DEFAULT TRUE,
  enable_performance_alerts BOOLEAN DEFAULT TRUE,
  enable_resource_alerts BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitoring_config_org_id ON monitoring_config(organization_id);

-- Create default monitoring config for new orgs
-- (Triggered via application logic on org creation)

-- Health Check History: Track system health over time
CREATE TABLE IF NOT EXISTS health_check_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Status
  overall_status VARCHAR(20) NOT NULL, -- healthy, degraded, critical

  -- Component statuses
  database_status VARCHAR(20) NOT NULL,
  database_latency_ms INT,

  auth_status VARCHAR(20) NOT NULL,
  auth_failed_attempts_1h INT,

  rate_limit_status VARCHAR(20) NOT NULL,
  rate_limit_violations_1h INT,

  memory_status VARCHAR(20) NOT NULL,
  memory_used_mb INT,
  memory_available_mb INT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_check_history_created_at ON health_check_history(created_at);
CREATE INDEX IF NOT EXISTS idx_health_check_history_overall_status ON health_check_history(overall_status);

-- Compliance Report History: Track compliance reports
CREATE TABLE IF NOT EXISTS compliance_report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,

  -- Report metadata
  report_type VARCHAR(100) NOT NULL, -- audit, security, performance, etc.
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,

  -- Findings
  total_events INT,
  high_severity_events INT,
  medium_severity_events INT,
  low_severity_events INT,

  -- Metrics
  metrics_json JSONB, -- Summary of key metrics

  -- Report data
  report_content TEXT,
  report_format VARCHAR(20) DEFAULT 'json', -- json, pdf, csv

  -- Status
  is_finalized BOOLEAN DEFAULT FALSE,
  generated_by UUID,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_report_history_org_id ON compliance_report_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_report_history_report_type ON compliance_report_history(report_type);
CREATE INDEX IF NOT EXISTS idx_compliance_report_history_report_period ON compliance_report_history(report_period_start, report_period_end);
