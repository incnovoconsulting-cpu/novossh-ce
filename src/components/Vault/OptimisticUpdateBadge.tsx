import styles from './OptimisticUpdateBadge.module.css';

/**
 * Props for OptimisticUpdateBadge component
 */
interface OptimisticUpdateBadgeProps {
  /** Whether the change is currently pending */
  isPending: boolean;
  /** Current status of the pending change */
  status?: 'pending' | 'syncing' | 'synced' | 'failed';
  /** Error message if sync failed */
  error?: string;
  /** Callback to retry syncing */
  onRetry?: () => void;
}

/**
 * Badge component showing optimistic update status for entries
 *
 * Displays a small indicator badge showing the status of a pending change.
 * Shows different states for pending, syncing, synced, and failed states.
 * Includes retry functionality for failed syncs.
 *
 * @example
 * ```tsx
 * <OptimisticUpdateBadge
 *   isPending={true}
 *   status="pending"
 *   onRetry={() => retrySync()}
 * />
 * ```
 */
export function OptimisticUpdateBadge({
  isPending,
  status = 'pending',
  error,
  onRetry,
}: OptimisticUpdateBadgeProps) {
  if (!isPending) {
    return null;
  }

  const getIcon = () => {
    switch (status) {
      case 'syncing':
        return <span className={`${styles.icon} ${styles.spinning}`}>🔄</span>;
      case 'synced':
        return <span className={styles.icon}>✓</span>;
      case 'failed':
        return <span className={styles.icon}>⚠️</span>;
      case 'pending':
      default:
        return <span className={styles.icon}>●</span>;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'syncing':
        return 'Syncing...';
      case 'synced':
        return 'Synced';
      case 'failed':
        return 'Sync failed';
      case 'pending':
      default:
        return 'Pending';
    }
  };

  return (
    <div className={`${styles.badge} ${styles[status]}`} title={error || getLabel()}>
      {getIcon()}
      <span className={styles.label}>{getLabel()}</span>
      {status === 'failed' && onRetry && (
        <button
          className={styles.retryIcon}
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          title="Retry sync"
          aria-label="Retry sync"
        >
          ↻
        </button>
      )}
    </div>
  );
}
