import { Router, type Request, type Response } from 'express';
import { NotificationDispatcher, type NotificationType } from '../services/NotificationDispatcher.js';
import { authMiddleware as authenticateToken } from '../middleware/auth.js';
import { getDb } from '../db/connection.js';

const router = Router();
const dispatcher = new NotificationDispatcher();
const db = getDb();

router.get('/notifications', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const notifications = await dispatcher.getNotifications(userId, limit, offset);
    res.json({ success: true, notifications, count: notifications.length });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/notifications/unread-count', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const count = await dispatcher.getUnreadCount(userId);
    res.json({ success: true, count });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

router.post('/notifications/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    await dispatcher.markAsRead(id, userId);
    res.json({ success: true });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.delete('/notifications/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    await dispatcher.deleteNotification(id, userId);
    res.json({ success: true });
  } catch (_error) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

router.get('/notifications/preferences/:type', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { type } = req.params;
    const rows = await db`
      SELECT id, user_id, type, in_app_enabled, email_enabled, sms_enabled, slack_enabled, frequency
      FROM notification_preferences
      WHERE user_id = ${userId} AND type = ${type}
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, preference: rows[0] });
  } catch (_error) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.put('/notifications/preferences/:type', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { type } = req.params;
    await dispatcher.updatePreferences(userId, type as NotificationType, req.body);
    res.json({ success: true });
  } catch (_error) {
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
