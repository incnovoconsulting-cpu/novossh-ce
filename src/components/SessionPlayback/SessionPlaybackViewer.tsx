import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Download, AlertCircle } from '@/lib/icons';
import { SessionExportDialog } from './SessionExportDialog';
import { apiFetch } from '../../lib/apiFetch';
import { useStore } from '../../lib/store';
import clsx from 'clsx';

interface SessionPlaybackViewerProps {
  sessionId: string;
  sessionName?: string;
  autoPlay?: boolean;
}

interface PlaybackFrame {
  type: 'command' | 'output' | 'sync';
  timestamp: number;
  command?: string;
  output?: string;
  userId?: string;
  exitCode?: number;
}

interface SessionPlaybackData {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalDuration: number;
  commandCount: number;
  participantCount: number;
  frames: PlaybackFrame[];
}

export function SessionPlaybackViewer({
  sessionId,
  sessionName,
  autoPlay = false,
}: SessionPlaybackViewerProps) {
  const [playbackData, setPlaybackData] = useState<SessionPlaybackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const accessToken = useStore((s) => s.auth.accessToken);

  // Load playback data
  useEffect(() => {
    if (!accessToken) return;

    const loadPlaybackData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch(`/api/sessions/${sessionId}/playback`, accessToken);

        if (!response.ok) {
          throw new Error(`Failed to load playback data: HTTP ${response.status}`);
        }

        const data = await response.json();
        setPlaybackData(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load playback data';
        setError(message);
        console.error('Playback load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPlaybackData();
  }, [sessionId, accessToken]);

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying || !playbackData) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 100; // 100ms increments
        if (next >= playbackData.totalDuration) {
          setIsPlaying(false);
          return playbackData.totalDuration;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, playbackData]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(Math.min(newTime, playbackData?.totalDuration || 0));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <div className="animate-spin mr-2">⏳</div>
        Loading playback data...
      </div>
    );
  }

  if (error || !playbackData) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-200">Playback Error</h3>
            <p className="text-sm text-slate-300 mt-1">{error || 'Failed to load session playback data'}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalSeconds = Math.round(playbackData.totalDuration / 1000);
  const currentSeconds = Math.round(currentTime / 1000);
  const progress = (currentTime / playbackData.totalDuration) * 100;

  // Get frames up to current time
  const currentFrames = playbackData.frames.filter((f) => f.timestamp <= currentTime);
  const lastCommandFrame = [...currentFrames]
    .reverse()
    .find((f) => f.type === 'command');

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-ink-800 rounded-lg border border-white/[0.04] p-4 space-y-4">
        {/* Play Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              className="p-2 rounded-lg bg-neon-600 hover:bg-neon-700 text-white disabled:opacity-50"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
              title="Reset to start"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>

          <button
            onClick={() => setExportDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>

        {/* Timeline Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max={playbackData.totalDuration}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            disabled={isPlaying}
            className="w-full cursor-pointer"
          />
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              {String(currentSeconds).padStart(2, '0')}:{String(currentSeconds % 60).padStart(2, '0')}
            </span>
            <span>
              {String(totalSeconds).padStart(2, '0')}:{String(totalSeconds % 60).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-neon-600 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/[0.04]">
          <div>
            <div className="text-xs text-slate-400">Commands</div>
            <div className="text-lg font-semibold text-slate-200">{playbackData.commandCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Participants</div>
            <div className="text-lg font-semibold text-slate-200">{playbackData.participantCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Duration</div>
            <div className="text-lg font-semibold text-slate-200">{totalSeconds}s</div>
          </div>
        </div>
      </div>

      {/* Terminal Output Display */}
      <div className="bg-black rounded-lg border border-white/[0.04] p-4 font-mono text-sm text-slate-300 h-96 overflow-y-auto">
        <div className="space-y-1">
          {currentFrames.length === 0 ? (
            <div className="text-slate-500">Waiting to start...</div>
          ) : (
            currentFrames.map((frame, idx) => (
              <div key={idx} className={clsx('text-xs', frame.type === 'command' && 'text-neon-400')}>
                {frame.type === 'command' && (
                  <div>
                    <span className="text-slate-500">$ </span>
                    <span className="text-neon-400">{frame.command}</span>
                  </div>
                )}
                {frame.type === 'output' && (
                  <div className="text-slate-300 whitespace-pre-wrap break-words">
                    {frame.output}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Command Info */}
      {lastCommandFrame && (
        <div className="p-3 rounded-lg bg-slate-800 border border-white/[0.04]">
          <div className="text-xs text-slate-400 mb-1">Current Command</div>
          <div className="text-sm font-mono text-neon-400 break-all">{lastCommandFrame.command}</div>
        </div>
      )}

      {/* Export Dialog */}
      <SessionExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        sessionId={sessionId}
        sessionName={sessionName}
      />
    </div>
  );
}
