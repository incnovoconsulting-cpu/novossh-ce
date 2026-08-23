import { useEffect, useState, useCallback } from 'react';
import { NotificationApi } from '../lib/notificationApi';
import { NotificationType } from '../lib/notificationTypes';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const notifs = await NotificationApi.getNotifications();
      setNotifications(notifs);
    } catch (err) {
      console.error('[useNotifications] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUnreadCount = useCallback(async () => {
    try {
      const count = await NotificationApi.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await NotificationApi.markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    updateUnreadCount();
  }, [updateUnreadCount]);

  const deleteNotification = useCallback(async (id: string) => {
    await NotificationApi.deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    updateUnreadCount();
  }, [updateUnreadCount]);

  const updatePreferences = useCallback(async (type: NotificationType, prefs: any) => {
    await NotificationApi.updatePreferences(type, prefs);
  }, []);

  useEffect(() => {
    updateUnreadCount();
    const interval = setInterval(updateUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [updateUnreadCount]);

  return { notifications, unreadCount, loading, loadNotifications, markAsRead, deleteNotification, updateUnreadCount, updatePreferences };
};
