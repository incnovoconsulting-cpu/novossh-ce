import { NotificationType } from './notificationTypes';
import { csrfFetch } from './csrfFetch';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export class NotificationApi {
  static async getNotifications(limit: number = 50, offset: number = 0): Promise<any[]> {
    const response = await csrfFetch(`${API_URL}/api/notifications?limit=${limit}&offset=${offset}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed');
    return response.json().then((r: any) => r.notifications || []);
  }

  static async markAsRead(id: string): Promise<void> {
    await csrfFetch(`${API_URL}/api/notifications/${id}/read`, {
      method: 'POST',
      credentials: 'include',
    });
  }

  static async deleteNotification(id: string): Promise<void> {
    await csrfFetch(`${API_URL}/api/notifications/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
  }

  static async getUnreadCount(): Promise<number> {
    const response = await csrfFetch(`${API_URL}/api/notifications/unread-count`, {
      credentials: 'include',
    });
    const data = await response.json();
    return data.count || 0;
  }

  static async updatePreferences(type: NotificationType, prefs: any): Promise<void> {
    await csrfFetch(`${API_URL}/api/notifications/preferences/${type}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
  }
}
