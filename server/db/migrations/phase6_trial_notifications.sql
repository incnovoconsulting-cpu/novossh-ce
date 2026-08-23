-- Phase 6: Trial Notifications

-- Trial notifications log: Track sent notifications to avoid duplicates
CREATE TABLE IF NOT EXISTS trial_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('expiring_3days', 'expiring_1day', 'expired')),
  sent_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trial_notifications_user_id ON trial_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_notifications_sent_at ON trial_notifications(sent_at);
