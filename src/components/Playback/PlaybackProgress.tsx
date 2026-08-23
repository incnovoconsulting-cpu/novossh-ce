import styles from './PlaybackProgress.module.css';

/**
 * Props for PlaybackProgress component
 */
interface PlaybackProgressProps {
  /** Current time in milliseconds */
  currentTime: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Whether playback is currently playing */
  isPlaying: boolean;
}

/**
 * Converts milliseconds to HH:MM:SS or MM:SS format
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Time display for session playback with current and total duration
 *
 * Shows elapsed time and total duration in MM:SS or HH:MM:SS format.
 * Updates in real-time as playback progresses.
 *
 * @example
 * ```tsx
 * <PlaybackProgress
 *   currentTime={45000}  // 45 seconds
 *   duration={300000}    // 5 minutes
 *   isPlaying={true}
 * />
 * ```
 */
export function PlaybackProgress({
  currentTime,
  duration,
  isPlaying,
}: PlaybackProgressProps) {
  const currentFormatted = formatTime(currentTime);
  const durationFormatted = formatTime(duration);
  const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.container}>
      {/* Current time */}
      <span className={styles.time} title={`Elapsed: ${currentFormatted}`}>
        {currentFormatted}
      </span>

      {/* Progress indicator */}
      <div className={styles.progressBar}>
        <progress
          className={`${styles.progressFill} ${isPlaying ? styles.animating : ''}`}
          value={Math.round(percentage)}
          max={100}
        />
      </div>

      {/* Total duration */}
      <span className={styles.time} title={`Total: ${durationFormatted}`}>
        {durationFormatted}
      </span>
    </div>
  );
}
