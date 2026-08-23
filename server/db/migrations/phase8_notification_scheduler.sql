-- Phase 8: Advanced Notification Scheduling

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  frequency VARCHAR(50) NOT NULL DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'daily', 'weekly', 'monthly')),
  enabled BOOLEAN DEFAULT TRUE,
  max_per_day INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, type)
);

-- Scheduled notifications
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  next_scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_due ON scheduled_notifications(scheduled_for)
WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user_id ON scheduled_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
