-- Phase 10: Enhanced Notification System with Multi-Channel Delivery

-- Main notifications table: stores in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- usage_alert, payment_reminder, team_notification, security_alert, feature_announcement, trial_notification, quota_warning
  priority VARCHAR(20) NOT NULL DEFAULT 'normal', -- low, normal, high, critical
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Additional context data
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  action_url VARCHAR(500),
  action_label VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- User notification preferences: controls delivery and frequency
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- notification type
  enabled BOOLEAN DEFAULT TRUE,
  frequency VARCHAR(20) NOT NULL DEFAULT 'immediate', -- immediate, daily, weekly, never
  channels JSONB DEFAULT '{"in_app": true, "email": false, "sms": false, "slack": false}',
  quiet_hours_start VARCHAR(5), -- HH:MM format
  quiet_hours_end VARCHAR(5),
  max_per_day INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

-- Notification delivery logs: tracks which channels delivered the notification
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL, -- in_app, email, sms, slack
  status VARCHAR(20) NOT NULL, -- pending, sent, failed, retrying
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_notification ON notification_delivery_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON notification_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_channel ON notification_delivery_logs(channel);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_retry ON notification_delivery_logs(next_retry_at) WHERE status = 'retrying';

-- Team notifications: for team-wide announcements
CREATE TABLE IF NOT EXISTS team_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_notifications_team ON team_notifications(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_notifications_type ON team_notifications(type);

-- Notification read status for team notifications
CREATE TABLE IF NOT EXISTS team_notification_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_notification_id UUID NOT NULL REFERENCES team_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_notification_reads_user ON team_notification_reads(user_id);

-- Notification retry queue: for failed deliveries
CREATE TABLE IF NOT EXISTS notification_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_log_id UUID NOT NULL REFERENCES notification_delivery_logs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  scheduled_for TIMESTAMP NOT NULL,
  backoff_seconds INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(delivery_log_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_retry_queue_scheduled ON notification_retry_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_retry_queue_delivery_log ON notification_retry_queue(delivery_log_id);

-- Notification history: for archival and auditing
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL,
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  data JSONB,
  archived_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_history_user ON notification_history(user_id, archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_archived ON notification_history(archived_at);

-- Initialize default notification preferences for existing users
INSERT INTO notification_preferences (user_id, type, enabled, frequency, channels, max_per_day)
SELECT DISTINCT u.id, 'usage_alert', TRUE, 'daily', '{"in_app": true, "email": true, "sms": false, "slack": false}'::jsonb, 3
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = u.id AND type = 'usage_alert')
ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, type, enabled, frequency, channels, max_per_day)
SELECT DISTINCT u.id, 'payment_reminder', TRUE, 'immediate', '{"in_app": true, "email": true, "sms": false, "slack": false}'::jsonb, 10
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = u.id AND type = 'payment_reminder')
ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, type, enabled, frequency, channels, max_per_day)
SELECT DISTINCT u.id, 'team_notification', TRUE, 'immediate', '{"in_app": true, "email": false, "sms": false, "slack": false}'::jsonb, 5
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = u.id AND type = 'team_notification')
ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, type, enabled, frequency, channels, max_per_day)
SELECT DISTINCT u.id, 'security_alert', TRUE, 'immediate', '{"in_app": true, "email": true, "sms": false, "slack": false}'::jsonb, 10
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = u.id AND type = 'security_alert')
ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, type, enabled, frequency, channels, max_per_day)
SELECT DISTINCT u.id, 'feature_announcement', TRUE, 'daily', '{"in_app": true, "email": false, "sms": false, "slack": false}'::jsonb, 2
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = u.id AND type = 'feature_announcement')
ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, type, enabled, frequency, channels, max_per_day)
SELECT DISTINCT u.id, 'trial_notification', TRUE, 'immediate', '{"in_app": true, "email": true, "sms": false, "slack": false}'::jsonb, 10
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = u.id AND type = 'trial_notification')
ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, type, enabled, frequency, channels, max_per_day)
SELECT DISTINCT u.id, 'quota_warning', TRUE, 'daily', '{"in_app": true, "email": true, "sms": false, "slack": false}'::jsonb, 3
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM notification_preferences WHERE user_id = u.id AND type = 'quota_warning')
ON CONFLICT DO NOTHING;
