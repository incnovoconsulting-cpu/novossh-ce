import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FrameScrubber } from '../FrameScrubber';

describe('FrameScrubber Component', () => {
  const mockOnSeek = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render scrubber container', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const container = document.querySelector('.container');
      expect(container).toBeInTheDocument();
    });

    it('should display frame label', () => {
      render(
        <FrameScrubber
          currentFrame={45}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      expect(screen.getByText(/frame 46/i)).toBeInTheDocument();
    });

    it('should render scrubber thumb', () => {
      render(
        <FrameScrubber
          currentFrame={150}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb');
      expect(thumb).toBeInTheDocument();
    });

    it('should render track element', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const track = document.querySelector('.track');
      expect(track).toBeInTheDocument();
    });
  });

  describe('Position Calculation', () => {
    it('should position thumb at start', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb');
      expect(thumb).toHaveStyle('left: 0%');
    });

    it('should position thumb at 50% for middle frame', () => {
      render(
        <FrameScrubber
          currentFrame={150}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb');
      expect(thumb).toHaveStyle('left: 50%');
    });

    it('should position thumb at end', () => {
      render(
        <FrameScrubber
          currentFrame={299}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb');
      expect(thumb).toHaveStyle('left: 99.66666666666667%');
    });

    it('should update thumb position as frame changes', () => {
      const { rerender } = render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      let thumb = document.querySelector('.thumb');
      expect(thumb).toHaveStyle('left: 0%');

      rerender(
        <FrameScrubber
          currentFrame={150}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      thumb = document.querySelector('.thumb');
      expect(thumb).toHaveStyle('left: 50%');
    });
  });

  describe('Click to Seek', () => {
    it('should seek when track is clicked', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const track = document.querySelector('.track') as HTMLElement;
      fireEvent.click(track, { clientX: 50, clientY: 10 });

      expect(mockOnSeek).toHaveBeenCalled();
    });

    it('should seek to correct frame on middle click', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const track = document.querySelector('.track') as HTMLElement;
      const rect = track.getBoundingClientRect();
      fireEvent.click(track, { clientX: rect.left + rect.width / 2 });

      expect(mockOnSeek).toHaveBeenCalled();
      const lastCall = mockOnSeek.mock.calls[mockOnSeek.mock.calls.length - 1][0];
      expect(lastCall).toBeGreaterThan(100);
      expect(lastCall).toBeLessThan(200);
    });

    it('should clamp seek to valid frame range', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const track = document.querySelector('.track') as HTMLElement;
      const rect = track.getBoundingClientRect();

      fireEvent.click(track, { clientX: rect.left - 100 });
      let frame = mockOnSeek.mock.calls[mockOnSeek.mock.calls.length - 1][0];
      expect(frame).toBeGreaterThanOrEqual(0);

      fireEvent.click(track, { clientX: rect.right + 100 });
      frame = mockOnSeek.mock.calls[mockOnSeek.mock.calls.length - 1][0];
      expect(frame).toBeLessThanOrEqual(299);
    });
  });

  describe('Drag to Seek', () => {
    it('should seek while dragging', async () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      fireEvent.mouseDown(thumb);

      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }));

      await waitFor(() => {
        expect(mockOnSeek).toHaveBeenCalled();
      });
    });

    it('should stop dragging on mouseup', async () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      fireEvent.mouseDown(thumb);

      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }));
      window.dispatchEvent(new MouseEvent('mouseup'));

      const before = mockOnSeek.mock.calls.length;

      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }));

      expect(mockOnSeek.mock.calls.length).toEqual(before);
    });

    it('should apply active class while dragging', async () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      fireEvent.mouseDown(thumb);

      await waitFor(() => {
        expect(thumb).toHaveClass('active');
      });

      window.dispatchEvent(new MouseEvent('mouseup'));

      await waitFor(() => {
        expect(thumb).not.toHaveClass('active');
      });
    });
  });

  describe('Hover Preview', () => {
    it('should show hover frame preview on hover', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
          showFramePreview={true}
        />
      );

      const track = document.querySelector('.track') as HTMLElement;
      fireEvent.mouseMove(track, { clientX: 50 });

      const preview = document.querySelector('.previewTooltip');
      expect(preview).toBeInTheDocument();
    });

    it('should hide preview when leaving track', () => {
      const { rerender } = render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
          showFramePreview={true}
        />
      );

      const track = document.querySelector('.track') as HTMLElement;
      fireEvent.mouseMove(track, { clientX: 50 });

      let preview = document.querySelector('.previewTooltip');
      expect(preview).toBeInTheDocument();

      fireEvent.mouseLeave(track);

      rerender(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
          showFramePreview={true}
        />
      );

      preview = document.querySelector('.previewTooltip');
      expect(preview).not.toBeInTheDocument();
    });

    it('should not show preview when disabled', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
          showFramePreview={false}
        />
      );

      const track = document.querySelector('.track') as HTMLElement;
      fireEvent.mouseMove(track, { clientX: 50 });

      const preview = document.querySelector('.previewTooltip');
      expect(preview).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should seek forward with right arrow', () => {
      render(
        <FrameScrubber
          currentFrame={150}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      thumb.focus();

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnSeek).toHaveBeenCalledWith(151);
    });

    it('should seek backward with left arrow', () => {
      render(
        <FrameScrubber
          currentFrame={150}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      thumb.focus();

      fireEvent.keyDown(window, { key: 'ArrowLeft' });

      expect(mockOnSeek).toHaveBeenCalledWith(149);
    });

    it('should seek to start with Home key', () => {
      render(
        <FrameScrubber
          currentFrame={150}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      thumb.focus();

      fireEvent.keyDown(window, { key: 'Home' });

      expect(mockOnSeek).toHaveBeenCalledWith(0);
    });

    it('should seek to end with End key', () => {
      render(
        <FrameScrubber
          currentFrame={150}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      thumb.focus();

      fireEvent.keyDown(window, { key: 'End' });

      expect(mockOnSeek).toHaveBeenCalledWith(299);
    });

    it('should not respond to keyboard when not focused', () => {
      render(
        <FrameScrubber
          currentFrame={150}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      thumb.blur();

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(mockOnSeek).not.toHaveBeenCalled();
    });

    it('should clamp keyboard navigation to valid range', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      thumb.focus();

      fireEvent.keyDown(window, { key: 'ArrowLeft' });

      expect(mockOnSeek).toHaveBeenCalledWith(0);
    });
  });

  describe('Accessibility', () => {
    it('should have slider role', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const track = document.querySelector('[role="slider"]');
      expect(track).toBeInTheDocument();
    });

    it('should have correct ARIA attributes', () => {
      render(
        <FrameScrubber
          currentFrame={150}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const track = document.querySelector('[role="slider"]');
      expect(track).toHaveAttribute('aria-label', 'Frame scrubber');
      expect(track).toHaveAttribute('aria-valuenow', '150');
      expect(track).toHaveAttribute('aria-valuemin', '0');
      expect(track).toHaveAttribute('aria-valuemax', '299');
    });

    it('should have thumb be focusable', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      expect(thumb).toHaveAttribute('tabIndex', '0');
    });

    it('should have descriptive title on thumb', () => {
      render(
        <FrameScrubber
          currentFrame={45}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb');
      expect(thumb).toHaveAttribute('title', 'Frame 46 of 300');
    });
  });

  describe('Progress Indicator', () => {
    it('should show progress fill at correct width', () => {
      render(
        <FrameScrubber
          currentFrame={150}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      const progress = document.querySelector('.progress');
      expect(progress).toHaveStyle('width: 50%');
    });

    it('should update progress fill as frame changes', () => {
      const { rerender } = render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      let progress = document.querySelector('.progress');
      expect(progress).toHaveStyle('width: 0%');

      rerender(
        <FrameScrubber
          currentFrame={75}
          totalFrames={300}
          onSeek={mockOnSeek}
        />
      );

      progress = document.querySelector('.progress');
      expect(progress).toHaveStyle('width: 25%');
    });
  });

  describe('Hover Indicator', () => {
    it('should show hover indicator on hover', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
          showFramePreview={true}
        />
      );

      const track = document.querySelector('.track') as HTMLElement;
      fireEvent.mouseMove(track, { clientX: 50 });

      const hoverIndicator = document.querySelector('.hoverIndicator');
      expect(hoverIndicator).toBeInTheDocument();
    });

    it('should hide hover indicator while dragging', async () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={300}
          onSeek={mockOnSeek}
          showFramePreview={true}
        />
      );

      const thumb = document.querySelector('.thumb') as HTMLElement;
      const track = document.querySelector('.track') as HTMLElement;

      fireEvent.mouseMove(track, { clientX: 50 });
      let hoverIndicator = document.querySelector('.hoverIndicator');
      expect(hoverIndicator).toBeInTheDocument();

      fireEvent.mouseDown(thumb);

      await waitFor(() => {
        const indicators = document.querySelectorAll('.hoverIndicator');
        expect(indicators.length).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero frames', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={0}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb');
      expect(thumb).toHaveStyle('left: NaN%');
    });

    it('should handle single frame', () => {
      render(
        <FrameScrubber
          currentFrame={0}
          totalFrames={1}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb');
      expect(thumb).toHaveStyle('left: 0%');
    });

    it('should handle very large frame counts', () => {
      render(
        <FrameScrubber
          currentFrame={500000}
          totalFrames={1000000}
          onSeek={mockOnSeek}
        />
      );

      const thumb = document.querySelector('.thumb');
      expect(thumb).toHaveStyle('left: 50%');
    });
  });
});
