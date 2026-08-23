import styles from './OptimisticUpdateBadge.module.css';

/**
 * Props for OptimisticUpdateBadge component
 */
interface OptimisticUpdateBadgeProps {
  /** Whether the update is pending sync */
  isPending: boolean;
  /** Callback to retry sync */
  onRetry?: () => void;
}

/**
 * Badge for pending optimistic updates
 *
 * Displays a small badge indicating that a change is pending sync to the server.
 * Shows a spinner animation while pending and allows users to retry the sync.
 * Fades in and out smoothly with CSS animations.
 *
 * @example
 * ```tsx
 * <OptimisticUpdateBadge
 *   isPending={true}
 *   onRetry={() => retrySync()}
 * />
 * ```
 */
export function OptimisticUpdateBadge({
  isPending,
  onRetry,
}: OptimisticUpdateBadgeProps) {
  if (!isPending) {
    return null;
  }

  return (
    <button
      className={styles.badge}
      onClick={onRetry}
      disabled={!onRetry}
      title={onRetry ? 'Click to retry sync' : 'Pending sync'}
      aria-label="Pending sync badge"
    >
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.text}>Pending</span>
    </button>
  );
}
