import { FC } from 'react';
import styles from './QuotaAlert.module.css';

export const QuotaAlert: FC<{ resource: string; current: number; limit: number }> = ({ resource, current, limit }) => {
  const percent = (current / limit) * 100;
  const severity = percent >= 100 ? 'critical' : percent >= 95 ? 'high' : percent >= 80 ? 'warning' : 'info';

  return (
    <div className={`${styles['quota-alert']} ${styles[severity]}`}>
      <h3>{resource} quota {Math.round(percent)}% used</h3>
      <div className={styles['progress-bar']}>
        <div className={styles['progress-fill']} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p>{current} of {limit}</p>
    </div>
  );
};
