import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlaybackProgress } from '../PlaybackProgress';

describe('PlaybackProgress Component', () => {
  describe('Time Formatting', () => {
    it('should format MM:SS for durations under 1 hour', () => {
      const { container } = render(
        <PlaybackProgress
          currentTime={45000}
          duration={300000}
          isPlaying={false}
        />
      );

      const spans = container.querySelectorAll('span[title]');
      expect(Array.from(spans).map(s => s.textContent)).toContain('0:45');
      expect(Array.from(spans).map(s => s.textContent)).toContain('5:00');
    });

    it('should format HH:MM:SS for durations over 1 hour', () => {
      const { container } = render(
        <PlaybackProgress
          currentTime={3665000}
          duration={7200000}
          isPlaying={false}
        />
      );

      const spans = container.querySelectorAll('span[title]');
      expect(Array.from(spans).map(s => s.textContent)).toContain('1:01:05');
      expect(Array.from(spans).map(s => s.textContent)).toContain('2:00:00');
    });

    it('should pad single digit values with leading zeros', () => {
      const { container } = render(
        <PlaybackProgress
          currentTime={65000}
          duration={125000}
          isPlaying={false}
        />
      );

      const spans = container.querySelectorAll('span[title]');
      expect(Array.from(spans).map(s => s.textContent)).toContain('1:05');
      expect(Array.from(spans).map(s => s.textContent)).toContain('2:05');
    });
  });

  describe('Progress Bar', () => {
    it('should display progress bar at start position', () => {
      render(
        <PlaybackProgress
          currentTime={0}
          duration={300000}
          isPlaying={false}
        />
      );

      const progressFill = document.querySelector('[class*="progressFill"]');
      expect(progressFill).toHaveStyle('width: 0%');
    });

    it('should display progress bar at 50% midway', () => {
      render(
        <PlaybackProgress
          currentTime={150000}
          duration={300000}
          isPlaying={false}
        />
      );

      const progressFill = document.querySelector('[class*="progressFill"]');
      expect(progressFill).toHaveStyle('width: 50%');
    });

    it('should display progress bar at 100% at end', () => {
      render(
        <PlaybackProgress
          currentTime={300000}
          duration={300000}
          isPlaying={false}
        />
      );

      const progressFill = document.querySelector('[class*="progressFill"]');
      expect(progressFill).toHaveStyle('width: 100%');
    });

    it('should handle edge case with 0 duration', () => {
      render(
        <PlaybackProgress
          currentTime={0}
          duration={0}
          isPlaying={false}
        />
      );

      const progressFill = document.querySelector('[class*="progressFill"]');
      expect(progressFill).toHaveStyle('width: 0%');
    });
  });

  describe('Animation State', () => {
    it('should apply animating class when playing', () => {
      render(
        <PlaybackProgress
          currentTime={50000}
          duration={300000}
          isPlaying={true}
        />
      );

      const progressFill = document.querySelector('[class*="progressFill"]');
      expect(progressFill?.className).toContain('animating');
    });

    it('should remove animating class when paused', () => {
      render(
        <PlaybackProgress
          currentTime={50000}
          duration={300000}
          isPlaying={false}
        />
      );

      const progressFill = document.querySelector('[class*="progressFill"]');
      expect(progressFill?.className).not.toContain('animating');
    });

    it('should toggle animation on play/pause state change', () => {
      const { rerender } = render(
        <PlaybackProgress
          currentTime={50000}
          duration={300000}
          isPlaying={false}
        />
      );

      let progressFill = document.querySelector('[class*="progressFill"]');
      expect(progressFill?.className).not.toContain('animating');

      rerender(
        <PlaybackProgress
          currentTime={50000}
          duration={300000}
          isPlaying={true}
        />
      );

      progressFill = document.querySelector('[class*="progressFill"]');
      expect(progressFill?.className).toContain('animating');
    });
  });

  describe('ARIA Attributes', () => {
    it('should have progressbar role', () => {
      render(
        <PlaybackProgress
          currentTime={75000}
          duration={300000}
          isPlaying={false}
        />
      );

      const progressBar = document.querySelector('[role="progressbar"]');
      expect(progressBar).toBeInTheDocument();
    });

    it('should have correct aria attributes', () => {
      render(
        <PlaybackProgress
          currentTime={150000}
          duration={300000}
          isPlaying={false}
        />
      );

      const progressBar = document.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('should update aria-valuenow as playback progresses', () => {
      const { rerender } = render(
        <PlaybackProgress
          currentTime={0}
          duration={300000}
          isPlaying={false}
        />
      );

      let progressBar = document.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');

      rerender(
        <PlaybackProgress
          currentTime={150000}
          duration={300000}
          isPlaying={false}
        />
      );

      progressBar = document.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');

      rerender(
        <PlaybackProgress
          currentTime={300000}
          duration={300000}
          isPlaying={false}
        />
      );

      progressBar = document.querySelector('[role="progressbar"]');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });
  });

  describe('Time Display Updates', () => {
    it('should update current time display', () => {
      const { rerender, container } = render(
        <PlaybackProgress
          currentTime={0}
          duration={300000}
          isPlaying={false}
        />
      );

      let spans = container.querySelectorAll('span[title*="Elapsed"]');
      expect(spans[0].textContent).toBe('0:00');

      rerender(
        <PlaybackProgress
          currentTime={45000}
          duration={300000}
          isPlaying={false}
        />
      );

      spans = container.querySelectorAll('span[title*="Elapsed"]');
      expect(spans[0].textContent).toBe('0:45');
    });

    it('should display total duration consistently', () => {
      const { rerender, container } = render(
        <PlaybackProgress
          currentTime={0}
          duration={300000}
          isPlaying={false}
        />
      );

      let spans = container.querySelectorAll('span[title*="Total"]');
      expect(spans[0].textContent).toBe('5:00');

      rerender(
        <PlaybackProgress
          currentTime={45000}
          duration={300000}
          isPlaying={false}
        />
      );

      spans = container.querySelectorAll('span[title*="Total"]');
      expect(spans[0].textContent).toBe('5:00');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle very long recordings (10+ hours)', () => {
      const { container } = render(
        <PlaybackProgress
          currentTime={36000000}
          duration={43200000}
          isPlaying={false}
        />
      );

      const spans = container.querySelectorAll('span[title]');
      expect(Array.from(spans).map(s => s.textContent)).toContain('10:00:00');
      expect(Array.from(spans).map(s => s.textContent)).toContain('12:00:00');
    });

    it('should handle short recordings (< 1 minute)', () => {
      const { container } = render(
        <PlaybackProgress
          currentTime={30000}
          duration={60000}
          isPlaying={false}
        />
      );

      const spans = container.querySelectorAll('span[title]');
      expect(Array.from(spans).map(s => s.textContent)).toContain('0:30');
      expect(Array.from(spans).map(s => s.textContent)).toContain('1:00');
    });

    it('should handle almost-at-end scenarios', () => {
      render(
        <PlaybackProgress
          currentTime={299500}
          duration={300000}
          isPlaying={true}
        />
      );

      const progressFill = document.querySelector('[class*="progressFill"]');
      expect(progressFill?.style.width).toMatch(/99\.8\d+%/);
    });
  });
});
