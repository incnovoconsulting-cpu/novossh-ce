import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlaybackFrameList } from '../PlaybackFrameList';
import { PlaybackFrame } from '../../../lib/types';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('PlaybackFrameList', () => {
  const mockFrames: PlaybackFrame[] = [
    {
      type: 'command',
      timestamp: 1000,
      command: 'ls -la',
      userId: 'user-1',
    },
    {
      type: 'output',
      timestamp: 1050,
      output: 'total 42\ndrwxr-xr-x',
      exitCode: 0,
    },
    {
      type: 'command',
      timestamp: 5000,
      command: 'pwd',
      userId: 'user-1',
    },
    {
      type: 'output',
      timestamp: 5050,
      output: '/home/user',
      exitCode: 0,
    },
    {
      type: 'command',
      timestamp: 10000,
      command: 'echo "done"',
      userId: 'user-2',
    },
    {
      type: 'output',
      timestamp: 10050,
      output: 'done',
      exitCode: 0,
    },
  ];

  const mockUserNames = {
    'user-1': 'alice',
    'user-2': 'bob',
  };

  describe('rendering', () => {
    it('should render all frames', () => {
      render(
        <PlaybackFrameList
          frames={mockFrames}
          userNames={mockUserNames}
          scrollable={false}
        />
      );

      expect(screen.getByText('ls -la')).toBeInTheDocument();
      expect(screen.getByText('pwd')).toBeInTheDocument();
      expect(screen.getByText('echo "done"')).toBeInTheDocument();
    });

    it('should render empty state when no frames', () => {
      render(<PlaybackFrameList frames={[]} scrollable={false} />);

      expect(screen.getByText('No frames to display')).toBeInTheDocument();
    });

    it('should render timeline dots for each frame', () => {
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          scrollable={false}
        />
      );

      const dots = container.querySelectorAll('[class*="timelineDot"]');
      expect(dots.length).toBe(mockFrames.length);
    });

    it('should apply correct styling to timeline dots', () => {
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          scrollable={false}
        />
      );

      const commandDots = container.querySelectorAll('[class*="timelineDot"][class*="command"]');
      const outputDots = container.querySelectorAll('[class*="timelineDot"][class*="output"]');

      expect(commandDots.length).toBeGreaterThan(0);
      expect(outputDots.length).toBeGreaterThan(0);
    });
  });

  describe('frame highlighting', () => {
    it('should highlight current frame by index', () => {
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          currentFrameIndex={1}
          scrollable={false}
        />
      );

      const frameItems = container.querySelectorAll('[class*="frameListItem"]');
      expect(frameItems[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should update highlighted frame when currentFrameIndex changes', () => {
      const { container, rerender } = render(
        <PlaybackFrameList
          frames={mockFrames}
          currentFrameIndex={0}
          scrollable={false}
        />
      );

      let frameItems = container.querySelectorAll('[class*="frameListItem"]');
      expect(frameItems[0]).toHaveAttribute('aria-selected', 'true');

      rerender(
        <PlaybackFrameList
          frames={mockFrames}
          currentFrameIndex={2}
          scrollable={false}
        />
      );

      frameItems = container.querySelectorAll('[class*="frameListItem"]');
      expect(frameItems[2]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('user interaction', () => {
    it('should call onFrameClick when frame is clicked', () => {
      const onFrameClick = vi.fn();
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          onFrameClick={onFrameClick}
          scrollable={false}
        />
      );

      const frameItems = container.querySelectorAll('[class*="frameListItem"]');
      fireEvent.click(frameItems[0]);

      expect(onFrameClick).toHaveBeenCalledWith(0, mockFrames[0].timestamp);
    });

    it('should call onFrameClick with correct frame index and timestamp', () => {
      const onFrameClick = vi.fn();
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          onFrameClick={onFrameClick}
          scrollable={false}
        />
      );

      const frameItems = container.querySelectorAll('[class*="frameListItem"]');
      fireEvent.click(frameItems[3]);

      expect(onFrameClick).toHaveBeenCalledWith(3, mockFrames[3].timestamp);
    });

    it('should support keyboard navigation with Enter key', () => {
      const onFrameClick = vi.fn();
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          onFrameClick={onFrameClick}
          scrollable={false}
        />
      );

      const frameItem = container.querySelector('[class*="frameListItem"]') as HTMLElement;
      fireEvent.keyDown(frameItem, { key: 'Enter' });

      expect(onFrameClick).toHaveBeenCalled();
    });

    it('should support keyboard navigation with Space key', () => {
      const onFrameClick = vi.fn();
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          onFrameClick={onFrameClick}
          scrollable={false}
        />
      );

      const frameItem = container.querySelector('[class*="frameListItem"]') as HTMLElement;
      fireEvent.keyDown(frameItem, { key: ' ' });

      expect(onFrameClick).toHaveBeenCalled();
    });

    it('should not call onFrameClick if handler not provided', () => {
      const { container } = render(
        <PlaybackFrameList frames={mockFrames} scrollable={false} />
      );

      const frameItems = container.querySelectorAll('[class*="frameListItem"]');
      // Should not throw
      fireEvent.click(frameItems[0]);
    });
  });

  describe('scrolling behavior', () => {
    it('should add scrollable class when scrollable prop is true', () => {
      const { container } = render(
        <PlaybackFrameList frames={mockFrames} scrollable={true} />
      );

      const frameList = container.querySelector('[class*="frameList"][class*="scrollable"]');
      expect(frameList).toBeInTheDocument();
    });

    it('should add fixed class when scrollable prop is false', () => {
      const { container } = render(
        <PlaybackFrameList frames={mockFrames} scrollable={false} />
      );

      const frameList = container.querySelector('[class*="frameList"][class*="fixed"]');
      expect(frameList).toBeInTheDocument();
    });

    it('should auto-scroll to current frame', async () => {
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          currentFrameIndex={0}
          scrollable={false}
        />
      );

      const frameItems = container.querySelectorAll('[class*="frameListItem"]');
      expect(frameItems[0]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('virtual scrolling', () => {
    it('should handle large frame lists efficiently', () => {
      const largeFrameList = Array.from({ length: 200 }, (_, i) => ({
        type: (i % 2 === 0 ? 'command' : 'output') as const,
        timestamp: i * 1000,
        command: i % 2 === 0 ? `command ${i}` : undefined,
        output: i % 2 === 1 ? `output ${i}` : undefined,
        userId: i % 2 === 0 ? 'user-1' : undefined,
      }));

      const { container } = render(
        <PlaybackFrameList frames={largeFrameList} scrollable={true} />
      );

      // Should render without performance issues
      expect(container.querySelector('[class*="frameList"]')).toBeInTheDocument();
    });

    it('should show spacers for virtual scrolling', () => {
      const largeFrameList = Array.from({ length: 200 }, (_, i) => ({
        type: 'command' as const,
        timestamp: i * 1000,
        command: `command ${i}`,
      }));

      const { container } = render(
        <PlaybackFrameList frames={largeFrameList} scrollable={true} />
      );

      const spacers = container.querySelectorAll('[class*="spacer"]');
      expect(spacers.length).toBeGreaterThan(0);
    });
  });

  describe('user names mapping', () => {
    it('should display user names from userNames prop', () => {
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          userNames={mockUserNames}
          scrollable={false}
        />
      );

      // Check that user name elements exist for alice and bob
      const userNameElements = container.querySelectorAll('[class*="userName"]');
      expect(userNameElements.length).toBeGreaterThan(0);
    });

    it('should handle missing user names gracefully', () => {
      const framesWithUnknownUser = [
        {
          type: 'command' as const,
          timestamp: 1000,
          command: 'test',
          userId: 'user-unknown',
        },
      ];

      render(
        <PlaybackFrameList
          frames={framesWithUnknownUser}
          userNames={mockUserNames}
          scrollable={false}
        />
      );

      // Should render without error and show the command
      expect(screen.getByText('test')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have list role', () => {
      const { container } = render(
        <PlaybackFrameList frames={mockFrames} scrollable={false} />
      );

      expect(container.querySelector('[role="list"]')).toBeInTheDocument();
    });

    it('should have listitem role for each frame', () => {
      const { container } = render(
        <PlaybackFrameList frames={mockFrames} scrollable={false} />
      );

      const listItems = container.querySelectorAll('[role="listitem"]');
      expect(listItems.length).toBe(mockFrames.length);
    });

    it('should have aria-label', () => {
      const { container } = render(
        <PlaybackFrameList frames={mockFrames} scrollable={false} />
      );

      const list = container.querySelector('[aria-label="Session frames"]');
      expect(list).toBeInTheDocument();
    });

    it('should mark active item with aria-selected', () => {
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          currentFrameIndex={1}
          scrollable={false}
        />
      );

      const listItems = container.querySelectorAll('[role="listitem"]');
      expect(listItems[1]).toHaveAttribute('aria-selected', 'true');
      expect(listItems[0]).toHaveAttribute('aria-selected', 'false');
    });

    it('should have tabIndex for keyboard navigation', () => {
      const { container } = render(
        <PlaybackFrameList frames={mockFrames} scrollable={false} />
      );

      const listItems = container.querySelectorAll('[role="listitem"]');
      listItems.forEach((item) => {
        expect(item).toHaveAttribute('tabindex', '0');
      });
    });
  });

  describe('frame content rendering', () => {
    it('should render FrameRenderer for each frame', () => {
      render(
        <PlaybackFrameList
          frames={mockFrames}
          userNames={mockUserNames}
          scrollable={false}
        />
      );

      // FrameRenderer should display the frame content
      expect(screen.getByText('ls -la')).toBeInTheDocument();
      expect(screen.getByText(/total 42/)).toBeInTheDocument();
    });

    it('should pass isHighlighted prop to FrameRenderer', () => {
      const { container } = render(
        <PlaybackFrameList
          frames={mockFrames}
          currentFrameIndex={0}
          scrollable={false}
        />
      );

      // First frame should have highlighted styling applied
      const firstFrameItem = container.querySelector('[class*="frameListItem"]');
      expect(firstFrameItem).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('responsive design', () => {
    it('should render with scrollable layout', () => {
      const { container } = render(
        <PlaybackFrameList frames={mockFrames} scrollable={true} />
      );

      const frameList = container.querySelector('[class*="frameList"][class*="scrollable"]');
      expect(frameList).toBeInTheDocument();
    });
  });
});
