import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaybackControls } from '../PlaybackControls';
import { PlaybackSpeed } from '../../../hooks/usePlaybackPlayer';

describe('PlaybackControls Component', () => {
  const mockCallbacks = {
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSpeedChange: vi.fn(),
    onNextFrame: vi.fn(),
    onPreviousFrame: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Play/Pause Button', () => {
    it('should show play button when not playing', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={0}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const playButton = screen.getByRole('button', { name: /play playback/i });
      expect(playButton).toBeInTheDocument();
      expect(playButton).toHaveTextContent('▶');
    });

    it('should show pause button when playing', () => {
      render(
        <PlaybackControls
          isPlaying={true}
          speed={1}
          currentFrame={50}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const pauseButton = screen.getByRole('button', { name: /pause playback/i });
      expect(pauseButton).toBeInTheDocument();
      expect(pauseButton).toHaveTextContent('⏸');
    });

    it('should call onPlay when clicking play button', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={0}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const playButton = screen.getByRole('button', { name: /play playback/i });
      fireEvent.click(playButton);

      expect(mockCallbacks.onPlay).toHaveBeenCalledTimes(1);
    });

    it('should call onPause when clicking pause button', () => {
      render(
        <PlaybackControls
          isPlaying={true}
          speed={1}
          currentFrame={50}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const pauseButton = screen.getByRole('button', { name: /pause playback/i });
      fireEvent.click(pauseButton);

      expect(mockCallbacks.onPause).toHaveBeenCalledTimes(1);
    });

    it('should restart playback when at end', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={99}
          totalFrames={100}
          isAtEnd={true}
          {...mockCallbacks}
        />
      );

      const playButton = screen.getByRole('button', { name: /play playback/i });
      fireEvent.click(playButton);

      expect(mockCallbacks.onPlay).toHaveBeenCalledTimes(1);
    });
  });

  describe('Frame Navigation', () => {
    it('should call onNextFrame when next button clicked', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={50}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next frame/i });
      fireEvent.click(nextButton);

      expect(mockCallbacks.onNextFrame).toHaveBeenCalledTimes(1);
    });

    it('should call onPreviousFrame when previous button clicked', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={50}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous frame/i });
      fireEvent.click(prevButton);

      expect(mockCallbacks.onPreviousFrame).toHaveBeenCalledTimes(1);
    });

    it('should disable next frame button at end', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={99}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next frame/i });
      expect(nextButton).toBeDisabled();
    });

    it('should disable previous frame button at start', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={0}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const prevButton = screen.getByRole('button', { name: /previous frame/i });
      expect(prevButton).toBeDisabled();
    });
  });

  describe('Speed Control', () => {
    it('should display current speed', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1.5}
          currentFrame={0}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const speedSelect = screen.getByLabelText(/playback speed/i) as HTMLSelectElement;
      expect(speedSelect.value).toBe('1.5');
    });

    it('should have all speed options available', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={0}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const speedSelect = screen.getByLabelText(/playback speed/i);
      const options = speedSelect.querySelectorAll('option');

      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('0.5x');
      expect(options[1]).toHaveTextContent('1x');
      expect(options[2]).toHaveTextContent('1.5x');
      expect(options[3]).toHaveTextContent('2x');
    });

    it('should call onSpeedChange when speed is changed', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={0}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      const speedSelect = screen.getByLabelText(/playback speed/i);
      fireEvent.change(speedSelect, { target: { value: '2' } });

      expect(mockCallbacks.onSpeedChange).toHaveBeenCalledWith(2);
    });
  });

  describe('Frame Counter', () => {
    it('should display current frame and total frames', () => {
      const { container } = render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={45}
          totalFrames={300}
          {...mockCallbacks}
        />
      );

      const frameNumber = container.querySelector('[class*="frameNumber"]');
      expect(frameNumber?.textContent).toBe('46');
    });

    it('should update frame counter as playback progresses', () => {
      const { rerender, container } = render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={0}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      let frameNumber = container.querySelector('[class*="frameNumber"]');
      expect(frameNumber?.textContent).toBe('1');

      rerender(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={50}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      frameNumber = container.querySelector('[class*="frameNumber"]');
      expect(frameNumber?.textContent).toBe('51');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should play/pause with spacebar', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={0}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      fireEvent.keyDown(window, { key: ' ' });

      expect(mockCallbacks.onPlay).toHaveBeenCalledTimes(1);
    });

    it('should next frame with right arrow', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={50}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockCallbacks.onNextFrame).toHaveBeenCalledTimes(1);
    });

    it('should previous frame with left arrow', () => {
      render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={50}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      fireEvent.keyDown(window, { key: 'ArrowLeft' });

      expect(mockCallbacks.onPreviousFrame).toHaveBeenCalledTimes(1);
    });

    it('should not trigger keyboard shortcuts in input fields', () => {
      render(
        <div>
          <input type="text" />
          <PlaybackControls
            isPlaying={false}
            speed={1}
            currentFrame={0}
            totalFrames={100}
            {...mockCallbacks}
          />
        </div>
      );

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: ' ' });

      expect(mockCallbacks.onPlay).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <PlaybackControls
          isPlaying={true}
          speed={1}
          currentFrame={50}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      expect(screen.getByLabelText(/pause playback/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/next frame/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/previous frame/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/playback speed/i)).toBeInTheDocument();
    });

    it('should have aria-pressed for play button', () => {
      const { rerender } = render(
        <PlaybackControls
          isPlaying={false}
          speed={1}
          currentFrame={0}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      let button = screen.getByLabelText(/play playback/i);
      expect(button).toHaveAttribute('aria-pressed', 'false');

      rerender(
        <PlaybackControls
          isPlaying={true}
          speed={1}
          currentFrame={0}
          totalFrames={100}
          {...mockCallbacks}
        />
      );

      button = screen.getByLabelText(/pause playback/i);
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
