import { useEffect } from 'react';
import { PlaybackSpeed } from '../../hooks/usePlaybackPlayer';
import styles from './PlaybackControls.module.css';

/**
 * Props for PlaybackControls component
 */
interface PlaybackControlsProps {
  /** Whether playback is currently playing */
  isPlaying: boolean;
  /** Current playback speed */
  speed: PlaybackSpeed;
  /** Current frame number */
  currentFrame: number;
  /** Total number of frames */
  totalFrames: number;
  /** Callback when play is clicked */
  onPlay: () => void;
  /** Callback when pause is clicked */
  onPause: () => void;
  /** Callback when speed is changed */
  onSpeedChange: (speed: PlaybackSpeed) => void;
  /** Callback when next frame is clicked */
  onNextFrame: () => void;
  /** Callback when previous frame is clicked */
  onPreviousFrame: () => void;
  /** Whether playback is at the end */
  isAtEnd?: boolean;
}

/**
 * Playback control buttons with play/pause, speed control, and frame navigation
 *
 * Provides a control bar with:
 * - Play/pause toggle button
 * - Previous/next frame buttons
 * - Speed selector (0.5x, 1x, 1.5x, 2x)
 * - Frame counter display
 * - Keyboard shortcut support (spacebar for play/pause, arrow keys for navigation)
 *
 * @example
 * ```tsx
 * <PlaybackControls
 *   isPlaying={true}
 *   speed={1}
 *   currentFrame={45}
 *   totalFrames={300}
 *   onPlay={() => play()}
 *   onPause={() => pause()}
 *   onSpeedChange={(speed) => setSpeed(speed)}
 *   onNextFrame={() => nextFrame()}
 *   onPreviousFrame={() => previousFrame()}
 * />
 * ```
 */
export function PlaybackControls({
  isPlaying,
  speed,
  currentFrame,
  totalFrames,
  onPlay,
  onPause,
  onSpeedChange,
  onNextFrame,
  onPreviousFrame,
  isAtEnd = false,
}: PlaybackControlsProps) {
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input field
      const target = e.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const isFormElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.getAttribute?.('contenteditable') === 'true';

      if (isFormElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isPlaying) {
            onPause();
          } else {
            onPlay();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          onNextFrame();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onPreviousFrame();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, onPlay, onPause, onNextFrame, onPreviousFrame]);

  const handlePlayPauseClick = () => {
    if (isAtEnd) {
      onPlay();
    } else if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  const speedOptions: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

  return (
    <div className={styles.container}>
      {/* Left section: Play/Pause and Frame Navigation */}
      <div className={styles.leftSection}>
        {/* Previous Frame Button */}
        <button
          className={styles.button}
          onClick={onPreviousFrame}
          disabled={currentFrame === 0}
          title="Previous frame (← arrow key)"
          aria-label="Previous frame"
        >
          ⟨ Frame
        </button>

        {/* Play/Pause Button */}
        <button
          className={`${styles.button} ${styles.playButton}`}
          onClick={handlePlayPauseClick}
          title={isPlaying ? 'Pause (spacebar)' : 'Play (spacebar)'}
          aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
          aria-pressed={isPlaying}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Next Frame Button */}
        <button
          className={styles.button}
          onClick={onNextFrame}
          disabled={currentFrame >= totalFrames - 1}
          title="Next frame (→ arrow key)"
          aria-label="Next frame"
        >
          Frame ⟩
        </button>
      </div>

      {/* Center section: Frame Counter */}
      <div className={styles.centerSection}>
        <span className={styles.frameCounter}>
          Frame <span className={styles.frameNumber}>{currentFrame + 1}</span> / {totalFrames}
        </span>
      </div>

      {/* Right section: Speed Control */}
      <div className={styles.rightSection}>
        <label htmlFor="speed-select" className={styles.speedLabel}>
          Speed:
        </label>
        <select
          id="speed-select"
          className={styles.speedSelect}
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value) as PlaybackSpeed)}
          title="Playback speed multiplier"
          aria-label="Playback speed"
        >
          {speedOptions.map((option) => (
            <option key={option} value={option}>
              {option}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
