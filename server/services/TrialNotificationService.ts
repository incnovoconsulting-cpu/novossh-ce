import { getDb } from '../db/connection.js';
import { EmailService } from './EmailService.js';
import { NotificationDispatcher } from './NotificationDispatcher.js';

export interface TrialNotificationLog {
  userId: string;
  notificationType: 'expiring_3days' | 'expiring_1day' | 'expired';
  sentAt: Date;
  readAt?: Date;
}

export class TrialNotificationService {
  private db = getDb();
  private emailService = new EmailService();
  private dispatcher = new NotificationDispatcher();

  async sendTrialExpiringNotifications(): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    try {
      // 3-day expiring notifications
      const usersExpiringIn3Days = await this.db`
        SELECT u.id, u.email, s.trial_end, s.trial_ends_at
        FROM users u
        JOIN subscriptions s ON u.id = s.user_id
        WHERE s.status = 'trialing'
          AND COALESCE(s.trial_ends_at, s.trial_end) IS NOT NULL
          AND COALESCE(s.trial_ends_at, s.trial_end) > NOW()
          AND COALESCE(s.trial_ends_at, s.trial_end) <= NOW() + INTERVAL '3 days'
          AND COALESCE(s.trial_ends_at, s.trial_end) > NOW() + INTERVAL '1 day'
          AND NOT EXISTS (
            SELECT 1 FROM trial_notifications
            WHERE user_id = u.id
              AND notification_type = 'expiring_3days'
              AND sent_at > NOW() - INTERVAL '23 hours'
          )
      `;

      for (const user of usersExpiringIn3Days) {
        const trialEnd = user.trial_ends_at || user.trial_end;
        const daysRemaining = Math.ceil(
          (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        const success = await this.sendNotification(user.id, user.email, 'expiring_3days', daysRemaining);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      }

      // 1-day expiring notifications
      const usersExpiringIn1Day = await this.db`
        SELECT u.id, u.email, s.trial_end, s.trial_ends_at
        FROM users u
        JOIN subscriptions s ON u.id = s.user_id
        WHERE s.status = 'trialing'
          AND COALESCE(s.trial_ends_at, s.trial_end) IS NOT NULL
          AND COALESCE(s.trial_ends_at, s.trial_end) > NOW()
          AND COALESCE(s.trial_ends_at, s.trial_end) <= NOW() + INTERVAL '1 day'
          AND NOT EXISTS (
            SELECT 1 FROM trial_notifications
            WHERE user_id = u.id
              AND notification_type = 'expiring_1day'
              AND sent_at > NOW() - INTERVAL '23 hours'
          )
      `;

      for (const user of usersExpiringIn1Day) {
        const success = await this.sendNotification(user.id, user.email, 'expiring_1day', 1);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      }

      // Expired trials
      const usersWithExpiredTrials = await this.db`
        SELECT u.id, u.email, s.trial_end, s.trial_ends_at
        FROM users u
        JOIN subscriptions s ON u.id = s.user_id
        WHERE s.status = 'trialing'
          AND COALESCE(s.trial_ends_at, s.trial_end) IS NOT NULL
          AND COALESCE(s.trial_ends_at, s.trial_end) <= NOW()
          AND NOT EXISTS (
            SELECT 1 FROM trial_notifications
            WHERE user_id = u.id
              AND notification_type = 'expired'
              AND sent_at > NOW() - INTERVAL '23 hours'
          )
      `;

      for (const user of usersWithExpiredTrials) {
        const success = await this.sendNotification(user.id, user.email, 'expired', 0);

        if (success) {
          // Downgrade subscription to free
          await this.db`
            UPDATE subscriptions
            SET plan = 'free', status = 'active', updated_at = NOW()
            WHERE user_id = ${user.id}
          `;
          sent++;
        } else {
          failed++;
        }
      }

      return { sent, failed };
    } catch (error) {
      console.error('[TrialNotificationService] Error sending notifications:', error);
      return { sent, failed };
    }
  }

  async getTrialStatus(userId: string): Promise<{
    isTrialing: boolean;
    trialEnd: Date | null;
    daysRemaining: number;
    status: string;
    plan: string;
  }> {
    const rows = await this.db`
      SELECT plan, status, trial_end, trial_ends_at
      FROM subscriptions
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    if (!rows[0]) {
      return { isTrialing: false, trialEnd: null, daysRemaining: 0, status: 'active', plan: 'free' };
    }

    const sub = rows[0];
    const isTrialing = sub.status === 'trialing';
    const trialEnd = sub.trial_ends_at || sub.trial_end;
    const daysRemaining = trialEnd
      ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      isTrialing,
      trialEnd: trialEnd ? new Date(trialEnd) : null,
      daysRemaining,
      status: sub.status as string,
      plan: sub.plan as string,
    };
  }

  async getNotificationHistory(userId: string, limit = 20): Promise<TrialNotificationLog[]> {
    const rows = await this.db`
      SELECT user_id, notification_type, sent_at, read_at
      FROM trial_notifications
      WHERE user_id = ${userId}
      ORDER BY sent_at DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      userId: row.user_id as string,
      notificationType: row.notification_type as TrialNotificationLog['notificationType'],
      sentAt: new Date(row.sent_at as string),
      readAt: row.read_at ? new Date(row.read_at as string) : undefined,
    }));
  }

  async extendTrial(userId: string, days: number): Promise<{ success: boolean; newTrialEnd: Date | null }> {
    try {
      const rows = await this.db`
        UPDATE subscriptions
        SET trial_ends_at = COALESCE(trial_ends_at, trial_end) + ${`${days} days`}::interval,
            trial_end = trial_end + ${`${days} days`}::interval,
            updated_at = NOW()
        WHERE user_id = ${userId} AND status = 'trialing'
        RETURNING trial_ends_at, trial_end
      `;

      if (!rows[0]) {
        return { success: false, newTrialEnd: null };
      }

      const newEnd = rows[0].trial_ends_at || rows[0].trial_end;
      return { success: true, newTrialEnd: newEnd ? new Date(newEnd) : null };
    } catch (error) {
      console.error('[TrialNotificationService] Failed to extend trial:', error);
      return { success: false, newTrialEnd: null };
    }
  }

  private async sendNotification(
    userId: string,
    email: string,
    type: 'expiring_3days' | 'expiring_1day' | 'expired',
    daysRemaining: number
  ): Promise<boolean> {
    try {
      // Send email if configured
      if (this.emailService.isEnabled()) {
        await this.emailService.sendTrialExpirationEmail(email, daysRemaining);
      }

      // Send in-app notification
      const titles: Record<typeof type, string> = {
        expiring_3days: 'Trial Expiring Soon',
        expiring_1day: 'Trial Expires Tomorrow',
        expired: 'Trial Expired',
      };

      const messages: Record<typeof type, string> = {
        expiring_3days: `Your NovoSSH trial expires in ${daysRemaining} days. Upgrade now to keep full access.`,
        expiring_1day: 'Your NovoSSH trial expires tomorrow. Upgrade now to keep full access.',
        expired: 'Your NovoSSH trial has expired. Your plan has been downgraded to Free.',
      };

      await this.dispatcher.sendNotification({
        userId,
        type: 'trial_notification',
        priority: type === 'expired' ? 'high' : 'normal',
        title: titles[type],
        message: messages[type],
        actionUrl: '/settings',
        actionLabel: type === 'expired' ? 'Upgrade Now' : 'View Plans',
      });

      // Log the notification
      await this.logNotification(userId, type);
      return true;
    } catch (error) {
      console.error(`[TrialNotificationService] Failed to send ${type} notification:`, error);
      return false;
    }
  }

  private async logNotification(userId: string, notificationType: 'expiring_3days' | 'expiring_1day' | 'expired'): Promise<void> {
    try {
      await this.db`
        INSERT INTO trial_notifications (user_id, notification_type, sent_at)
        VALUES (${userId}, ${notificationType}, NOW())
        ON CONFLICT (user_id, notification_type, DATE(sent_at))
        DO NOTHING
      `;
    } catch (error) {
      console.error('[TrialNotificationService] Failed to log notification:', error);
    }
  }
}
