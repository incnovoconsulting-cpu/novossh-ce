# Playback Controls Integration Guide

This guide explains how to use the playback player components and hooks in your application.

## Component Structure

### Core Components

1. **PlaybackControls** - Primary control buttons
   - Play/Pause toggle
   - Previous/Next frame navigation
   - Speed selector (0.5x, 1x, 1.5x, 2x)
   - Frame counter display

2. **PlaybackProgress** - Visual progress indicator
   - Current time display
   - Total duration display
   - Animated progress bar
   - Responsive time formatting (MM:SS or HH:MM:SS)

3. **FrameScrubber** - Timeline navigation
   - Draggable scrubber thumb
   - Click-to-seek functionality
   - Hover preview tooltips
   - Keyboard navigation (arrows, Home, End keys)

4. **PlaybackContainer** - Integrated all-in-one component
   - Combines all three components above
   - Manages state via usePlaybackPlayer hook
   - Single point of integration

### State Management Hook

**usePlaybackPlayer** - Zustand-based state management
- Manages playback state (playing, paused, stopped)
- Tracks current frame and time
- Handles frame and time-based seeking
- Speed control
- Auto-advancement during playback
- Callbacks for frame changes and state updates

## Integration Examples

### Basic Integration with SessionPlaybackViewer

```tsx
import { PlaybackContainer } from '../Playback/PlaybackContainer';
import { usePlaybackPlayer } from '../../hooks/usePlaybackPlayer';

export function SessionPlaybackViewer({
  sessionId,
  sessionName,
  autoPlay = false,
}: SessionPlaybackViewerProps) {
  const [playbackData, setPlaybackData] = useState<SessionPlaybackData | null>(null);
  
  // Your existing playback data loading logic...
  
  const handleFrameChange = (frame: number) => {
    // Update displayed output based on current frame
    if (playbackData) {
      const currentFrames = playbackData.frames.filter((f) => f.timestamp <= frame);
      updateTerminalOutput(currentFrames);
    }
  };

  return (
    <div className="space-y-4">
      {/* Playback Controls */}
      {playbackData && (
        <PlaybackContainer
          totalFrames={playbackData.frames.length}
          frameRate={30}
          onFrameChange={handleFrameChange}
          showFramePreview={true}
          initialSpeed={1}
          autoPlay={autoPlay}
        />
      )}

      {/* Terminal Output Display */}
      <div className="terminal-output">
        {/* Your terminal output rendering */}
      </div>
    </div>
  );
}
```

### Advanced: Using Individual Components with Custom State

```tsx
import { PlaybackControls } from '../Playback/PlaybackControls';
import { PlaybackProgress } from '../Playback/PlaybackProgress';
import { FrameScrubber } from '../Playback/FrameScrubber';
import { usePlaybackPlayer } from '../../hooks/usePlaybackPlayer';

export function AdvancedPlaybackExample() {
  const playback = usePlaybackPlayer({
    onFrameChange: (frame) => {
      console.log('Frame changed to:', frame);
      // Perform custom frame rendering
    },
    onPlaybackStateChange: (isPlaying) => {
      console.log('Playback state:', isPlaying);
    }
  });

  useEffect(() => {
    // Initialize with 300 frames at 60fps
    playback.initialize(300, 60);
  }, []);

  return (
    <div className="space-y-3">
      {/* Use individual components with direct control */}
      <PlaybackControls
        isPlaying={playback.isPlaying}
        speed={playback.speed}
        currentFrame={playback.currentFrame}
        totalFrames={playback.totalFrames}
        onPlay={() => playback.play()}
        onPause={() => playback.pause()}
        onSpeedChange={(speed) => playback.setSpeed(speed)}
        onNextFrame={() => playback.nextFrame()}
        onPreviousFrame={() => playback.previousFrame()}
      />

      <PlaybackProgress
        currentTime={playback.currentTime}
        duration={playback.duration}
        isPlaying={playback.isPlaying}
      />

      <FrameScrubber
        currentFrame={playback.currentFrame}
        totalFrames={playback.totalFrames}
        onSeek={(frame) => playback.seekToFrame(frame)}
        showFramePreview={true}
      />
    </div>
  );
}
```

## Keyboard Shortcuts

All components automatically support these keyboard shortcuts:

| Key | Action |
|-----|--------|
| **Space** | Play/Pause |
| **→ (Right Arrow)** | Next frame / Seek forward |
| **← (Left Arrow)** | Previous frame / Seek backward |
| **Home** | Jump to start (when scrubber focused) |
| **End** | Jump to end (when scrubber focused) |

Shortcuts are automatically disabled when focus is on input fields.

## API Reference

### usePlaybackPlayer Hook

```typescript
interface PlaybackPlayerState {
  currentFrame: number;           // Current frame (0-based)
  totalFrames: number;            // Total frames in playback
  isPlaying: boolean;             // Whether playback is active
  speed: PlaybackSpeed;           // Current playback speed (0.5, 1, 1.5, 2)
  duration: number;               // Total duration in milliseconds
  currentTime: number;            // Current time in milliseconds
}

interface PlaybackPlayerMethods {
  play(): void;                              // Start playback
  pause(): void;                             // Pause playback
  togglePlayPause(): void;                   // Toggle play/pause
  seekToFrame(frame: number): void;          // Seek to specific frame
  seekToTime(time: number): void;            // Seek to specific time (ms)
  nextFrame(): void;                         // Jump to next frame
  previousFrame(): void;                     // Jump to previous frame
  setSpeed(speed: PlaybackSpeed): void;      // Set playback speed
  initialize(totalFrames: number, frameRate?: number): void;  // Initialize
  getState(): PlaybackPlayerState;           // Get current state
}
```

### PlaybackControls Props

```typescript
interface PlaybackControlsProps {
  isPlaying: boolean;
  speed: PlaybackSpeed;
  currentFrame: number;
  totalFrames: number;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onNextFrame: () => void;
  onPreviousFrame: () => void;
  isAtEnd?: boolean;
}
```

### PlaybackProgress Props

```typescript
interface PlaybackProgressProps {
  currentTime: number;           // Current time in milliseconds
  duration: number;              // Total duration in milliseconds
  isPlaying: boolean;            // Whether playback is active
}
```

### FrameScrubber Props

```typescript
interface FrameScrubberProps {
  currentFrame: number;
  totalFrames: number;
  onSeek: (frame: number) => void;
  isPlaying?: boolean;
  showFramePreview?: boolean;    // Show frame number tooltip on hover
}
```

### PlaybackContainer Props

```typescript
interface PlaybackContainerProps {
  totalFrames: number;
  frameRate?: number;                        // Default: 30
  onFrameChange?: (frame: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  showFramePreview?: boolean;                // Default: true
  initialSpeed?: 0.5 | 1 | 1.5 | 2;         // Default: 1
  autoPlay?: boolean;                        // Default: false
  className?: string;                        // Custom CSS class
}
```

## Styling

All components use CSS modules with theme-aware variables:

```css
--playback-bg: Background color
--playback-border: Border color
--playback-text: Text color
--playback-button-bg: Button background
--playback-button-hover: Button hover color
--playback-button-active: Active button color
--playback-button-disabled: Disabled button color
--progress-fill: Progress bar color
--scrubber-thumb: Scrubber thumb color
```

Customize these in your global CSS:

```css
:root {
  --playback-bg: #0f172a;
  --playback-border: rgba(255, 255, 255, 0.1);
  --playback-text: #f1f5f9;
  --progress-fill: #3b82f6;
  --scrubber-thumb: #3b82f6;
}
```

## Performance Considerations

1. **Frame Rate**: Higher frame rates require more frequent updates
   - Use `initialize(frames, frameRate)` to optimize for your content
   - 30fps is standard for terminal recordings

2. **Large Recordings**: For recordings with thousands of frames
   - Consider frame sampling or chunking in SessionPlaybackViewer
   - Use time-based seeking for large jumps
   - Implement lazy loading of frame data

3. **Animation Performance**:
   - Progress bar uses CSS transitions (optimized)
   - Scrubber uses transform for smooth dragging
   - Disable preview tooltips if performance is needed

## Testing

Comprehensive test suites are included:

- `PlaybackControls.test.tsx` - 150+ test cases
- `PlaybackProgress.test.tsx` - 100+ test cases
- `FrameScrubber.test.tsx` - 140+ test cases
- `usePlaybackPlayer.test.ts` - 120+ test cases

Run tests with:
```bash
npm test -- src/components/Playback
npm test -- src/hooks/usePlaybackPlayer
```

## Accessibility

All components include:

- Semantic HTML with proper ARIA roles
- Keyboard navigation support
- Focus management
- Screen reader support
- High contrast support
- Focus-visible indicators

Example ARIA implementation:
```tsx
<div 
  role="slider" 
  aria-label="Frame scrubber"
  aria-valuenow={currentFrame}
  aria-valuemin={0}
  aria-valuemax={totalFrames - 1}
/>
```

## Common Issues

### Q: Playback doesn't advance frames
**A:** Ensure `isPlaying` is true and `initialize()` has been called with valid `totalFrames`.

### Q: Keyboard shortcuts not working
**A:** Check that the component has proper focus and isn't inside a contenteditable element.

### Q: Speed changes don't take effect during playback
**A:** Speed changes are applied immediately at the next frame update (within ~33ms at 30fps).

### Q: Scrubber doesn't respond to clicks
**A:** Ensure the container has proper dimensions and isn't overflow-hidden.

## License

Part of NovoSSH - See main repository license.
