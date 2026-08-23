import { useEffect, useState, useRef, FC } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import styles from './NotificationBell.module.css';

export const NotificationBell: FC<{ onOpenCenter?: () => void }> = ({ onOpenCenter }) => {
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles['notification-bell']} ref={menuRef}>
      <button className={styles['bell-button']} onClick={() => setIsOpen(!isOpen)}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {isOpen && (
        <div className={styles['dropdown-menu']}>
          <button className={styles['view-all-button']} onClick={() => { setIsOpen(false); onOpenCenter?.(); }}>
            View All Notifications
          </button>
        </div>
      )}
    </div>
  );
};
