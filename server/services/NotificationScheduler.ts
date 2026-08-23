import { getDb } from '../db/connection.js';
import { EmailService } from './EmailService.js';

export type NotificationFrequency = 'immediate' | 'daily' | 'weekly' | 'monthly';
export type NotificationType =
  | 'trial_expiring'
  | 'plan_downgrade'
  | 'payment_failed'
  | 'storage_warning'
  | 'feature_announcement'
  | 'security_alert';

export interface NotificationSchedule {
  userId: string;
  type: NotificationType;
  frequency: NotificationFrequency;
  enabled: boolean;
  nextScheduledTime?: Date;
  maxPerDay?: number;
}

export class NotificationScheduler {
  private db = getDb();
  private emailService = new EmailService();
  private batches: Map<string, Array<{ type: NotificationType; data: Record<string, unknown> }>> =
    new Map();

  async getUserPreferences(userId: string): Promise<Record<NotificationType, NotificationSchedule>> {
    try {
      const rows = await this.db`
        SELECT type, frequency, enabled, max_per_day
        FROM notification_preferences
        WHERE user_id = ${userId}
      `;

      const preferences: Record<string, NotificationSchedule> = {};
      const notificationTypes: NotificationType[] = [
        'trial_expiring',
        'plan_downgrade',
        'payment_failed',
        'storage_warning',
        'feature_announcement',
        'security_alert',
      ];

      for (const type of notificationTypes) {
        const pref = rows.find((r: Record<string, unknown>) => r.type === type);
        preferences[type] = {
          userId,
          type,
          frequency: (pref?.frequency as NotificationFrequency) || 'immediate',
          enabled: pref?.enabled ?? true,
          maxPerDay: pref?.max_per_day ?? 5,
        };
      }

      return preferences;
    } catch (error) {
      console.error('[NotificationScheduler] Failed to get preferences:', error);
      throw error;
    }
  }

  async updatePreferences(
    userId: string,
    type: NotificationType,
    frequency: NotificationFrequency,
    enabled: boolean,
    maxPerDay?: number
  ): Promise<void> {
    try {
      await this.db`
        INSERT INTO notification_preferences (user_id, type, frequency, enabled, max_per_day)
        VALUES (${userId}, ${type}, ${frequency}, ${enabled}, ${maxPerDay ?? 5})
        ON CONFLICT (user_id, type) DO UPDATE SET
          frequency = EXCLUDED.frequency,
          enabled = EXCLUDED.enabled,
          max_per_day = EXCLUDED.max_per_day,
          updated_at = NOW()
      `;
    } catch (error) {
      console.error('[NotificationScheduler] Failed to update preferences:', error);
      throw error;
    }
  }

  async scheduleNotification(
    userId: string,
    type: NotificationType,
    data: Record<string, unknown>,
    scheduledFor?: Date
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      const pref = preferences[type];

      if (!pref.enabled) {
        return;
      }

      // Check daily limit
      const todayCount = await this.getNotificationCountToday(userId, type);
      if (todayCount >= (pref.maxPerDay ?? 5)) {
        return;
      }

      // Determine send time based on frequency
      const sendTime = this.calculateSendTime(pref.frequency, scheduledFor);

      // Store notification
      await this.db`
        INSERT INTO scheduled_notifications (user_id, type, data, scheduled_for, frequency)
        VALUES (${userId}, ${type}, ${JSON.stringify(data)}, ${sendTime}, ${pref.frequency})
      `;
    } catch (error) {
      console.error('[NotificationScheduler] Failed to schedule notification:', error);
      throw error;
    }
  }

  async batchNotifications(userId: string, maxWaitMs: number = 300000): Promise<void> {
    const batchKey = `${userId}:batch`;

    // Collect notifications for this user
    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, []);

      // Set timeout to send batch after maxWaitMs
      setTimeout(() => {
        const batch = this.batches.get(batchKey);
        if (batch && batch.length > 0) {
          this.sendNotificationBatch(userId, batch).catch((error) => {
            console.error('[NotificationScheduler] Batch send failed:', error);
          });
          this.batches.delete(batchKey);
        }
      }, maxWaitMs);
    }
  }

  async processDueNotifications(): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    try {
      // Find all due notifications
      const dueNotifications = await this.db`
        SELECT id, user_id, type, data, frequency
        FROM scheduled_notifications
        WHERE scheduled_for <= NOW()
          AND sent_at IS NULL
        LIMIT 100
      `;

      for (const notification of dueNotifications) {
        try {
          // Get user email
          const userRows = await this.db`
            SELECT email FROM users WHERE id = ${notification.user_id}
          `;

          if (userRows.length === 0) {
            await this.db`UPDATE scheduled_notifications SET sent_at = NOW() WHERE id = ${notification.id}`;
            continue;
          }

          const email = userRows[0].email as string;
          const data = notification.data as Record<string, unknown>;

          // Send notification
          const notificationSent = await this.sendNotification(email, notification.type, data);

          if (notificationSent) {
            // Mark as sent and schedule next occurrence if recurring
            if (notification.frequency !== 'immediate') {
              const nextScheduledFor = this.calculateNextOccurrence(
                notification.frequency,
                new Date()
              );
              await this.db`
                UPDATE scheduled_notifications
                SET sent_at = NOW(), next_scheduled_for = ${nextScheduledFor}
                WHERE id = ${notification.id}
              `;
            } else {
              await this.db`
                UPDATE scheduled_notifications
                SET sent_at = NOW()
                WHERE id = ${notification.id}
              `;
            }
            sent++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(
            `[NotificationScheduler] Failed to send notification ${notification.id}:`,
            error
          );
          failed++;
        }
      }

      return { sent, failed };
    } catch (error) {
      console.error('[NotificationScheduler] Failed to process due notifications:', error);
      return { sent, failed };
    }
  }

  private calculateSendTime(frequency: NotificationFrequency, customTime?: Date): Date {
    const now = new Date();

    if (customTime && customTime > now) {
      return customTime;
    }

    switch (frequency) {
      case 'immediate':
        return now;
      case 'daily':
        // Send tomorrow at 9 AM
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        return tomorrow;
      case 'weekly':
        // Send next Monday at 9 AM
        const nextMonday = new Date(now);
        nextMonday.setDate(nextMonday.getDate() + ((1 - nextMonday.getDay() + 7) % 7 || 7));
        nextMonday.setHours(9, 0, 0, 0);
        return nextMonday;
      case 'monthly':
        // Send on the 1st of next month at 9 AM
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(9, 0, 0, 0);
        return nextMonth;
    }
  }

  private calculateNextOccurrence(frequency: NotificationFrequency, lastSentTime: Date): Date {
    const next = new Date(lastSentTime);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
    }

    return next;
  }

  private async getNotificationCountToday(userId: string, type: NotificationType): Promise<number> {
    try {
      const rows = await this.db`
        SELECT COUNT(*) as count
        FROM scheduled_notifications
        WHERE user_id = ${userId}
          AND type = ${type}
          AND DATE(sent_at) = CURRENT_DATE
      `;
      return rows[0]?.count ?? 0;
    } catch (error) {
      console.error('[NotificationScheduler] Failed to get notification count:', error);
      return 0;
    }
  }

  private async sendNotification(
    email: string,
    type: NotificationType,
    data: Record<string, unknown>
  ): Promise<boolean> {
    try {
      switch (type) {
        case 'trial_expiring': {
          const daysRemaining = data.daysRemaining as number;
          return await this.emailService.sendTrialExpirationEmail(email, daysRemaining);
        }
        case 'plan_downgrade': {
          const { previousPlan, newPlan, exceeded } = data;
          return await this.emailService.sendPlanDowngradeEmail(
            email,
            previousPlan as string,
            newPlan as string,
            exceeded as Array<{ resource: string; current: number; limit: number }>
          );
        }
        case 'payment_failed':
          return await this.sendPaymentFailedEmail(email, data);
        case 'storage_warning':
          return await this.sendStorageWarningEmail(email, data);
        case 'feature_announcement':
          return await this.sendFeatureAnnouncementEmail(email, data);
        case 'security_alert':
          return await this.sendSecurityAlertEmail(email, data);
        default:
          return false;
      }
    } catch (error) {
      console.error(`[NotificationScheduler] Failed to send ${type} notification:`, error);
      return false;
    }
  }

  private sendNotificationBatch(
    _userId: string,
    _notifications: Array<{ type: NotificationType; data: Record<string, unknown> }>
  ): Promise<void> {
    // Placeholder implementation
    return Promise.resolve();
  }

  private sendPaymentFailedEmail(_email: string, _data: Record<string, unknown>): Promise<boolean> {
    // Placeholder
    return Promise.resolve(true);
  }

  private sendStorageWarningEmail(_email: string, _data: Record<string, unknown>): Promise<boolean> {
    // Placeholder
    return Promise.resolve(true);
  }

  private sendFeatureAnnouncementEmail(_email: string, _data: Record<string, unknown>): Promise<boolean> {
    // Placeholder
    return Promise.resolve(true);
  }

  private sendSecurityAlertEmail(_email: string, _data: Record<string, unknown>): Promise<boolean> {
    // Placeholder
    return Promise.resolve(true);
  }
}
