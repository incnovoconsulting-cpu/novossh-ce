import { useState } from 'react';
import styles from './OfflineIndicator.module.css';

/**
 * Props for OfflineIndicator component
 */
interface OfflineIndicatorProps {
  /** Whether the application is currently online */
  isOnline: boolean;
  /** Number of unsaved changes pending sync */
  unsavedChanges: number;
  /** Callback when user taps/clicks to sync */
  onTapToSync?: () => void;
}

/**
 * Top-level offline status indicator with unsaved changes badge
 *
 * Displays the connection status (online/offline) with an icon and shows
 * a count badge when there are unsaved changes. Includes a tooltip with
 * the number of unsaved changes and a "Tap to sync" message.
 *
 * @example
 * ```tsx
 * <OfflineIndicator
 *   isOnline={true}
 *   unsavedChanges={3}
 *   onTapToSync={() => syncChanges()}
 * />
 * ```
 */
export function OfflineIndicator({
  isOnline,
  unsavedChanges,
  onTapToSync,
}: OfflineIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = () => {
    if (unsavedChanges > 0 && onTapToSync) {
      onTapToSync();
    }
  };

  return (
    <div
      className={styles.container}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && unsavedChanges > 0 && onTapToSync) {
          e.preventDefault();
          onTapToSync();
        }
      }}
      role="status"
      aria-live="polite"
      aria-label={`${isOnline ? 'Online' : 'Offline'} - ${unsavedChanges} unsaved changes`}
    >
      {/* Status Icon */}
      <div className={styles.iconWrapper}>
        <span className={`${styles.icon} ${isOnline ? styles.online : styles.offline}`}>
          {isOnline ? '🟢' : '🔴'}
        </span>
      </div>

      {/* Unsaved Changes Badge */}
      {unsavedChanges > 0 && (
        <span className={styles.badge} title={`${unsavedChanges} unsaved changes`}>
          {unsavedChanges}
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className={styles.tooltip}>
          <div className={styles.tooltipContent}>
            <div className={styles.tooltipStatus}>
              {isOnline ? 'Online' : 'Offline'}
            </div>
            {unsavedChanges > 0 && (
              <>
                <div className={styles.tooltipDivider} />
                <div className={styles.tooltipUnsaved}>
                  {unsavedChanges} change{unsavedChanges !== 1 ? 's' : ''} pending
                </div>
                {onTapToSync && (
                  <div className={styles.tooltipSync}>Tap to sync</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
