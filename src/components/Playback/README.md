# Session Playback Player Controls

Professional-grade interactive playback controls for session recording viewer. Provides a complete, accessible, and performant playback system with keyboard shortcuts, variable speed, and frame-by-frame navigation.

## Features

- **Play/Pause Controls** - Toggle playback with visual feedback
- **Speed Control** - Variable playback speeds (0.5x, 1x, 1.5x, 2x)
- **Frame Navigation** - Previous/next frame buttons with keyboard support
- **Timeline Scrubber** - Interactive scrubber for seeking through frames
- **Progress Display** - Real-time elapsed/total time with animated progress bar
- **Keyboard Shortcuts** - Spacebar (play/pause), arrow keys (navigation)
- **Frame Preview** - Hover tooltips showing frame numbers on scrubber
- **Auto-advance** - Smooth frame advancement during playback
- **Accessibility** - Full ARIA support, keyboard navigation, screen reader compatible
- **Responsive Design** - Mobile-friendly with adaptive layouts

## Components

### PlaybackControls
Primary control buttons with play/pause toggle, speed selector, and frame navigation.

```tsx
import { PlaybackControls } from './PlaybackControls';

<PlaybackControls
  isPlaying={true}
  speed={1}
  currentFrame={45}
  totalFrames={300}
  onPlay={() => play()}
  onPause={() => pause()}
  onSpeedChange={(speed) => setSpeed(speed)}
  onNextFrame={() => nextFrame()}
  onPreviousFrame={() => previousFrame()}
/>
```

### PlaybackProgress
Visual progress bar with current/total time display and shimmer animation during playback.

```tsx
import { PlaybackProgress } from './PlaybackProgress';

<PlaybackProgress
  currentTime={45000}
  duration={300000}
  isPlaying={true}
/>
```

### FrameScrubber
Interactive timeline for seeking to specific frames with drag-to-seek and click-to-seek functionality.

```tsx
import { FrameScrubber } from './FrameScrubber';

<FrameScrubber
  currentFrame={45}
  totalFrames={300}
  onSeek={(frame) => seekToFrame(frame)}
  showFramePreview={true}
/>
```

### PlaybackContainer
All-in-one integrated component combining controls, progress, and scrubber.

```tsx
import { PlaybackContainer } from './PlaybackContainer';

<PlaybackContainer
  totalFrames={300}
  frameRate={30}
  onFrameChange={(frame) => updateDisplay(frame)}
  showFramePreview={true}
  autoPlay={false}
/>
```

## Hook API

### usePlaybackPlayer
State management hook for playback control. Built with Zustand for performance and simplicity.

```tsx
import { usePlaybackPlayer } from '../../hooks/usePlaybackPlayer';

const {
  currentFrame,
  totalFrames,
  isPlaying,
  speed,
  duration,
  currentTime,
  play,
  pause,
  togglePlayPause,
  seekToFrame,
  seekToTime,
  nextFrame,
  previousFrame,
  setSpeed,
  initialize,
  getState
} = usePlaybackPlayer({
  onFrameChange: (frame) => console.log('Frame:', frame),
  onPlaybackStateChange: (isPlaying) => console.log('Playing:', isPlaying)
});

// Initialize with frame count and frame rate
useEffect(() => {
  playback.initialize(300, 30); // 300 frames at 30fps = 10 seconds
}, []);
```

## Integration Example

```tsx
import { PlaybackContainer } from '../Playback/PlaybackContainer';

export function SessionPlaybackViewer({
  sessionId,
  sessionName,
  autoPlay = false,
}: SessionPlaybackViewerProps) {
  const [playbackData, setPlaybackData] = useState<SessionPlaybackData | null>(null);
  
  const handleFrameChange = (frame: number) => {
    if (playbackData) {
      const currentFrames = playbackData.frames.filter((f) => f.timestamp <= frame);
      updateTerminalOutput(currentFrames);
    }
  };

  return (
    <div className="space-y-4">
      {playbackData && (
        <PlaybackContainer
          totalFrames={playbackData.frames.length}
          frameRate={30}
          onFrameChange={handleFrameChange}
          showFramePreview={true}
          autoPlay={autoPlay}
        />
      )}
      
      {/* Terminal output display */}
      <div className="terminal-output">
        {/* Render current frames */}
      </div>
    </div>
  );
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Space** | Play/Pause toggle |
| **→ (Right Arrow)** | Next frame or seek forward |
| **← (Left Arrow)** | Previous frame or seek backward |
| **Home** | Jump to start (when scrubber focused) |
| **End** | Jump to end (when scrubber focused) |

Shortcuts automatically disabled when focus is in input fields.

## Styling

All components use CSS Modules with customizable theme variables:

```css
:root {
  /* Playback Controls */
  --playback-bg: #0f172a;
  --playback-border: rgba(255, 255, 255, 0.1);
  --playback-text: #f1f5f9;
  --playback-button-bg: rgba(255, 255, 255, 0.1);
  --playback-button-hover: rgba(255, 255, 255, 0.15);
  --playback-button-active: #3b82f6;
  --playback-button-disabled: rgba(255, 255, 255, 0.05);

  /* Progress Display */
  --progress-text: #f1f5f9;
  --progress-bg: rgba(255, 255, 255, 0.08);
  --progress-fill: #3b82f6;
  --progress-border: rgba(255, 255, 255, 0.1);

  /* Frame Scrubber */
  --scrubber-bg: rgba(255, 255, 255, 0.08);
  --scrubber-progress: #3b82f6;
  --scrubber-thumb: #3b82f6;
  --scrubber-hover: #60a5fa;
  --scrubber-text: #f1f5f9;
  --scrubber-border: rgba(255, 255, 255, 0.1);
}
```

## Accessibility

All components include:

- **Semantic HTML** with proper ARIA roles and attributes
- **Keyboard navigation** with focus management
- **Screen reader support** with descriptive labels
- **High contrast** support for vision accessibility
- **Focus indicators** for keyboard navigation
- **Proper heading hierarchy** and semantic structure

Example ARIA implementation:

```tsx
<div 
  role="slider"
  aria-label="Frame scrubber"
  aria-valuenow={currentFrame}
  aria-valuemin={0}
  aria-valuemax={totalFrames - 1}
  tabIndex={0}
/>
```

## Performance Considerations

1. **Frame Rate**: Optimize for your content's frame rate
   - Terminal recordings: 30fps (standard)
   - High-speed recordings: 60fps or higher
   - Set via `frameRate` prop or `initialize(frames, frameRate)`

2. **Large Recordings**: For recordings with thousands of frames
   - Consider frame sampling or chunking
   - Use time-based seeking for large jumps
   - Implement lazy loading of frame data

3. **Animation Performance**:
   - Progress bar uses CSS transitions (GPU accelerated)
   - Scrubber uses CSS transforms (optimized)
   - Disable preview tooltips if needed

## Testing

Comprehensive test suites included:

```bash
# Run all playback component tests
npm test -- src/components/Playback

# Run specific component tests
npm test -- src/components/Playback/__tests__/PlaybackControls.test.tsx
npm test -- src/components/Playback/__tests__/PlaybackProgress.test.tsx
npm test -- src/components/Playback/__tests__/FrameScrubber.test.tsx
npm test -- src/components/Playback/__tests__/PlaybackContainer.test.tsx

# Run hook tests
npm test -- src/hooks/__tests__/usePlaybackPlayer.test.ts
```

**Test Coverage**:
- PlaybackControls: 20 tests
- PlaybackProgress: 20 tests
- FrameScrubber: 40 tests
- PlaybackContainer: 25 tests
- usePlaybackPlayer hook: 40+ tests
- **Total: 145+ tests**

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)

## API Reference

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for detailed API documentation.

## Examples

### Basic Playback Viewer

```tsx
import { PlaybackContainer } from './Playback/PlaybackContainer';

export function SimplePlayer() {
  return (
    <PlaybackContainer
      totalFrames={300}
      frameRate={30}
      autoPlay={false}
    />
  );
}
```

### Advanced with Custom Callbacks

```tsx
import { usePlaybackPlayer } from './hooks/usePlaybackPlayer';
import { PlaybackControls } from './Playback/PlaybackControls';
import { PlaybackProgress } from './Playback/PlaybackProgress';
import { FrameScrubber } from './Playback/FrameScrubber';

export function AdvancedPlayer() {
  const playback = usePlaybackPlayer({
    onFrameChange: (frame) => renderFrame(frame),
    onPlaybackStateChange: (isPlaying) => updateUI(isPlaying)
  });

  useEffect(() => {
    playback.initialize(300, 30);
  }, []);

  return (
    <div>
      <PlaybackControls
        {...playback}
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
      />
    </div>
  );
}
```

## Troubleshooting

**Q: Playback doesn't advance frames**
A: Ensure `isPlaying` is true and `initialize()` has been called with valid `totalFrames`.

**Q: Keyboard shortcuts not working**
A: Check that the component has proper focus and isn't inside a contenteditable element.

**Q: Speed changes don't apply**
A: Speed changes are applied immediately at the next frame update (~33ms at 30fps).

**Q: Scrubber doesn't respond to clicks**
A: Verify the container has proper dimensions and isn't `overflow: hidden`.

## License

Part of NovoSSH - See main repository license.
