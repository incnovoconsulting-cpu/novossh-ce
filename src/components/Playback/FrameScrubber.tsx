import { useRef, useState, useCallback, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import styles from './FrameScrubber.module.css';

/**
 * Props for FrameScrubber component
 */
interface FrameScrubberProps {
  /** Current frame number */
  currentFrame: number;
  /** Total number of frames */
  totalFrames: number;
  /** Callback when user seeks to a new frame */
  onSeek: (frame: number) => void;
  /** Whether playback is currently playing */
  isPlaying?: boolean;
  /** Show frame numbers above scrubber (preview) */
  showFramePreview?: boolean;
}

/**
 * Timeline scrubber for seeking through recorded session frames
 *
 * Provides an interactive scrubber for seeking to specific frames in a recording.
 * Includes:
 * - Draggable thumb for frame seeking
 * - Click to seek
 * - Frame preview tooltip
 * - Keyboard navigation (arrow keys when focused)
 * - Accessible ARIA attributes
 *
 * @example
 * ```tsx
 * <FrameScrubber
 *   currentFrame={45}
 *   totalFrames={300}
 *   onSeek={(frame) => seekToFrame(frame)}
 *   isPlaying={true}
 *   showFramePreview={true}
 * />
 * ```
 */
export function FrameScrubber({
  currentFrame,
  totalFrames,
  onSeek,
  isPlaying: _isPlaying = false,
  showFramePreview = true,
}: FrameScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverFrame, setHoverFrame] = useState<number | null>(null);

  // Calculate percentage
  const percentage = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;
  const hoverPercentage = hoverFrame !== null ? (hoverFrame / totalFrames) * 100 : 0;

  // Handle click on track to seek
  const handleTrackClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = (clickX / rect.width) * 100;
      const frame = Math.round((percentage / 100) * totalFrames);

      onSeek(Math.max(0, Math.min(frame, totalFrames - 1)));
    },
    [totalFrames, onSeek]
  );

  // Handle hover to show frame preview
  const handleTrackHover = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const hoverX = e.clientX - rect.left;
      const percentage = (hoverX / rect.width) * 100;
      const frame = Math.round((percentage / 100) * totalFrames);

      setHoverFrame(Math.max(0, Math.min(frame, totalFrames - 1)));
    },
    [totalFrames]
  );

  const handleTrackLeave = () => {
    setHoverFrame(null);
  };

  // Handle drag
  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const moveX = e.clientX - rect.left;
      const percentage = (moveX / rect.width) * 100;
      const frame = Math.round((percentage / 100) * totalFrames);

      onSeek(Math.max(0, Math.min(frame, totalFrames - 1)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, totalFrames, onSeek]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!thumbRef.current || !thumbRef.current.matches(':focus')) return;

      let newFrame = currentFrame;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          newFrame = Math.min(currentFrame + 1, totalFrames - 1);
          onSeek(newFrame);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newFrame = Math.max(currentFrame - 1, 0);
          onSeek(newFrame);
          break;
        case 'Home':
          e.preventDefault();
          onSeek(0);
          break;
        case 'End':
          e.preventDefault();
          onSeek(totalFrames - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFrame, totalFrames, onSeek]);

  return (
    <div className={styles.container}>
      {/* Scrubber track */}
      <div
        ref={containerRef}
        className={`${styles.track} ${isDragging ? styles.dragging : ''}`}
        onClick={handleTrackClick}
        onMouseMove={handleTrackHover}
        onMouseLeave={handleTrackLeave}
        role="slider"
        tabIndex={0}
        aria-label="Frame scrubber"
        aria-valuenow={currentFrame}
        aria-valuemin={0}
        aria-valuemax={totalFrames - 1}
      >
        {/* Progress fill */}
        <div
          className={styles.progress}
          style={{ width: `${percentage}%` }}
        />

        {/* Hover preview line */}
        {hoverFrame !== null && !isDragging && (
          <div
            className={styles.hoverIndicator}
            style={{ left: `${hoverPercentage}%` }}
          />
        )}

        {/* Scrubber thumb */}
        <div
          ref={thumbRef}
          className={`${styles.thumb} ${isDragging ? styles.active : ''}`}
          style={{ left: `${percentage}%` }}
          onMouseDown={handleMouseDown}
          tabIndex={0}
          title={`Frame ${currentFrame + 1} of ${totalFrames}`}
        />
      </div>

      {/* Frame preview tooltip */}
      {showFramePreview && hoverFrame !== null && !isDragging && (
        <div className={styles.previewTooltip} style={{ left: `${hoverPercentage}%` }}>
          <span className={styles.previewFrame}>{hoverFrame + 1}</span>
        </div>
      )}

      {/* Current frame label */}
      <div className={styles.frameLabel}>
        <span className={styles.frameLabelText}>
          Frame <span className={styles.frameLabelNumber}>{currentFrame + 1}</span>
        </span>
      </div>
    </div>
  );
}
