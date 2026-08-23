// Mirrors server-side NotificationPriority type (server/services/NotificationDispatcher.ts)
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationType =
  | 'usage_alert'
  | 'payment_reminder'
  | 'trial_expiring'
  | 'security_alert'
  | 'team_member_invited'
  | 'feature_announcement'
  | 'quota_threshold';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  action_url?: string;
  action_label?: string;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  type: NotificationType;
  in_app_enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  slack_enabled: boolean;
  frequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
}

export const NOTIFICATION_TYPES: Record<NotificationType, { label: string; description: string }> = {
  usage_alert: { label: 'Usage Alerts', description: 'Resource usage alerts' },
  payment_reminder: { label: 'Payment Reminders', description: 'Subscription notifications' },
  trial_expiring: { label: 'Trial Expiration', description: 'Trial warnings' },
  security_alert: { label: 'Security Alerts', description: 'Security incidents' },
  team_member_invited: { label: 'Team Invitations', description: 'Team notifications' },
  feature_announcement: { label: 'Feature Announcements', description: 'New features' },
  quota_threshold: { label: 'Quota Warnings', description: 'Quota alerts' },
};
