import styles from './ReconnectionBanner.module.css';

/**
 * Props for ReconnectionBanner component
 */
interface ReconnectionBannerProps {
  /** Whether reconnection is currently in progress */
  isReconnecting: boolean;
  /** Progress percentage of reconnection (0-100) */
  progress: number;
  /** Array of error messages from reconnection attempts */
  errors: string[];
  /** Callback to dismiss the banner */
  onDismiss?: () => void;
  /** Callback to retry reconnection */
  onRetry?: () => void;
}

/**
 * Reconnection progress banner displayed below header
 *
 * Shows reconnection progress with animated progress bar, error messages,
 * and retry/dismiss buttons. Appears when the application is trying to
 * reconnect and sync changes after going offline.
 *
 * @example
 * ```tsx
 * <ReconnectionBanner
 *   isReconnecting={true}
 *   progress={65}
 *   errors={[]}
 *   onDismiss={() => setBannerVisible(false)}
 *   onRetry={() => retryReconnection()}
 * />
 * ```
 */
export function ReconnectionBanner({
  isReconnecting,
  progress,
  errors,
  onDismiss,
  onRetry,
}: ReconnectionBannerProps) {
  if (!isReconnecting && errors.length === 0) {
    return null;
  }

  const hasErrors = errors.length > 0;

  return (
    <div className={`${styles.banner} ${hasErrors ? styles.error : styles.progress}`}>
      {/* Content */}
      <div className={styles.content}>
        <div className={styles.leftSection}>
          {/* Status Icon */}
          <div className={styles.iconWrapper}>
            {hasErrors ? (
              <span className={styles.errorIcon}>⚠️</span>
            ) : (
              <span className={styles.syncIcon}>🔄</span>
            )}
          </div>

          {/* Message and Progress */}
          <div className={styles.details}>
            <div className={styles.message}>
              {hasErrors ? 'Reconnection Error' : 'Reconnecting...'}
            </div>
            {isReconnecting && !hasErrors && (
              <>
                <div className={styles.progressBarContainer}>
                  <progress
                    className={styles.progressFill}
                    value={Math.min(progress, 100)}
                    max={100}
                  />
                </div>
                <div className={styles.progressText}>
                  {Math.round(progress)}% - Syncing changes...
                </div>
              </>
            )}
            {hasErrors && (
              <div className={styles.errorList}>
                {errors.map((error, index) => (
                  <div key={index} className={styles.errorItem}>
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {hasErrors && onRetry && (
            <button
              className={styles.retryButton}
              onClick={onRetry}
              title="Retry reconnection"
              aria-label="Retry reconnection"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              className={styles.dismissButton}
              onClick={onDismiss}
              title="Dismiss"
              aria-label="Dismiss reconnection banner"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
