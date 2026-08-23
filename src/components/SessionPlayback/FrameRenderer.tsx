import { PlaybackFrame } from '../../lib/types';
import styles from './FrameRenderer.module.css';

/**
 * Props for FrameRenderer component
 */
interface FrameRendererProps {
  /** Frame to render */
  frame: PlaybackFrame;
  /** User name for display (fetched separately) */
  userName?: string;
  /** Whether this frame is highlighted */
  isHighlighted?: boolean;
}

/**
 * Renders individual command/output frames with syntax highlighting
 *
 * Displays command frames with user info and exit codes, or output frames
 * with scrollable content. Uses monospace font for terminal-like appearance.
 *
 * @example
 * ```tsx
 * <FrameRenderer
 *   frame={{
 *     type: 'command',
 *     timestamp: 5000,
 *     command: 'ls -la /home',
 *     userId: 'user-123'
 *   }}
 *   userName="alice"
 *   isHighlighted={true}
 * />
 * ```
 */
export function FrameRenderer({
  frame,
  userName,
  isHighlighted = false,
}: FrameRendererProps) {
  // Format timestamp as MM:SS
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (frame.type === 'command') {
    return (
      <div
        className={`${styles.frame} ${styles.commandFrame} ${isHighlighted ? styles.highlighted : ''}`}
      >
        <div className={styles.frameHeader}>
          <span className={styles.frameType}>$</span>
          <span className={styles.timestamp}>{formatTime(frame.timestamp)}</span>
          {userName && <span className={styles.userName}>{userName}</span>}
        </div>
        <div className={styles.commandContent}>
          <code className={styles.command}>{frame.command || ''}</code>
        </div>
        {frame.exitCode !== undefined && (
          <div className={styles.frameFooter}>
            <span
              className={`${styles.exitCode} ${
                frame.exitCode === 0 ? styles.exitCodeSuccess : styles.exitCodeError
              }`}
            >
              exit code: {frame.exitCode}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (frame.type === 'output') {
    return (
      <div
        className={`${styles.frame} ${styles.outputFrame} ${isHighlighted ? styles.highlighted : ''}`}
      >
        <div className={styles.frameHeader}>
          <span className={styles.frameType}>❯</span>
          <span className={styles.timestamp}>{formatTime(frame.timestamp)}</span>
        </div>
        <div className={styles.outputContent}>
          <pre className={styles.output}>{frame.output || ''}</pre>
        </div>
      </div>
    );
  }

  if (frame.type === 'sync') {
    return (
      <div className={`${styles.frame} ${styles.syncFrame} ${isHighlighted ? styles.highlighted : ''}`}>
        <div className={styles.frameHeader}>
          <span className={styles.frameType}>⟳</span>
          <span className={styles.timestamp}>{formatTime(frame.timestamp)}</span>
          <span className={styles.syncLabel}>Multi-device sync</span>
        </div>
      </div>
    );
  }

  return null;
}
