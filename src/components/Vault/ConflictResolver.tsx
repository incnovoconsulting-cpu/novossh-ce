import { useState, FC } from 'react';
import type { SyncConflict } from '../../services/OfflineSyncService';
import styles from './ConflictResolver.module.css';

interface ConflictResolverProps {
  conflicts: SyncConflict[];
  isOpen: boolean;
  onResolve: (conflictId: string, strategy: 'local' | 'remote' | 'merged') => void | Promise<void>;
  onAutoResolve?: () => void | Promise<void>;
  onClose: () => void;
}

export const ConflictResolver: FC<ConflictResolverProps> = ({
  conflicts,
  isOpen,
  onResolve,
  onAutoResolve,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [autoResolving, setAutoResolving] = useState(false);

  if (!isOpen || conflicts.length === 0) {
    return null;
  }

  const current = conflicts[currentIndex];

  const handleResolve = async (strategy: 'local' | 'remote' | 'merged') => {
    setResolving(true);
    try {
      await onResolve(current.id, strategy);
      if (currentIndex < conflicts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setResolving(false);
    }
  };

  const handleAutoResolve = async () => {
    if (!onAutoResolve) return;
    setAutoResolving(true);
    try {
      await onAutoResolve();
      onClose();
    } catch (error) {
      console.error('Failed to auto-resolve conflicts:', error);
    } finally {
      setAutoResolving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <dialog open aria-label="Resolve conflicts" className={styles.dialog}>
        <div className={styles.header}>
          <h2>Resolve Conflict</h2>
          <span className={styles.count}>
            {currentIndex + 1} of {conflicts.length}
          </span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {current && (
          <div className={styles.conflict}>
            <div className={styles.resourceInfo}>
              <div><strong>Resource:</strong> {current.resourceType}</div>
              <div><strong>ID:</strong> {current.resourceId}</div>
            </div>

            <div className={styles.versions}>
              <div className={styles.version}>
                <div className={styles.label}>Local Version</div>
                <div className={styles.content}>
                  <div className={styles.timestamp}>
                    {new Date(current.localChange.timestamp).toLocaleString()}
                  </div>
                  <div className={styles.data}>
                    {JSON.stringify(current.localChange.data, null, 2)}
                  </div>
                </div>
              </div>

              <div className={styles.vs}>VS</div>

              <div className={styles.version}>
                <div className={styles.label}>Remote Version</div>
                <div className={styles.content}>
                  <div className={styles.timestamp}>
                    {new Date(current.remoteChange.timestamp).toLocaleString()}
                  </div>
                  <div className={styles.data}>
                    {JSON.stringify(current.remoteChange.data, null, 2)}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.strategies}>
              <button
                className={styles.strategy}
                onClick={() => handleResolve('local')}
                disabled={resolving}
                aria-label="Use local version"
              >
                <div className={styles.icon}>💻</div>
                <div className={styles.name}>Use Local</div>
                <div className={styles.desc}>Keep your device's version</div>
              </button>

              <button
                className={styles.strategy}
                onClick={() => handleResolve('remote')}
                disabled={resolving}
                aria-label="Use remote version"
              >
                <div className={styles.icon}>☁️</div>
                <div className={styles.name}>Use Remote</div>
                <div className={styles.desc}>Keep the server's version</div>
              </button>

              <button
                className={styles.strategy}
                onClick={() => handleResolve('merged')}
                disabled={resolving}
                aria-label="Merge versions"
              >
                <div className={styles.icon}>🔀</div>
                <div className={styles.name}>Merge</div>
                <div className={styles.desc}>Combine both versions</div>
              </button>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          {onAutoResolve && (
            <button
              className={styles.autoResolve}
              onClick={handleAutoResolve}
              disabled={autoResolving}
              aria-label="Auto-resolve all conflicts"
            >
              {autoResolving ? 'Auto-resolving...' : 'Auto-Resolve All'}
            </button>
          )}
          {currentIndex < conflicts.length - 1 && (
            <button
              className={styles.next}
              onClick={() => setCurrentIndex(currentIndex + 1)}
              aria-label="Next conflict"
            >
              Next
            </button>
          )}
          <button className={styles.close} onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
};
