import { useEffect, useRef, MouseEvent } from 'react';
import { PlaybackFrame } from '../../lib/types';
import styles from './SessionTimeline.module.css';

/**
 * Props for SessionTimeline component
 */
interface SessionTimelineProps {
  /** Total duration of session in milliseconds */
  totalDuration: number;
  /** Array of frames with timestamps */
  frames: PlaybackFrame[];
  /** Current position in playback (milliseconds) */
  currentTime?: number;
  /** Callback when user seeks to a position */
  onSeek?: (timestamp: number) => void;
  /** Allow interactive seeking */
  interactive?: boolean;
}

/**
 * Visual timeline of session with command positions
 *
 * Shows a horizontal timeline bar with colored markers for commands, outputs,
 * and sync events. Includes a progress indicator for current playback position.
 * Supports clicking to seek to specific positions.
 *
 * @example
 * ```tsx
 * <SessionTimeline
 *   totalDuration={120000}
 *   frames={sessionData.frames}
 *   currentTime={45000}
 *   onSeek={(ts) => player.seek(ts)}
 *   interactive={true}
 * />
 * ```
 */
export function SessionTimeline({
  totalDuration,
  frames,
  currentTime = 0,
  onSeek,
  interactive = true,
}: SessionTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Update progress indicator
  useEffect(() => {
    if (progressRef.current) {
      const percentage = (currentTime / totalDuration) * 100;
      progressRef.current.style.left = `${Math.min(percentage, 100)}%`;
    }
  }, [currentTime, totalDuration]);

  // Format time as MM:SS
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle seeking
  const handleTimelineClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!interactive || !timelineRef.current || !onSeek) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const timestamp = Math.min(Math.max(0, percentage * totalDuration), totalDuration);

    onSeek(timestamp);
  };

  // Filter frames to find command positions
  const commandFrames = frames.filter((f) => f.type === 'command');
  const commandCount = commandFrames.length;

  return (
    <div className={styles.timelineContainer}>
      {/* Timeline header with times */}
      <div className={styles.timelineHeader}>
        <span className={styles.timeStart}>{formatTime(0)}</span>
        <span className={styles.timeEnd}>{formatTime(totalDuration)}</span>
      </div>

      {/* Main timeline bar */}
      <div
        ref={timelineRef}
        className={`${styles.timeline} ${interactive ? styles.interactive : ''}`}
        onClick={handleTimelineClick}
        role="slider"
        tabIndex={interactive ? 0 : -1}
        aria-label="Session timeline"
        aria-valuenow={currentTime}
        aria-valuemin={0}
        aria-valuemax={totalDuration}
        onKeyDown={(e) => {
          if (!interactive || !onSeek) return;
          const step = totalDuration / 100;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSeek(Math.min(currentTime + step, totalDuration));
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSeek(Math.max(currentTime - step, 0));
          }
        }}
      >
        {/* Background track */}
        <div className={styles.timelineTrack}>
          {/* Frame markers */}
          {frames.map((frame, index) => {
            const percentage = (frame.timestamp / totalDuration) * 100;
            return (
              <div
                key={index}
                className={`${styles.frameMarker} ${styles[frame.type]}`}
                style={{ left: `${percentage}%` }}
                title={`${frame.type} at ${formatTime(frame.timestamp)}`}
              />
            );
          })}

          {/* Progress fill background */}
          <div
            className={styles.progressBackground}
            style={{ width: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>

        {/* Progress indicator thumb */}
        <div
          ref={progressRef}
          className={styles.progressThumb}
          title={formatTime(currentTime)}
        />
      </div>

      {/* Timeline stats */}
      <div className={styles.timelineStats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Duration:</span>
          <span className={styles.statValue}>{formatTime(totalDuration)}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Commands:</span>
          <span className={styles.statValue}>{commandCount}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Avg interval:</span>
          <span className={styles.statValue}>
            {commandCount > 1 ? formatTime(totalDuration / commandCount) : '—'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.command}`} />
          <span>Command</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.output}`} />
          <span>Output</span>
        </div>
        <div className={styles.legendItem}>
          <div className={`${styles.legendDot} ${styles.sync}`} />
          <span>Sync</span>
        </div>
      </div>
    </div>
  );
}
