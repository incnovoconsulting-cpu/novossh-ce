import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlaybackContainer } from '../PlaybackContainer';

describe('PlaybackContainer Integration', () => {
  const mockFrameChange = vi.fn();
  const mockPlaybackStateChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all playback components', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onFrameChange={mockFrameChange}
        />
      );

      // PlaybackControls
      expect(screen.getByRole('button', { name: /play playback/i })).toBeInTheDocument();

      // PlaybackProgress
      expect(screen.getByText(/00:00/)).toBeInTheDocument();
      expect(screen.getByText(/10:00/)).toBeInTheDocument();

      // FrameScrubber
      expect(screen.getByText(/frame 1/i)).toBeInTheDocument();
    });

    it('should render with custom class name', () => {
      const { container } = render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          className="custom-playback"
        />
      );

      const containerElement = container.firstChild as HTMLElement;
      expect(containerElement).toHaveClass('custom-playback');
    });
  });

  describe('Playback Control Integration', () => {
    it('should play and pause using controls', async () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onPlaybackStateChange={mockPlaybackStateChange}
        />
      );

      const playButton = screen.getByRole('button', { name: /play playback/i });
      fireEvent.click(playButton);

      await waitFor(() => {
        expect(mockPlaybackStateChange).toHaveBeenCalledWith(true);
      });

      const pauseButton = screen.getByRole('button', { name: /pause playback/i });
      fireEvent.click(pauseButton);

      expect(mockPlaybackStateChange).toHaveBeenCalledWith(false);
    });

    it('should navigate frames using previous/next buttons', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onFrameChange={mockFrameChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next frame/i });
      fireEvent.click(nextButton);

      expect(mockFrameChange).toHaveBeenCalledWith(1);

      const prevButton = screen.getByRole('button', { name: /previous frame/i });
      fireEvent.click(prevButton);

      expect(mockFrameChange).toHaveBeenCalled();
    });

    it('should change speed using speed control', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          initialSpeed={1}
        />
      );

      const speedSelect = screen.getByLabelText(/playback speed/i);
      fireEvent.change(speedSelect, { target: { value: '2' } });

      expect(speedSelect).toHaveDisplayValue('2');
    });
  });

  describe('Scrubber Integration', () => {
    it('should seek using scrubber', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onFrameChange={mockFrameChange}
        />
      );

      const track = document.querySelector('.track') as HTMLElement;
      fireEvent.click(track, { clientX: 50 });

      expect(mockFrameChange).toHaveBeenCalled();
    });

    it('should show frame preview on hover', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          showFramePreview={true}
        />
      );

      const track = document.querySelector('.track') as HTMLElement;
      fireEvent.mouseMove(track, { clientX: 50 });

      const preview = document.querySelector('.previewTooltip');
      expect(preview).toBeInTheDocument();
    });

    it('should hide preview when showFramePreview is false', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          showFramePreview={false}
        />
      );

      const track = document.querySelector('.track') as HTMLElement;
      fireEvent.mouseMove(track, { clientX: 50 });

      const preview = document.querySelector('.previewTooltip');
      expect(preview).not.toBeInTheDocument();
    });
  });

  describe('Progress Display', () => {
    it('should display correct time format', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
        />
      );

      // 300 frames at 30fps = 10 seconds
      expect(screen.getByText('00:00')).toBeInTheDocument();
      expect(screen.getByText('10:00')).toBeInTheDocument();
    });

    it('should calculate correct duration from frame rate', () => {
      render(
        <PlaybackContainer
          totalFrames={600}
          frameRate={60}
        />
      );

      // 600 frames at 60fps = 10 seconds
      expect(screen.getByText('10:00')).toBeInTheDocument();
    });
  });

  describe('Initialization', () => {
    it('should auto-play when autoPlay is true', async () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onPlaybackStateChange={mockPlaybackStateChange}
          autoPlay={true}
        />
      );

      await waitFor(
        () => {
          expect(mockPlaybackStateChange).toHaveBeenCalledWith(true);
        },
        { timeout: 500 }
      );
    });

    it('should not auto-play by default', async () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onPlaybackStateChange={mockPlaybackStateChange}
        />
      );

      // Wait a bit to ensure no auto-play occurs
      await waitFor(
        () => {
          expect(mockPlaybackStateChange).not.toHaveBeenCalled();
        },
        { timeout: 100 }
      );
    });

    it('should use custom initial speed', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          initialSpeed={2}
        />
      );

      const speedSelect = screen.getByLabelText(/playback speed/i);
      expect(speedSelect).toHaveDisplayValue('2');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support spacebar for play/pause', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onPlaybackStateChange={mockPlaybackStateChange}
        />
      );

      fireEvent.keyDown(window, { key: ' ' });

      expect(mockPlaybackStateChange).toHaveBeenCalledWith(true);
    });

    it('should support arrow keys for navigation', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onFrameChange={mockFrameChange}
        />
      );

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockFrameChange).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should call frame change callback', async () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onFrameChange={mockFrameChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next frame/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(mockFrameChange).toHaveBeenCalled();
      });
    });

    it('should call playback state change callback', async () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onPlaybackStateChange={mockPlaybackStateChange}
        />
      );

      const playButton = screen.getByRole('button', { name: /play playback/i });
      fireEvent.click(playButton);

      await waitFor(() => {
        expect(mockPlaybackStateChange).toHaveBeenCalledWith(true);
      });
    });

    it('should maintain state across component updates', () => {
      const { rerender } = render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onFrameChange={mockFrameChange}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next frame/i });
      fireEvent.click(nextButton);

      const callCount = mockFrameChange.mock.calls.length;

      rerender(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onFrameChange={mockFrameChange}
        />
      );

      // Frame change callback should not be called again
      expect(mockFrameChange.mock.calls.length).toBe(callCount);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero total frames gracefully', () => {
      render(
        <PlaybackContainer
          totalFrames={0}
          frameRate={30}
        />
      );

      expect(screen.getByRole('button', { name: /play playback/i })).toBeInTheDocument();
    });

    it('should handle single frame', () => {
      render(
        <PlaybackContainer
          totalFrames={1}
          frameRate={30}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next frame/i });
      expect(nextButton).toBeDisabled();
    });

    it('should handle very high frame rate', () => {
      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={120}
        />
      );

      // 300 frames at 120fps = 2.5 seconds
      expect(screen.getByText('00:02')).toBeInTheDocument();
    });
  });

  describe('Real-world Session Playback Scenario', () => {
    it('should work as a complete playback system', async () => {
      const frames: number[] = [];
      const recordFrame = (frame: number) => {
        frames.push(frame);
      };

      render(
        <PlaybackContainer
          totalFrames={300}
          frameRate={30}
          onFrameChange={recordFrame}
        />
      );

      // User plays the recording
      const playButton = screen.getByRole('button', { name: /play playback/i });
      fireEvent.click(playButton);

      // User seeks to middle
      const track = document.querySelector('.track') as HTMLElement;
      fireEvent.click(track, { clientX: 50 });

      // User changes speed
      const speedSelect = screen.getByLabelText(/playback speed/i);
      fireEvent.change(speedSelect, { target: { value: '2' } });

      // User pauses
      const pauseButton = screen.getByRole('button', { name: /pause playback/i });
      fireEvent.click(pauseButton);

      // User steps frame by frame
      const nextButton = screen.getByRole('button', { name: /next frame/i });
      fireEvent.click(nextButton);

      // Verify that all operations were tracked
      expect(frames.length).toBeGreaterThan(0);
    });
  });
});
