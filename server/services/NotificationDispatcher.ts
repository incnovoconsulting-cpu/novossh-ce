import { getDb } from '../db/connection.js';
import { EmailService } from './EmailService.js';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'slack';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationType =
  | 'usage_alert'
  | 'payment_reminder'
  | 'team_notification'
  | 'security_alert'
  | 'feature_announcement'
  | 'trial_notification'
  | 'quota_warning';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  actionLabel?: string;
  expiresAt?: Date;
  channels?: NotificationChannel[];
}

interface DeliveryLog {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: string;
  errorMessage?: string;
  retryCount: number;
  nextRetryAt?: Date;
}

export class NotificationDispatcher {
  private db = getDb();
  private emailService = new EmailService();
  private readonly maxRetries = 5;
  private readonly backoffStrategy = [5000, 10000, 20000, 40000, 80000]; // 5s, 10s, 20s, 40s, 80s

  async sendNotification(payload: NotificationPayload): Promise<{ notificationId: string; deliveryLogs: DeliveryLog[] }> {
    try {
      // Create notification record
      const notificationId = await this.createNotification(payload);

      // Get user preferences
      const prefs = await this.getUserPreferences(payload.userId, payload.type);

      if (!prefs.enabled) {
        return { notificationId, deliveryLogs: [] };
      }

      // Determine which channels to use
      const channels: NotificationChannel[] = payload.channels || this.getChannelsForPreference(prefs);

      // Check quiet hours
      if (this.isInQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end)) {
        // Only send critical notifications during quiet hours
        if (payload.priority !== 'critical') {
          return { notificationId, deliveryLogs: [] };
        }
      }

      // Create delivery logs for each channel
      const deliveryLogs = await Promise.all(
        channels.map((channel) => this.createDeliveryLog(notificationId, channel))
      );

      // Send to each channel
      await Promise.allSettled(channels.map((channel) => this.deliverToChannel(notificationId, channel, payload)));

      return { notificationId, deliveryLogs };
    } catch (error) {
      console.error('[NotificationDispatcher] Failed to send notification:', error);
      throw error;
    }
  }

  private async createNotification(payload: NotificationPayload): Promise<string> {
    const result = await this.db`
      INSERT INTO notifications (
        user_id, type, priority, title, message, data, action_url, action_label, expires_at
      ) VALUES (
        ${payload.userId},
        ${payload.type},
        ${payload.priority || 'normal'},
        ${payload.title},
        ${payload.message},
        ${JSON.stringify(payload.data || {})},
        ${payload.actionUrl || null},
        ${payload.actionLabel || null},
        ${payload.expiresAt || null}
      )
      RETURNING id
    `;

    return result[0].id;
  }

  private async getUserPreferences(userId: string, type: NotificationType) {
    const result = await this.db`
      SELECT * FROM notification_preferences
      WHERE user_id = ${userId} AND type = ${type}
      LIMIT 1
    `;

    if (result.length === 0) {
      // Return default preferences
      return {
        enabled: true,
        frequency: 'immediate',
        channels: { in_app: true, email: false, sms: false, slack: false },
        quiet_hours_start: null,
        quiet_hours_end: null,
        max_per_day: 5,
      };
    }

    return result[0];
  }

  private getChannelsForPreference(
    prefs: Record<string, unknown>
  ): NotificationChannel[] {
    const channels: NotificationChannel[] = [];
    const channelPrefs = (prefs.channels || {}) as Record<NotificationChannel, boolean>;

    if (channelPrefs.in_app) channels.push('in_app');
    if (channelPrefs.email) channels.push('email');
    if (channelPrefs.sms) channels.push('sms');
    if (channelPrefs.slack) channels.push('slack');

    return channels.length > 0 ? channels : ['in_app'];
  }

  private isInQuietHours(start: string | null, end: string | null): boolean {
    if (!start || !end) return false;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (start < end) {
      return currentTime >= start && currentTime < end;
    } else {
      // Quiet hours wrap around midnight
      return currentTime >= start || currentTime < end;
    }
  }

  private async createDeliveryLog(notificationId: string, channel: NotificationChannel): Promise<DeliveryLog> {
    const result = await this.db`
      INSERT INTO notification_delivery_logs (notification_id, channel, status)
      VALUES (${notificationId}, ${channel}, 'pending')
      RETURNING id, notification_id, channel, status, error_message, retry_count, next_retry_at
    `;

    return result[0] as DeliveryLog;
  }

  private async deliverToChannel(
    notificationId: string,
    channel: NotificationChannel,
    payload: NotificationPayload
  ): Promise<void> {
    try {
      switch (channel) {
        case 'in_app':
          // In-app notifications are already created in DB
          await this.updateDeliveryLog(notificationId, channel, 'sent');
          break;

        case 'email':
          await this.deliverEmail(notificationId, payload);
          break;

        case 'sms':
          // SMS delivery ready for Twilio integration
          await this.scheduleRetry(notificationId, channel, 'SMS delivery not yet implemented');
          break;

        case 'slack':
          // Slack delivery ready for webhook integration
          await this.scheduleRetry(notificationId, channel, 'Slack delivery not yet implemented');
          break;

        default:
          throw new Error(`Unknown channel: ${channel}`);
      }
    } catch (error) {
      console.error(`[NotificationDispatcher] Failed to deliver via ${channel}:`, error);
      await this.scheduleRetry(notificationId, channel, String(error));
    }
  }

  private async deliverEmail(notificationId: string, payload: NotificationPayload): Promise<void> {
    // Get user email
    const userResult = await this.db`
      SELECT email FROM users WHERE id = ${payload.userId}
    `;

    if (!userResult.length) {
      throw new Error('User not found');
    }

    const email = userResult[0].email as string;

    // Get email template
    const template = await this.getEmailTemplate(payload.type);

    // Render template with payload data
    const { subject, html } = this.renderEmailTemplate(template, {
      title: payload.title,
      message: payload.message,
      ...payload.data,
    });

    // Send email
    const success = await this.emailService.sendCustomEmail(
      email,
      subject,
      html
    );

    if (success) {
      await this.updateDeliveryLog(notificationId, 'email', 'sent');
    } else {
      throw new Error('Email delivery failed');
    }
  }

  private async getEmailTemplate(type: NotificationType) {
    // Use existing email template, fallback to generic
    return {
      subject: `NovoSSH Notification: ${type}`,
      html: '<p>{{message}}</p>',
    };
  }

  private renderEmailTemplate(template: { subject: string; html: string }, data: Record<string, unknown>) {
    let subject = template.subject;
    let html = template.html;

    // Simple template rendering
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      const stringValue = String(value);
      subject = subject.replace(placeholder, stringValue);
      html = html.replace(placeholder, stringValue);
    });

    return { subject, html };
  }

  private async updateDeliveryLog(
    notificationId: string,
    channel: NotificationChannel,
    status: string
  ): Promise<void> {
    await this.db`
      UPDATE notification_delivery_logs
      SET status = ${status}, delivered_at = NOW(), updated_at = NOW()
      WHERE notification_id = ${notificationId} AND channel = ${channel}
    `;
  }

  private async scheduleRetry(
    notificationId: string,
    channel: NotificationChannel,
    errorMessage: string
  ): Promise<void> {
    // Get current delivery log
    const deliveryResult = await this.db`
      SELECT id, retry_count FROM notification_delivery_logs
      WHERE notification_id = ${notificationId} AND channel = ${channel}
    `;

    if (!deliveryResult.length) return;

    const log = deliveryResult[0];
    const retryCount = (log.retry_count || 0) as number;

    if (retryCount >= this.maxRetries) {
      // Max retries exceeded, mark as failed
      await this.db`
        UPDATE notification_delivery_logs
        SET status = 'failed', error_message = ${errorMessage}, updated_at = NOW()
        WHERE id = ${log.id}
      `;
      return;
    }

    // Calculate next retry time with exponential backoff
    const backoffMs = this.backoffStrategy[Math.min(retryCount, this.backoffStrategy.length - 1)];
    const nextRetryAt = new Date(Date.now() + backoffMs);

    // Update delivery log
    await this.db`
      UPDATE notification_delivery_logs
      SET status = 'retrying', retry_count = ${retryCount + 1},
          next_retry_at = ${nextRetryAt}, error_message = ${errorMessage}, updated_at = NOW()
      WHERE id = ${log.id}
    `;

    // Create retry queue entry
    await this.db`
      INSERT INTO notification_retry_queue (delivery_log_id, attempt_number, scheduled_for, backoff_seconds)
      VALUES (${log.id}, ${retryCount + 1}, ${nextRetryAt}, ${Math.floor(backoffMs / 1000)})
      ON CONFLICT DO NOTHING
    `;
  }

  async processRetryQueue(): Promise<void> {
    try {
      // Get pending retries
      const retries = await this.db`
        SELECT nrq.id, nrq.delivery_log_id, ndl.notification_id, ndl.channel
        FROM notification_retry_queue nrq
        JOIN notification_delivery_logs ndl ON nrq.delivery_log_id = ndl.id
        WHERE nrq.scheduled_for <= NOW()
        ORDER BY nrq.scheduled_for ASC
        LIMIT 100
      `;

      for (const retry of retries) {
        try {
          // Get notification data
          const notifResult = await this.db`
            SELECT * FROM notifications WHERE id = ${retry.notification_id}
          `;

          if (!notifResult.length) {
            await this.db`
              DELETE FROM notification_retry_queue WHERE id = ${retry.id}
            `;
            continue;
          }

          const notif = notifResult[0];
          const payload: NotificationPayload = {
            userId: notif.user_id as string,
            type: notif.type as NotificationType,
            priority: notif.priority as NotificationPriority,
            title: notif.title as string,
            message: notif.message as string,
            data: notif.data as Record<string, unknown>,
            actionUrl: notif.action_url as string,
            actionLabel: notif.action_label as string,
          };

          await this.deliverToChannel(retry.notification_id, retry.channel, payload);

          // Remove from retry queue on success
          await this.db`
            DELETE FROM notification_retry_queue WHERE id = ${retry.id}
          `;
        } catch (error) {
          console.error('[NotificationDispatcher] Retry failed:', error);
        }
      }
    } catch (error) {
      console.error('[NotificationDispatcher] Failed to process retry queue:', error);
    }
  }

  async cleanupExpired(): Promise<void> {
    try {
      // Archive and delete expired notifications
      const expired = await this.db`
        SELECT id, user_id, type, is_read FROM notifications
        WHERE expires_at <= NOW() AND created_at > NOW() - INTERVAL '30 days'
      `;

      if (expired.length > 0) {
        // Move to history
        await this.db`
          INSERT INTO notification_history (notification_id, user_id, type, status, archived_at)
          SELECT id, user_id, type, CASE WHEN is_read THEN 'read' ELSE 'unread' END, NOW()
          FROM notifications
          WHERE expires_at <= NOW()
        `;

        // Delete expired
        await this.db`
          DELETE FROM notifications WHERE expires_at <= NOW()
        `;
      }
    } catch (error) {
      console.error('[NotificationDispatcher] Failed to cleanup expired notifications:', error);
    }
  }

  async getNotifications(userId: string, limit: number, offset: number) {
    const rows = await this.db`
      SELECT id, user_id, type, priority, title, message, data, action_url, action_label, is_read, created_at, expires_at
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return rows as any[];
  }

  async getUnreadCount(userId: string): Promise<number> {
    const rows = await this.db`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ${userId} AND is_read = false
    `;
    return (rows[0] as any).count || 0;
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.db`
      UPDATE notifications
      SET is_read = true
      WHERE id = ${notificationId} AND user_id = ${userId}
    `;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.db`
      DELETE FROM notifications
      WHERE id = ${notificationId} AND user_id = ${userId}
    `;
  }

  async updatePreferences(
    userId: string,
    type: NotificationType,
    preferences: Record<string, any>
  ): Promise<void> {
    const existing = await this.db`
      SELECT id FROM notification_preferences
      WHERE user_id = ${userId} AND type = ${type}
    `;

    if (existing.length > 0) {
      await this.db`
        UPDATE notification_preferences
        SET
          in_app_enabled = ${preferences.in_app_enabled ?? true},
          email_enabled = ${preferences.email_enabled ?? true},
          sms_enabled = ${preferences.sms_enabled ?? false},
          slack_enabled = ${preferences.slack_enabled ?? false},
          frequency = ${preferences.frequency || 'immediate'},
          quiet_hours_start = ${preferences.quiet_hours_start || null},
          quiet_hours_end = ${preferences.quiet_hours_end || null}
        WHERE user_id = ${userId} AND type = ${type}
      `;
    } else {
      await this.db`
        INSERT INTO notification_preferences (
          user_id, type, in_app_enabled, email_enabled, sms_enabled, slack_enabled, frequency
        ) VALUES (
          ${userId}, ${type},
          ${preferences.in_app_enabled ?? true},
          ${preferences.email_enabled ?? true},
          ${preferences.sms_enabled ?? false},
          ${preferences.slack_enabled ?? false},
          ${preferences.frequency || 'immediate'}
        )
      `;
    }
  }
}
