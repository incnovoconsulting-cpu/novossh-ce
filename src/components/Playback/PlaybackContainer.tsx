import { useEffect } from 'react';
import { PlaybackControls } from './PlaybackControls';
import { PlaybackProgress } from './PlaybackProgress';
import { FrameScrubber } from './FrameScrubber';
import { usePlaybackPlayer } from '../../hooks/usePlaybackPlayer';
import styles from './PlaybackContainer.module.css';

/**
 * Props for PlaybackContainer component
 */
interface PlaybackContainerProps {
  /** Total number of frames to play */
  totalFrames: number;
  /** Frame rate in fps (default: 30) */
  frameRate?: number;
  /** Callback when current frame changes */
  onFrameChange?: (frame: number) => void;
  /** Callback when playback state changes */
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  /** Whether to show frame preview on scrubber hover */
  showFramePreview?: boolean;
  /** Initial playback speed */
  initialSpeed?: 0.5 | 1 | 1.5 | 2;
  /** Whether to auto-play on mount */
  autoPlay?: boolean;
  /** Custom CSS class name */
  className?: string;
}

/**
 * Complete playback control container
 *
 * Integrates all playback components (controls, progress, scrubber) into a
 * single reusable component with proper state management via usePlaybackPlayer hook.
 *
 * Features:
 * - Full playback controls (play/pause, speed, frame navigation)
 * - Visual progress bar with time display
 * - Interactive timeline scrubber
 * - Keyboard shortcuts (spacebar, arrow keys)
 * - Frame-by-frame stepping
 * - Variable speed playback
 *
 * @example
 * ```tsx
 * const PlayerExample = () => {
 *   const [currentFrame, setCurrentFrame] = useState(0);
 *
 *   return (
 *     <PlaybackContainer
 *       totalFrames={300}
 *       frameRate={30}
 *       onFrameChange={setCurrentFrame}
 *       showFramePreview={true}
 *     />
 *   );
 * };
 * ```
 */
export function PlaybackContainer({
  totalFrames,
  frameRate = 30,
  onFrameChange,
  onPlaybackStateChange,
  showFramePreview = true,
  initialSpeed = 1,
  autoPlay = false,
  className,
}: PlaybackContainerProps) {
  const playback = usePlaybackPlayer({
    onFrameChange,
    onPlaybackStateChange,
  });

  // Initialize playback with frame count and frame rate
  useEffect(() => {
    playback.initialize(totalFrames, frameRate);
    playback.setSpeed(initialSpeed);

    if (autoPlay) {
      playback.play();
    }
  }, [totalFrames, frameRate, initialSpeed, autoPlay, playback]);

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {/* Control Bar */}
      <PlaybackControls
        isPlaying={playback.isPlaying}
        speed={playback.speed}
        currentFrame={playback.currentFrame}
        totalFrames={playback.totalFrames}
        onPlay={playback.play}
        onPause={playback.pause}
        onSpeedChange={playback.setSpeed}
        onNextFrame={playback.nextFrame}
        onPreviousFrame={playback.previousFrame}
        isAtEnd={playback.currentFrame >= playback.totalFrames - 1}
      />

      {/* Progress Bar with Time Display */}
      <PlaybackProgress
        currentTime={playback.currentTime}
        duration={playback.duration}
        isPlaying={playback.isPlaying}
      />

      {/* Frame Scrubber / Timeline */}
      <FrameScrubber
        currentFrame={playback.currentFrame}
        totalFrames={playback.totalFrames}
        onSeek={playback.seekToFrame}
        isPlaying={playback.isPlaying}
        showFramePreview={showFramePreview}
      />
    </div>
  );
}

export default PlaybackContainer;
