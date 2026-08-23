import { FC } from 'react';
import { useUsageMetrics, UsageForecast as UsageForecastData } from '../../hooks/useUsageMetrics';
import styles from './UsageForecast.module.css';

/**
 * Display 7/14/30-day usage projections with confidence intervals
 * Helps users understand end-of-month quota status
 */
export const UsageForecast: FC = () => {
  const { forecasts, loading, error } = useUsageMetrics();

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'low':
        return '#4caf50';
      case 'medium':
        return '#ffc107';
      case 'high':
        return '#ff9800';
      case 'very_high':
        return '#f44336';
      default:
        return '#666';
    }
  };

  const getRiskLevel = (risk: string): string => {
    return risk.charAt(0).toUpperCase() + risk.slice(1).replace('_', ' ');
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

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>Failed to load forecast: {error}</p>
        </div>
      </div>
    );
  }

  if (loading && forecasts.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <p>Loading forecasts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Usage Forecast</h2>
        <p className={styles.subtitle}>Projected end-of-month usage based on current activity</p>
      </div>

      <div className={styles.forecastsGrid}>
        {forecasts.map((forecast: UsageForecastData) => (
          <div key={forecast.resourceType} className={styles.forecastCard}>
            <div className={styles.cardHeader}>
              <h3>{getResourceLabel(forecast.resourceType)}</h3>
              <span
                className={styles.riskBadge}
                style={{ backgroundColor: getRiskColor(forecast.exceedanceRisk) }}
              >
                {getRiskLevel(forecast.exceedanceRisk)} Risk
              </span>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressInfo}>
                <span className={styles.label}>Days Elapsed</span>
                <span className={styles.stat}>
                  {forecast.currentDay} / {forecast.totalDays}
                </span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${(forecast.currentDay / forecast.totalDays) * 100}%` }}
                />
              </div>
            </div>

            <div className={styles.projectionBox}>
              <div className={styles.projectionRow}>
                <span className={styles.label}>Current Usage</span>
                <span className={styles.value}>{formatValue(forecast.resourceType, forecast.currentUsage)}</span>
              </div>

              <div className={styles.projectionRow}>
                <span className={styles.label}>Daily Average</span>
                <span className={styles.value}>{formatValue(forecast.resourceType, Math.ceil(forecast.dailyAverage))}</span>
              </div>

              <div className={styles.divider} />

              <div className={styles.projectionRow}>
                <span className={styles.label}>Projected End-of-Month</span>
                <span className={`${styles.value} ${styles.projected}`}>
                  {formatValue(forecast.resourceType, forecast.projectedEndOfMonth)}
                </span>
              </div>

              <p className={styles.confidence}>
                Confidence Range: {formatValue(forecast.resourceType, forecast.confidenceLow)} -{' '}
                {formatValue(forecast.resourceType, forecast.confidenceHigh)}
              </p>

              <div className={styles.usagePercent}>
                <span className={styles.label}>Projected Usage</span>
                <span
                  className={styles.percent}
                  style={{
                    color: getRiskColor(forecast.exceedanceRisk),
                  }}
                >
                  {forecast.usagePercent.toFixed(1)}%
                </span>
              </div>

              {forecast.usagePercent > 100 && (
                <div className={styles.exceedanceWarning}>
                  <strong>Note:</strong> Your usage is projected to exceed the quota for this month.
                  Consider upgrading your plan or reducing usage.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsageForecast;
