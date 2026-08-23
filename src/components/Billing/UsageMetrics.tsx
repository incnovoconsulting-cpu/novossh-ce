import { FC } from 'react';
import { useUsageMetrics, QuotaStatus } from '../../hooks/useUsageMetrics';
import styles from './UsageMetrics.module.css';

/**
 * Display real-time usage metrics and quotas
 * Shows current usage, limits, and usage percentages for all metered resources
 */
export const UsageMetrics: FC = () => {
  const { statuses, loading, error, lastUpdated } = useUsageMetrics();

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ok':
        return 'green';
      case 'warning':
        return 'yellow';
      case 'critical':
        return 'orange';
      case 'exceeded':
        return 'red';
      default:
        return 'gray';
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

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatValue = (resource: string, value: number): string => {
    if (resource === 'storage_bytes' || resource === 'sftp_bytes') {
      return formatBytes(value);
    }
    if (resource === 'session_minutes') {
      const hours = Math.floor(value / 60);
      const mins = value % 60;
      return `${hours}h ${mins}m`;
    }
    return value.toLocaleString();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Resource Usage</h2>
        {lastUpdated && (
          <span className={styles.lastUpdated}>
            Updated {new Date(lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

      {error && (
        <div className={styles.error}>
          <p>Failed to load usage metrics: {error}</p>
        </div>
      )}

      {loading && statuses.length === 0 ? (
        <div className={styles.loading}>
          <p>Loading usage metrics...</p>
        </div>
      ) : (
        <div className={styles.metricsGrid}>
          {statuses.map((quota: QuotaStatus) => (
            <div
              key={quota.resourceType}
              className={`${styles.metricCard} ${styles[`status-${quota.status}`]}`}
            >
              <div className={styles.metricHeader}>
                <h3>{getResourceLabel(quota.resourceType)}</h3>
                <span className={styles.statusBadge} style={{ color: getStatusColor(quota.status) }}>
                  {quota.status.toUpperCase()}
                </span>
              </div>

              <div className={styles.metricBody}>
                <div className={styles.usageRow}>
                  <span className={styles.label}>Current Usage:</span>
                  <span className={styles.value}>
                    {formatValue(quota.resourceType, quota.currentUsage)} /{' '}
                    {formatValue(quota.resourceType, quota.hardLimit)}
                  </span>
                </div>

                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${Math.min(quota.usagePercent, 100)}%`,
                      backgroundColor: getStatusColor(quota.status),
                    }}
                  />
                  <span className={styles.progressText}>{quota.usagePercent.toFixed(1)}%</span>
                </div>

                <div className={styles.thresholds}>
                  <div className={styles.thresholdRow}>
                    <span className={styles.label}>Warning (80%):</span>
                    <span className={styles.value}>{formatValue(quota.resourceType, quota.softLimitWarning)}</span>
                  </div>
                  <div className={styles.thresholdRow}>
                    <span className={styles.label}>Critical (95%):</span>
                    <span className={styles.value}>{formatValue(quota.resourceType, quota.softLimitCritical)}</span>
                  </div>
                </div>

                <div className={styles.period}>
                  <span className={styles.label}>Billing Period:</span>
                  <span className={styles.value}>
                    {new Date(quota.periodStart).toLocaleDateString()} to{' '}
                    {new Date(quota.periodEnd).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UsageMetrics;
