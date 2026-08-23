import styles from './SyncProgressPanel.module.css';

/**
 * Props for SyncProgressPanel component
 */
interface SyncProgressPanelProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Number of items synced */
  syncedCount: number;
  /** Total number of items to sync */
  totalCount: number;
  /** Current sync status */
  status: 'idle' | 'syncing' | 'error';
  /** Callback to retry sync on error */
  onRetry?: () => void;
  /** Callback to dismiss the panel */
  onDismiss?: () => void;
}

/**
 * Detailed sync progress view with animated progress bar
 *
 * Displays real-time sync progress with a visual progress bar, item count,
 * status message, and error handling. Shows ETA when syncing and provides
 * retry functionality on error. Can be dismissed.
 *
 * @example
 * ```tsx
 * <SyncProgressPanel
 *   progress={45}
 *   syncedCount={45}
 *   totalCount={100}
 *   status="syncing"
 *   onDismiss={() => setShowPanel(false)}
 * />
 * ```
 */
export function SyncProgressPanel({
  progress,
  syncedCount,
  totalCount,
  status,
  onRetry,
  onDismiss,
}: SyncProgressPanelProps) {
  // Calculate ETA (simplified: assuming linear progress)
  const estimateETA = () => {
    if (progress === 0 || status !== 'syncing') return null;
    const remainingPercent = 100 - progress;
    const estimatedSeconds = Math.ceil((remainingPercent / progress) * 5); // assuming 5 seconds base time
    if (estimatedSeconds < 60) {
      return `${estimatedSeconds}s`;
    }
    const minutes = Math.ceil(estimatedSeconds / 60);
    return `${minutes}m`;
  };

  const eta = estimateETA();

  const getStatusMessage = () => {
    switch (status) {
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync failed';
      case 'idle':
      default:
        return 'Sync complete';
    }
  };

  return (
    <div className={`${styles.panel} ${styles[status]}`}>
      {/* Header with dismiss button */}
      <div className={styles.header}>
        <div className={styles.titleContainer}>
          <h3 className={styles.title}>Sync Progress</h3>
          {status === 'syncing' && <span className={styles.spinner} />}
        </div>
        {onDismiss && (
          <button
            className={styles.dismissButton}
            onClick={onDismiss}
            title="Dismiss"
            aria-label="Dismiss sync panel"
          >
            ✕
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <progress
            className={`${styles.progressFill} ${status === 'syncing' ? styles.animating : ''}`}
            value={Math.min(progress, 100)}
            max={100}
          />
        </div>
      </div>

      {/* Status info */}
      <div className={styles.statusContainer}>
        <div className={styles.statusLeft}>
          <span className={styles.statusMessage}>{getStatusMessage()}</span>
          {eta && <span className={styles.eta}>ETA: {eta}</span>}
        </div>
        <span className={styles.syncCount}>
          {syncedCount} / {totalCount}
        </span>
      </div>

      {/* Percentage */}
      <div className={styles.percentageContainer}>
        <span className={styles.percentage}>{Math.round(progress)}%</span>
      </div>

      {/* Error state with retry button */}
      {status === 'error' && onRetry && (
        <div className={styles.errorContainer}>
          <button className={styles.retryButton} onClick={onRetry}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
