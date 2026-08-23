import { FC } from 'react';
import type { SyncConflict } from '../../hooks/useSyncApi';
import styles from './SyncStatus.module.css';

interface SyncStatusState {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  syncProgress: number;
}

interface SyncStatusProps {
  syncState: SyncStatusState | null;
  conflicts: SyncConflict[];
}

export const SyncStatus: FC<SyncStatusProps> = ({ syncState, conflicts }) => {
  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString();
  };

  const getStatusIcon = () => {
    if (!syncState) return '⏳';
    if (syncState.isSyncing) return '🔄';
    if (conflicts.length > 0) return '⚠️';
    return '✓';
  };

  return (
    <div className={styles.container}>
      <div className={styles.status}>
        <span className={styles.icon}>{getStatusIcon()}</span>
        <div className={styles.info}>
          <div className={styles.label}>
            {syncState?.isSyncing ? 'Syncing...' : 'Last sync'}
          </div>
          <div className={styles.time}>
            {formatTime(syncState?.lastSyncAt ?? null)}
          </div>
        </div>
      </div>

      {syncState?.isSyncing && (syncState.syncProgress ?? 0) > 0 && (
        <div className={styles.progressBar}>
          <div
            className={styles.progress}
            style={{ width: `${syncState.syncProgress}%` }}
          />
        </div>
      )}

      {conflicts.length > 0 && (
        <div className={styles.conflictBadge}>
          {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};
