import { useEffect, useRef } from 'react';
import { create } from 'zustand';

/**
 * Playback speed options
 */
export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

/**
 * Playback state interface
 */
export interface PlaybackPlayerState {
  /** Current playback position in frames */
  currentFrame: number;
  /** Total number of frames available */
  totalFrames: number;
  /** Whether playback is currently playing */
  isPlaying: boolean;
  /** Current playback speed multiplier */
  speed: PlaybackSpeed;
  /** Duration in milliseconds (calculated from total frames and frame rate) */
  duration: number;
  /** Current time in milliseconds */
  currentTime: number;
}

/**
 * Playback methods interface
 */
export interface PlaybackPlayerMethods {
  /** Play from current position */
  play(): void;
  /** Pause playback */
  pause(): void;
  /** Toggle play/pause */
  togglePlayPause(): void;
  /** Seek to a specific frame */
  seekToFrame(frame: number): void;
  /** Seek to a specific time in milliseconds */
  seekToTime(time: number): void;
  /** Go to next frame */
  nextFrame(): void;
  /** Go to previous frame */
  previousFrame(): void;
  /** Set playback speed */
  setSpeed(speed: PlaybackSpeed): void;
  /** Initialize with total frames count and frame rate (default 30 fps) */
  initialize(totalFrames: number, frameRate?: number): void;
  /** Get current state */
  getState(): PlaybackPlayerState;
}

/**
 * Combined state and methods
 */
export type UsePlaybackPlayerResult = PlaybackPlayerState & PlaybackPlayerMethods;

/**
 * Internal Zustand store for playback state
 */
const usePlaybackStore = create<PlaybackPlayerState & PlaybackPlayerMethods>((set, get) => ({
  currentFrame: 0,
  totalFrames: 0,
  isPlaying: false,
  speed: 1,
  duration: 0,
  currentTime: 0,

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),

  seekToFrame: (frame: number) => {
    set((state) => {
      const clamped = Math.max(0, Math.min(frame, state.totalFrames - 1));
      return {
        currentFrame: clamped,
        currentTime: (clamped / Math.max(1, state.totalFrames)) * state.duration,
      };
    });
  },

  seekToTime: (time: number) => {
    set((state) => {
      const clamped = Math.max(0, Math.min(time, state.duration));
      const frame = Math.round((clamped / Math.max(1, state.duration)) * state.totalFrames);
      return {
        currentTime: clamped,
        currentFrame: Math.max(0, Math.min(frame, state.totalFrames - 1)),
      };
    });
  },

  nextFrame: () => {
    set((state) => {
      const nextFrame = Math.min(state.currentFrame + 1, state.totalFrames - 1);
      return {
        currentFrame: nextFrame,
        currentTime: (nextFrame / Math.max(1, state.totalFrames)) * state.duration,
        isPlaying: false, // Stop playback when manually stepping
      };
    });
  },

  previousFrame: () => {
    set((state) => {
      const prevFrame = Math.max(state.currentFrame - 1, 0);
      return {
        currentFrame: prevFrame,
        currentTime: (prevFrame / Math.max(1, state.totalFrames)) * state.duration,
        isPlaying: false, // Stop playback when manually stepping
      };
    });
  },

  setSpeed: (speed: PlaybackSpeed) => {
    set({ speed });
  },

  initialize: (totalFrames: number, frameRate: number = 30) => {
    const duration = (totalFrames / frameRate) * 1000; // Convert to milliseconds
    set({
      totalFrames,
      duration,
      currentFrame: 0,
      currentTime: 0,
      isPlaying: false,
      speed: 1,
    });
  },

  getState: () => get(),
}));

/**
 * Custom hook for managing session playback
 *
 * Provides state management and methods for video-like playback control of recorded sessions.
 * Supports frame-based and time-based seeking, variable speed playback, and keyboard navigation.
 *
 * @param options - Configuration options
 * @param options.onFrameChange - Callback when frame changes
 * @param options.onPlaybackStateChange - Callback when play/pause state changes
 * @returns Playback state and control methods
 *
 * @example
 * ```tsx
 * const {
 *   currentFrame,
 *   totalFrames,
 *   isPlaying,
 *   speed,
 *   play,
 *   pause,
 *   seekToFrame,
 *   setSpeed
 * } = usePlaybackPlayer({
 *   onFrameChange: (frame) => console.log('Frame:', frame),
 *   onPlaybackStateChange: (isPlaying) => console.log('Playing:', isPlaying)
 * });
 *
 * // Initialize with 300 frames at 30 fps (10 second recording)
 * useEffect(() => {
 *   usePlaybackPlayer.initialize(300, 30);
 * }, []);
 * ```
 */
export function usePlaybackPlayer(options?: {
  onFrameChange?: (frame: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
}): UsePlaybackPlayerResult {
  const store = usePlaybackStore();
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Auto-advance frames when playing
  useEffect(() => {
    if (!store.isPlaying) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimeRef.current;
      const state = store.getState();

      // Calculate next frame based on speed
      const frameAdvance = (elapsed / 1000) * 30 * state.speed; // Assuming 30 fps base
      const nextFrame = state.currentFrame + frameAdvance;

      if (nextFrame >= state.totalFrames - 1) {
        // Reached end, stop playing
        store.pause();
        store.seekToFrame(state.totalFrames - 1);
        lastTimeRef.current = 0;
        options?.onFrameChange?.(state.totalFrames - 1);
      } else {
        const frameInt = Math.floor(nextFrame);
        if (frameInt !== state.currentFrame) {
          store.seekToFrame(frameInt);
          options?.onFrameChange?.(frameInt);
        }
        lastTimeRef.current = timestamp;
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    lastTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [store.isPlaying, store.speed, store.totalFrames, store.currentFrame, options]);

  // Notify on playback state change
  useEffect(() => {
    options?.onPlaybackStateChange?.(store.isPlaying);
  }, [store.isPlaying, options]);

  return store;
}
