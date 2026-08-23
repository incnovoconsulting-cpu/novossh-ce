import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlaybackPlayer, PlaybackSpeed } from '../usePlaybackPlayer';

describe('usePlaybackPlayer Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      expect(result.current.currentFrame).toBe(0);
      expect(result.current.totalFrames).toBe(0);
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.speed).toBe(1);
      expect(result.current.duration).toBe(0);
      expect(result.current.currentTime).toBe(0);
    });

    it('should initialize with total frames and frame rate', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
      });

      expect(result.current.totalFrames).toBe(300);
      expect(result.current.duration).toBe(10000); // 300 / 30 * 1000 = 10000ms
      expect(result.current.currentFrame).toBe(0);
      expect(result.current.currentTime).toBe(0);
      expect(result.current.isPlaying).toBe(false);
    });

    it('should use default frame rate of 30 fps', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300);
      });

      expect(result.current.duration).toBe(10000);
    });

    it('should reset state on re-initialization', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
        result.current.seekToFrame(150);
        result.current.play();
      });

      expect(result.current.currentFrame).toBe(150);
      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.initialize(300, 30);
      });

      expect(result.current.currentFrame).toBe(0);
      expect(result.current.currentTime).toBe(0);
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('Play/Pause', () => {
    it('should play from paused state', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
      });

      expect(result.current.isPlaying).toBe(false);

      act(() => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);
    });

    it('should pause from playing state', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.pause();
      });

      expect(result.current.isPlaying).toBe(false);
    });

    it('should toggle play/pause', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
      });

      act(() => {
        result.current.togglePlayPause();
      });

      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.togglePlayPause();
      });

      expect(result.current.isPlaying).toBe(false);
    });

    it('should call onPlaybackStateChange callback', () => {
      const onPlaybackStateChange = vi.fn();
      const { result } = renderHook(() => usePlaybackPlayer({ onPlaybackStateChange }));

      act(() => {
        result.current.initialize(300, 30);
      });

      act(() => {
        result.current.play();
      });

      expect(onPlaybackStateChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Frame Navigation', () => {
    it('should seek to specific frame', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
      });

      act(() => {
        result.current.seekToFrame(150);
      });

      expect(result.current.currentFrame).toBe(150);
      expect(result.current.currentTime).toBe(5000); // 150 / 300 * 10000
    });

    it('should clamp frame to valid range', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
      });

      act(() => {
        result.current.seekToFrame(-50);
      });

      expect(result.current.currentFrame).toBe(0);

      act(() => {
        result.current.seekToFrame(500);
      });

      expect(result.current.currentFrame).toBe(299);
    });

    it('should move to next frame', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
        result.current.seekToFrame(50);
        result.current.play();
      });

      act(() => {
        result.current.nextFrame();
      });

      expect(result.current.currentFrame).toBe(51);
      expect(result.current.isPlaying).toBe(false); // Stops playback on manual step
    });

    it('should move to previous frame', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
        result.current.seekToFrame(50);
        result.current.play();
      });

      act(() => {
        result.current.previousFrame();
      });

      expect(result.current.currentFrame).toBe(49);
      expect(result.current.isPlaying).toBe(false); // Stops playback on manual step
    });

    it('should clamp next frame at end', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
        result.current.seekToFrame(299);
      });

      act(() => {
        result.current.nextFrame();
      });

      expect(result.current.currentFrame).toBe(299);
    });

    it('should clamp previous frame at start', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
        result.current.seekToFrame(0);
      });

      act(() => {
        result.current.previousFrame();
      });

      expect(result.current.currentFrame).toBe(0);
    });

    it('should call onFrameChange callback', () => {
      const onFrameChange = vi.fn();
      const { result } = renderHook(() => usePlaybackPlayer({ onFrameChange }));

      act(() => {
        result.current.initialize(300, 30);
      });

      act(() => {
        result.current.seekToFrame(100);
      });

      expect(onFrameChange).toHaveBeenCalledWith(100);
    });
  });

  describe('Time-based Seeking', () => {
    it('should seek to specific time', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
      });

      act(() => {
        result.current.seekToTime(5000); // 5 seconds
      });

      expect(result.current.currentTime).toBe(5000);
      expect(result.current.currentFrame).toBe(150);
    });

    it('should clamp time to valid range', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
      });

      act(() => {
        result.current.seekToTime(-1000);
      });

      expect(result.current.currentTime).toBe(0);

      act(() => {
        result.current.seekToTime(20000);
      });

      expect(result.current.currentTime).toBe(10000);
    });
  });

  describe('Speed Control', () => {
    it('should set playback speed', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
      });

      const speeds: PlaybackSpeed[] = [0.5, 1, 1.5, 2];

      speeds.forEach((speed) => {
        act(() => {
          result.current.setSpeed(speed);
        });

        expect(result.current.speed).toBe(speed);
      });
    });

    it('should persist speed during playback', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
        result.current.play();
      });

      act(() => {
        result.current.setSpeed(2);
      });

      expect(result.current.isPlaying).toBe(true);
      expect(result.current.speed).toBe(2);
    });
  });

  describe('Auto-advance During Playback', () => {
    it('should advance frames when playing', async () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
        result.current.play();
      });

      await waitFor(
        () => {
          expect(result.current.currentFrame).toBeGreaterThan(0);
        },
        { timeout: 1000 }
      );
    });

    it('should stop playback at end', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(10, 30);
        result.current.play();
      });

      act(() => {
        vi.advanceTimersByTime(5000); // Advance past the end
      });

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentFrame).toBe(9);

      vi.useRealTimers();
    });

    it('should respect speed multiplier during playback', async () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
        result.current.setSpeed(2);
        result.current.play();
      });

      const frameAt100ms = result.current.currentFrame;

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const frameAt200ms = result.current.currentFrame;

      // With 2x speed, should advance approximately 4 frames per 100ms
      // (30fps / 30 * 2 * 0.1 = 2 frames per 100ms at native, so ~4 at 2x)
      expect(frameAt200ms).toBeGreaterThan(frameAt100ms);

      vi.useRealTimers();
    });

    it('should not advance frames when paused', async () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
      });

      const initialFrame = result.current.currentFrame;

      await waitFor(
        () => {
          expect(result.current.currentFrame).toBe(initialFrame);
        },
        { timeout: 500 }
      );
    });
  });

  describe('State Persistence', () => {
    it('should return consistent state via getState', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 30);
        result.current.seekToFrame(150);
        result.current.play();
        result.current.setSpeed(1.5);
      });

      const state = result.current.getState();

      expect(state.currentFrame).toBe(150);
      expect(state.totalFrames).toBe(300);
      expect(state.isPlaying).toBe(true);
      expect(state.speed).toBe(1.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero total frames', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(0, 30);
      });

      expect(result.current.totalFrames).toBe(0);
      expect(result.current.duration).toBe(0);
    });

    it('should handle very high frame rates', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 120);
      });

      expect(result.current.duration).toBe(2500); // 300 / 120 * 1000
    });

    it('should handle very low frame rates', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.initialize(300, 1);
      });

      expect(result.current.duration).toBe(300000); // 300 / 1 * 1000
    });

    it('should handle seeking beyond frame count before initialization', () => {
      const { result } = renderHook(() => usePlaybackPlayer());

      act(() => {
        result.current.seekToFrame(100);
      });

      expect(result.current.currentFrame).toBe(0);
    });
  });

  describe('Callbacks Integration', () => {
    it('should fire callbacks on state changes', () => {
      const onFrameChange = vi.fn();
      const onPlaybackStateChange = vi.fn();

      const { result } = renderHook(() =>
        usePlaybackPlayer({ onFrameChange, onPlaybackStateChange })
      );

      act(() => {
        result.current.initialize(300, 30);
      });

      act(() => {
        result.current.seekToFrame(100);
      });

      expect(onFrameChange).toHaveBeenCalledWith(100);

      act(() => {
        result.current.play();
      });

      expect(onPlaybackStateChange).toHaveBeenCalledWith(true);
    });
  });
});
