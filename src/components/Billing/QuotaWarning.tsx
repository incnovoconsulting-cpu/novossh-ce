import { FC } from 'react';
import { useUsageMetrics, QuotaAlert } from '../../hooks/useUsageMetrics';
import styles from './QuotaWarning.module.css';

/**
 * Display soft and hard limit alerts
 * Notifies users when quota thresholds are exceeded
 */
export const QuotaWarning: FC = () => {
  const { alerts, acknowledgeAlert } = useUsageMetrics();

  if (alerts.length === 0) {
    return null;
  }

  const getAlertColor = (alertType: string): string => {
    switch (alertType) {
      case 'soft_warning':
        return '#ffc107';
      case 'critical':
        return '#ff9800';
      case 'hard_limit':
        return '#f44336';
      default:
        return '#666';
    }
  };

  const getAlertIcon = (alertType: string): string => {
    switch (alertType) {
      case 'soft_warning':
        return '⚠';
      case 'critical':
        return '⚠️';
      case 'hard_limit':
        return '❌';
      default:
        return 'ℹ';
    }
  };

  const getResourceLabel = (resource: string): string => {
    switch (resource) {
      case 'api_calls':
        return 'API Calls';
      case 'storage_bytes':
        return 'Storage';
      case 'session_minutes':
        return 'Session Time';
      case 'sftp_bytes':
        return 'SFTP Transfer';
      default:
        return resource;
    }
  };

  return (
    <div className={styles.container}>
      {alerts.map((alert: QuotaAlert) => (
        <div
          key={alert.id}
          className={`${styles.alert} ${styles[`type-${alert.alertType}`]}`}
          style={{ borderLeftColor: getAlertColor(alert.alertType) }}
        >
          <div className={styles.content}>
            <div className={styles.header}>
              <span className={styles.icon}>{getAlertIcon(alert.alertType)}</span>
              <div className={styles.title}>
                <h4>{getResourceLabel(alert.resourceType)}</h4>
                <span className={styles.type}>
                  {alert.alertType === 'soft_warning'
                    ? 'Warning'
                    : alert.alertType === 'critical'
                    ? 'Critical'
                    : 'Hard Limit Exceeded'}
                </span>
              </div>
            </div>

            <div className={styles.details}>
              <p>
                You've used {alert.thresholdPercent}% of your {getResourceLabel(alert.resourceType).toLowerCase()} quota.
              </p>
              <p className={styles.usage}>
                Current usage: <strong>{alert.currentUsage.toLocaleString()}</strong> /{' '}
                <strong>{alert.limitValue.toLocaleString()}</strong>
              </p>

              {alert.alertType === 'hard_limit' && (
                <p className={styles.warning}>
                  Your quota has been exceeded. Operations may be blocked until the next billing period.
                </p>
              )}
            </div>
          </div>

          <button
            className={styles.dismissBtn}
            onClick={() => acknowledgeAlert(alert.id)}
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default QuotaWarning;
