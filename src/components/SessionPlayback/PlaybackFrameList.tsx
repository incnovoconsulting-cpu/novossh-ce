import { useEffect, useRef, useState } from 'react';
import { PlaybackFrame } from '../../lib/types';
import { FrameRenderer } from './FrameRenderer';
import styles from './PlaybackFrameList.module.css';

/**
 * Props for PlaybackFrameList component
 */
interface PlaybackFrameListProps {
  /** Array of frames to display */
  frames: PlaybackFrame[];
  /** Map of user IDs to user names */
  userNames?: Record<string, string>;
  /** Currently highlighted frame index */
  currentFrameIndex?: number;
  /** Callback when user clicks on a frame */
  onFrameClick?: (frameIndex: number, timestamp: number) => void;
  /** Whether list is scrollable or fixed height */
  scrollable?: boolean;
}

/**
 * Shows chronological list of all frames with timestamps
 *
 * Displays frames in order with syntax highlighting and user information.
 * Supports highlighting, scrolling to current frame, and click handlers.
 * Responsive with smooth scrolling behavior.
 *
 * @example
 * ```tsx
 * <PlaybackFrameList
 *   frames={sessionData.frames}
 *   userNames={{ 'user-123': 'alice' }}
 *   currentFrameIndex={5}
 *   onFrameClick={(idx, ts) => seekTo(ts)}
 *   scrollable={true}
 * />
 * ```
 */
export function PlaybackFrameList({
  frames,
  userNames = {},
  currentFrameIndex,
  onFrameClick,
  scrollable = true,
}: PlaybackFrameListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const frameRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  // Auto-scroll to current frame
  useEffect(() => {
    if (currentFrameIndex !== undefined && frameRefs.current[currentFrameIndex]) {
      const frameElement = frameRefs.current[currentFrameIndex];
      if (frameElement && listRef.current) {
        frameElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [currentFrameIndex]);

  // Virtual scrolling for performance with large frame lists
  const handleScroll = (e: React.UIEvent<HTMLUListElement>) => {
    if (!scrollable) return;

    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const itemHeight = 120; // Approximate height per frame

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
    const endIndex = Math.min(
      frames.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + 5
    );

    setVisibleRange({ start: startIndex, end: endIndex });
  };

  // For smaller lists, show all frames
  const renderRange = frames.length < 100 ? { start: 0, end: frames.length } : visibleRange;

  return (
    <ul
      ref={listRef}
      className={`${styles.frameList} ${scrollable ? styles.scrollable : styles.fixed}`}
      onScroll={handleScroll}
      aria-label="Session frames"
    >
      <div className={styles.frameContainer}>
        {/* Spacer for before visible range */}
        {renderRange.start > 0 && (
          <div
            style={{ height: renderRange.start * 120 }}
            className={styles.spacer}
          />
        )}

        {/* Render visible frames */}
        {frames.slice(renderRange.start, renderRange.end).map((frame, relativeIndex) => {
          const frameIndex = renderRange.start + relativeIndex;
          const isHighlighted = frameIndex === currentFrameIndex;

          return (
            <li
              key={frameIndex}
              ref={(el: HTMLLIElement | null) => {
                frameRefs.current[frameIndex] = el;
              }}
              className={`${styles.frameListItem} ${isHighlighted ? styles.activeDot : ''}`}
              onClick={() => onFrameClick?.(frameIndex, frame.timestamp)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onFrameClick?.(frameIndex, frame.timestamp);
                }
              }}
            >
              {/* Timeline dot */}
              <div className={`${styles.timelineDot} ${styles[frame.type]}`} />

              {/* Frame content */}
              <div className={styles.frameItemContent}>
                <FrameRenderer
                  frame={frame}
                  userName={frame.userId ? userNames[frame.userId] : undefined}
                  isHighlighted={isHighlighted}
                />
              </div>
            </li>
          );
        })}

        {/* Spacer for after visible range */}
        {renderRange.end < frames.length && (
          <div
            style={{ height: (frames.length - renderRange.end) * 120 }}
            className={styles.spacer}
          />
        )}
      </div>

      {/* Empty state */}
      {frames.length === 0 && (
        <div className={styles.emptyState}>
          <p>No frames to display</p>
        </div>
      )}
    </ul>
  );
}
