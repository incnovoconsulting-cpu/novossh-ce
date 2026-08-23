import type { PeerInfo } from '../../lib/types';
import styles from './PeerList.module.css';

/**
 * Props for PeerList component
 */
interface PeerListProps {
  /** Array of peer information */
  peers: PeerInfo[];
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean;
  /** Callback when user initiates sync with a specific peer */
  onSyncWithPeer: (peerId: string) => void;
}

/**
 * P2P peer discovery and sync list
 *
 * Displays a list of discovered peers with their connection status and
 * last sync information. Provides visual indicators for connection state
 * and manual sync buttons for each peer. Shows an empty state when no
 * peers are available.
 *
 * @example
 * ```tsx
 * <PeerList
 *   peers={[
 *     { id: '1', name: 'Device 1', connectionStatus: 'connected', lastSyncedAt: 1234567890 }
 *   ]}
 *   isSyncing={false}
 *   onSyncWithPeer={(peerId) => syncWithPeer(peerId)}
 * />
 * ```
 */
export function PeerList({ peers, isSyncing, onSyncWithPeer }: PeerListProps) {
  /**
   * Get the appropriate status indicator emoji for connection status
   */
  const getStatusIndicator = (status: PeerInfo['connectionStatus']) => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
      default:
        return '🔴';
    }
  };

  /**
   * Get readable status text
   */
  const getStatusText = (status: PeerInfo['connectionStatus']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting';
      case 'disconnected':
      default:
        return 'Disconnected';
    }
  };

  /**
   * Format the last sync time as relative text
   */
  const formatLastSyncTime = (timestamp?: number): string => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (peers.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <div className={styles.emptyTitle}>No Peers Discovered</div>
          <div className={styles.emptyDescription}>
            Peers will appear here as they connect to the P2P network
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.listHeader}>
        <h3 className={styles.listTitle}>Peers ({peers.length})</h3>
      </div>

      <div className={styles.peersList}>
        {peers.map((peer) => (
          <div key={peer.id} className={styles.peerItem}>
            {/* Peer info section */}
            <div className={styles.peerInfo}>
              {/* Status indicator */}
              <div className={styles.statusIndicatorContainer}>
                <span
                  className={`${styles.statusIndicator} ${styles[peer.connectionStatus]}`}
                  title={getStatusText(peer.connectionStatus)}
                >
                  {getStatusIndicator(peer.connectionStatus)}
                </span>
              </div>

              {/* Peer details */}
              <div className={styles.peerDetails}>
                <div className={styles.peerName}>{peer.name}</div>
                <div className={styles.peerMeta}>
                  <span className={styles.statusText}>
                    {getStatusText(peer.connectionStatus)}
                  </span>
                  <span className={styles.metaSeparator}>•</span>
                  <span className={styles.lastSyncText}>
                    Synced {formatLastSyncTime(peer.lastSyncedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sync button */}
            <button
              className={styles.syncButton}
              onClick={() => onSyncWithPeer(peer.id)}
              disabled={
                isSyncing ||
                peer.connectionStatus === 'disconnected' ||
                peer.connectionStatus === 'connecting'
              }
              title={
                isSyncing
                  ? 'Sync in progress'
                  : peer.connectionStatus === 'disconnected'
                    ? 'Peer is disconnected'
                    : 'Sync with this peer'
              }
              aria-label={`Sync with ${peer.name}`}
            >
              {isSyncing ? (
                <span className={styles.syncSpinner} />
              ) : (
                <span className={styles.syncIcon}>⤴</span>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
