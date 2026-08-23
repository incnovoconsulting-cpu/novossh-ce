import { useEffect, FC } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import styles from './NotificationCenter.module.css';

export const NotificationCenter: FC = () => {
  const { notifications, unreadCount, loading, loadNotifications, markAsRead, deleteNotification } = useNotifications();

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <div className={styles['notification-center']}>
      <div className={styles.header}>
        <h2 className={styles.title}>Notifications</h2>
        <span className={styles.count}>{unreadCount} unread</span>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : notifications.length === 0 ? (
        <div className={styles['empty-state']}>No notifications</div>
      ) : (
        <div className={styles['notification-list']}>
          {notifications.map((notif) => (
            <div key={notif.id} className={styles['notification-item']}>
              <div className={styles.content}>
                <h3 className={styles.title}>{notif.title}</h3>
                <p className={styles.message}>{notif.message}</p>
              </div>
              <div className={styles.actions}>
                {!notif.read_at && <button onClick={() => markAsRead(notif.id)}>Read</button>}
                <button onClick={() => deleteNotification(notif.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
