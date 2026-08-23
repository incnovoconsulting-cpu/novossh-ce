import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionPlaybackViewer } from '../SessionPlaybackViewer';

describe('SessionPlaybackViewer', () => {
  const mockSessionId = 'session-test-123';
  const mockSessionName = 'Test Session';

  const mockPlaybackData = {
    sessionId: mockSessionId,
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T10:00:20Z'),
    totalDuration: 20000, // 20 seconds
    commandCount: 3,
    participantCount: 2,
    frames: [
      {
        type: 'command' as const,
        timestamp: 1000,
        command: 'ls -la',
        userId: 'user-1',
      },
      {
        type: 'output' as const,
        timestamp: 1050,
        output: 'total 42\ndrwxr-xr-x  5 user  staff  160 Jan  1 10:00 .\ndrwxr-xr-x  3 root  wheel   96 Jan  1 10:00 ..',
        exitCode: 0,
      },
      {
        type: 'command' as const,
        timestamp: 5000,
        command: 'pwd',
        userId: 'user-1',
      },
      {
        type: 'output' as const,
        timestamp: 5050,
        output: '/home/user',
        exitCode: 0,
      },
      {
        type: 'command' as const,
        timestamp: 10000,
        command: 'echo "done"',
        userId: 'user-2',
      },
      {
        type: 'output' as const,
        timestamp: 10050,
        output: 'done',
        exitCode: 0,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const store: Record<string, string> = {};
    Storage.prototype.getItem = vi.fn((key: string) => store[key] || null);
    Storage.prototype.setItem = vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('should render loading state initially', () => {
      vi.spyOn(global, 'fetch').mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      expect(screen.getByText(/Loading playback data/)).toBeInTheDocument();
    });

    it('should render controls and playback area after loading', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockPlaybackData),
      } as any);

      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Play/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reset/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Export/ })).toBeInTheDocument();
      });
    });

    it('should display session statistics', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockPlaybackData),
      } as any);

      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument(); // Commands
        expect(screen.getByText('2')).toBeInTheDocument(); // Participants
        expect(screen.getByText('20s')).toBeInTheDocument(); // Duration
      });
    });

    it('should display error when fetch fails', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Playback Error/)).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });
  });

  describe('playback controls', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockPlaybackData),
      } as any);
    });

    it('should toggle play/pause', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const playButton = screen.getByRole('button', { name: /Play/ });
        expect(playButton).toBeInTheDocument();
      });

      const playButton = screen.getByRole('button', { name: /Play/ });
      fireEvent.click(playButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument();
      });
    });

    it('should reset to start on reset button click', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const timeline = screen.getByRole('slider') as HTMLInputElement;
        fireEvent.change(timeline, { target: { value: '5000' } });
      });

      const resetButton = screen.getByRole('button', { name: /Reset/ });
      fireEvent.click(resetButton);

      const timeline = screen.getByRole('slider') as HTMLInputElement;
      expect(timeline.value).toBe('0');
    });

    it('should seek on timeline slider change', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const timeline = screen.getByRole('slider') as HTMLInputElement;
        expect(timeline).toBeInTheDocument();
      });

      const timeline = screen.getByRole('slider') as HTMLInputElement;
      fireEvent.change(timeline, { target: { value: '5000' } });

      expect(timeline.value).toBe('5000');
    });

    it('should open export dialog when export button clicked', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /Export/ });
        fireEvent.click(exportButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Export Session')).toBeInTheDocument();
      });
    });
  });

  describe('playback animation', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockPlaybackData),
      } as any);
    });

    it('should advance time during playback', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const playButton = screen.getByRole('button', { name: /Play/ });
        fireEvent.click(playButton);
      });

      const timeline = screen.getByRole('slider') as HTMLInputElement;
      const initialValue = Number(timeline.value);

      vi.advanceTimersByTime(1000); // Advance 1 second

      expect(Number(timeline.value)).toBeGreaterThan(initialValue);
    });

    it('should stop playback when duration reached', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const playButton = screen.getByRole('button', { name: /Play/ });
        fireEvent.click(playButton);
      });

      vi.advanceTimersByTime(25000); // Advance past duration

      const timeline = screen.getByRole('slider') as HTMLInputElement;
      expect(Number(timeline.value)).toBeLessThanOrEqual(mockPlaybackData.totalDuration);
    });

    it('should not play when autoPlay is false', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
          autoPlay={false}
        />
      );

      await waitFor(() => {
        const playButton = screen.getByRole('button', { name: /Play/ });
        expect(playButton).toBeInTheDocument();
      });

      const timeline = screen.getByRole('slider') as HTMLInputElement;
      const initialValue = timeline.value;

      vi.advanceTimersByTime(1000);

      expect(timeline.value).toBe(initialValue);
    });

    it('should auto-play when autoPlay is true', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
          autoPlay={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument();
      });

      const timeline = screen.getByRole('slider') as HTMLInputElement;
      const initialValue = Number(timeline.value);

      vi.advanceTimersByTime(500);

      expect(Number(timeline.value)).toBeGreaterThan(initialValue);
    });
  });

  describe('frame display', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockPlaybackData),
      } as any);
    });

    it('should show "Waiting to start" initially', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Waiting to start...')).toBeInTheDocument();
      });
    });

    it('should display commands as they appear in timeline', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const timeline = screen.getByRole('slider') as HTMLInputElement;
        fireEvent.change(timeline, { target: { value: '2000' } });
      });

      await waitFor(() => {
        expect(screen.getByText('ls -la')).toBeInTheDocument();
      });
    });

    it('should display output after command', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const timeline = screen.getByRole('slider') as HTMLInputElement;
        fireEvent.change(timeline, { target: { value: '2000' } });
      });

      await waitFor(() => {
        expect(screen.getByText(/total 42/)).toBeInTheDocument();
      });
    });

    it('should update current command info', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const timeline = screen.getByRole('slider') as HTMLInputElement;
        fireEvent.change(timeline, { target: { value: '2000' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Current Command')).toBeInTheDocument();
        expect(screen.getByText('ls -la')).toBeInTheDocument();
      });
    });
  });

  describe('time display', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockPlaybackData),
      } as any);
    });

    it('should display current and total time', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('00:00')).toBeInTheDocument();
        expect(screen.getByText('00:20')).toBeInTheDocument();
      });
    });

    it('should update time as playback progresses', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const playButton = screen.getByRole('button', { name: /Play/ });
        fireEvent.click(playButton);
      });

      vi.advanceTimersByTime(5000);

      const timeline = screen.getByRole('slider') as HTMLInputElement;
      const currentTime = Math.round(Number(timeline.value) / 1000);
      expect(currentTime).toBeGreaterThan(0);
    });
  });

  describe('progress bar', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockPlaybackData),
      } as any);
    });

    it('should render progress bar', async () => {
      const { container } = render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const progressBar = container.querySelector('[style*="width"]');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should update progress bar width based on current time', async () => {
      const { container } = render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const timeline = screen.getByRole('slider') as HTMLInputElement;
        fireEvent.change(timeline, { target: { value: '10000' } }); // 50% progress
      });

      const progressBar = container.querySelector('[style*="width"]') as HTMLElement;
      expect(progressBar?.style.width).toContain('50');
    });
  });

  describe('slider interaction', () => {
    beforeEach(() => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockPlaybackData),
      } as any);
    });

    it('should disable slider during playback', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const playButton = screen.getByRole('button', { name: /Play/ });
        fireEvent.click(playButton);
      });

      const timeline = screen.getByRole('slider') as HTMLInputElement;
      expect(timeline.disabled).toBe(true);
    });

    it('should enable slider when paused', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const timeline = screen.getByRole('slider') as HTMLInputElement;
        expect(timeline.disabled).toBe(false);
      });
    });

    it('should clamp value to total duration', async () => {
      render(
        <SessionPlaybackViewer
          sessionId={mockSessionId}
          sessionName={mockSessionName}
        />
      );

      await waitFor(() => {
        const timeline = screen.getByRole('slider') as HTMLInputElement;
        fireEvent.change(timeline, { target: { value: '999999' } });
      });

      const timeline = screen.getByRole('slider') as HTMLInputElement;
      expect(Number(timeline.value)).toBeLessThanOrEqual(mockPlaybackData.totalDuration);
    });
  });
});
