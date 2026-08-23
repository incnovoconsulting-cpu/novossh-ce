import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FrameRenderer } from '../FrameRenderer';
import { PlaybackFrame } from '../../../lib/types';

describe('FrameRenderer', () => {
  describe('command frame rendering', () => {
    it('should render command frame with command text', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 5000,
        command: 'ls -la /home',
        userId: 'user-1',
      };

      render(<FrameRenderer frame={frame} userName="alice" />);

      expect(screen.getByText('$')).toBeInTheDocument();
      expect(screen.getByText('ls -la /home')).toBeInTheDocument();
      expect(screen.getByText('00:05')).toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    it('should format timestamp correctly (MM:SS)', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 125000, // 2 minutes 5 seconds
        command: 'echo test',
      };

      render(<FrameRenderer frame={frame} />);

      expect(screen.getByText('02:05')).toBeInTheDocument();
    });

    it('should display exit code when provided', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 1000,
        command: 'grep pattern file.txt',
        exitCode: 1,
      };

      render(<FrameRenderer frame={frame} />);

      expect(screen.getByText('exit code: 1')).toBeInTheDocument();
    });

    it('should show success exit code styling', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 1000,
        command: 'ls',
        exitCode: 0,
      };

      const { container } = render(<FrameRenderer frame={frame} />);

      const exitCodeElement = screen.getByText('exit code: 0');
      expect(exitCodeElement).toBeInTheDocument();
      expect(exitCodeElement.className).toContain('exitCodeSuccess');
    });

    it('should show error exit code styling', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 1000,
        command: 'false',
        exitCode: 1,
      };

      render(<FrameRenderer frame={frame} />);

      const exitCodeElement = screen.getByText('exit code: 1');
      expect(exitCodeElement.className).toContain('exitCodeError');
    });

    it('should apply highlighted styling when highlighted prop is true', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 1000,
        command: 'test',
      };

      const { container } = render(
        <FrameRenderer frame={frame} isHighlighted={true} />
      );

      const frameDiv = container.querySelector('[class*="frame"][class*="highlighted"]');
      expect(frameDiv).toBeInTheDocument();
    });

    it('should not show userName when not provided', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 1000,
        command: 'test',
        userId: 'user-1',
      };

      render(<FrameRenderer frame={frame} />);

      // The frame should render but not show the userName
      expect(screen.queryByText('user-1')).not.toBeInTheDocument();
    });
  });

  describe('output frame rendering', () => {
    it('should render output frame with output text', () => {
      const frame: PlaybackFrame = {
        type: 'output',
        timestamp: 1050,
        output: 'total 42\ndrwxr-xr-x  5 user  staff  160 Jan  1',
      };

      render(<FrameRenderer frame={frame} />);

      expect(screen.getByText('❯')).toBeInTheDocument();
      expect(screen.getByText(/total 42/)).toBeInTheDocument();
      expect(screen.getByText('00:01')).toBeInTheDocument();
    });

    it('should preserve whitespace in output', () => {
      const frame: PlaybackFrame = {
        type: 'output',
        timestamp: 1000,
        output: '  spaces  and\n  newlines  ',
      };

      const { container } = render(<FrameRenderer frame={frame} />);

      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).toContain('spaces');
      expect(preElement?.textContent).toContain('newlines');
    });

    it('should handle empty output', () => {
      const frame: PlaybackFrame = {
        type: 'output',
        timestamp: 1000,
        output: '',
      };

      render(<FrameRenderer frame={frame} />);

      expect(screen.getByText('❯')).toBeInTheDocument();
    });

    it('should not show exit code for output frames', () => {
      const frame: PlaybackFrame = {
        type: 'output',
        timestamp: 1050,
        output: 'some output',
        exitCode: 0,
      };

      const { container } = render(<FrameRenderer frame={frame} />);

      expect(container.textContent).not.toContain('exit code');
    });

    it('should handle long output with scrolling', () => {
      const longOutput = Array(100).fill('line of output').join('\n');
      const frame: PlaybackFrame = {
        type: 'output',
        timestamp: 1000,
        output: longOutput,
      };

      const { container } = render(<FrameRenderer frame={frame} />);

      const outputContent = container.querySelector('[class*="outputContent"]');
      expect(outputContent).toBeInTheDocument();
    });
  });

  describe('sync frame rendering', () => {
    it('should render sync frame', () => {
      const frame: PlaybackFrame = {
        type: 'sync',
        timestamp: 5000,
      };

      render(<FrameRenderer frame={frame} />);

      expect(screen.getByText('⟳')).toBeInTheDocument();
      expect(screen.getByText('Multi-device sync')).toBeInTheDocument();
      expect(screen.getByText('00:05')).toBeInTheDocument();
    });

    it('should not render content for sync frames other than timestamp', () => {
      const frame: PlaybackFrame = {
        type: 'sync',
        timestamp: 5000,
        command: 'should not render',
        output: 'should not render',
      };

      render(<FrameRenderer frame={frame} />);

      expect(screen.getByText('⟳')).toBeInTheDocument();
      expect(screen.queryByText('should not render')).not.toBeInTheDocument();
    });
  });

  describe('timestamp formatting', () => {
    it('should format 0ms as 00:00', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 0,
        command: 'test',
      };

      render(<FrameRenderer frame={frame} />);

      expect(screen.getByText('00:00')).toBeInTheDocument();
    });

    it('should format large timestamps correctly', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 3661000, // 1 hour, 1 minute, 1 second
        command: 'test',
      };

      render(<FrameRenderer frame={frame} />);

      expect(screen.getByText('61:01')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have semantic structure for command frames', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 1000,
        command: 'test',
      };

      const { container } = render(<FrameRenderer frame={frame} />);

      const frameDiv = container.querySelector('[class*="frame"]');
      expect(frameDiv).toBeInTheDocument();
      expect(container.querySelector('[class*="commandContent"]')).toBeInTheDocument();
    });

    it('should use code element for command display', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 1000,
        command: 'ls -la',
      };

      const { container } = render(<FrameRenderer frame={frame} />);

      const codeElement = container.querySelector('code');
      expect(codeElement?.textContent).toBe('ls -la');
    });

    it('should use pre element for output display', () => {
      const frame: PlaybackFrame = {
        type: 'output',
        timestamp: 1000,
        output: 'output',
      };

      const { container } = render(<FrameRenderer frame={frame} />);

      const preElement = container.querySelector('pre');
      expect(preElement?.textContent).toContain('output');
    });
  });

  describe('styling', () => {
    it('should apply command frame styling', () => {
      const frame: PlaybackFrame = {
        type: 'command',
        timestamp: 1000,
        command: 'test',
      };

      const { container } = render(<FrameRenderer frame={frame} />);

      const frameDiv = container.querySelector('[class*="frame"]');
      expect(frameDiv).toBeInTheDocument();
      // Command frames should be rendered with proper structure
      expect(container.querySelector('code')).toBeInTheDocument();
    });

    it('should apply output frame styling', () => {
      const frame: PlaybackFrame = {
        type: 'output',
        timestamp: 1000,
        output: 'test',
      };

      const { container } = render(<FrameRenderer frame={frame} />);

      // Output frames should be rendered with pre element
      expect(container.querySelector('pre')).toBeInTheDocument();
    });

    it('should apply sync frame styling', () => {
      const frame: PlaybackFrame = {
        type: 'sync',
        timestamp: 1000,
      };

      const { container } = render(<FrameRenderer frame={frame} />);

      // Sync frames should display sync label
      expect(screen.getByText('Multi-device sync')).toBeInTheDocument();
    });
  });
});
