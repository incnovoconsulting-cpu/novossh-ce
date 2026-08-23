import { useState, useEffect } from 'react';
import { Play, Clock, ArrowLeft, Terminal } from '@/lib/icons';
import { SessionPlaybackViewer } from '../SessionPlayback/SessionPlaybackViewer';
import clsx from 'clsx';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface Session {
  id: string;
  name: string;
  hostAddress: string;
  startedAt: string;
  endedAt?: string;
  commandCount: number;
  participantCount: number;
}

export function SessionsView() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('novossh-auth');
      const parsed = token ? JSON.parse(token) : null;
      const res = await fetch(`${API_BASE}/api/sessions`, {
        headers: parsed?.accessToken ? { Authorization: `Bearer ${parsed.accessToken}` } : {},
      });
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      setSessions(data.sessions || data || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSessions(); }, []);

  if (selectedSession) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <button
          onClick={() => setSelectedSession(null)}
          className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sessions
        </button>
        <SessionPlaybackViewer
          sessionId={selectedSession.id}
          sessionName={selectedSession.name}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Sessions</h2>
          <p className="text-sm text-slate-400">Review and replay recorded SSH sessions.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-500">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/[0.06] p-8 text-center">
            <Terminal className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-2 text-sm text-slate-500">No recorded sessions yet.</p>
            <p className="text-xs text-slate-600">Sessions are recorded when you connect to a host.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSession(s)}
                className="w-full rounded-lg border border-white/[0.04] bg-ink-800 p-4 text-left hover:border-white/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-slate-200">{s.name || s.hostAddress}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{s.hostAddress}</p>
                  </div>
                  <Play className="h-4 w-4 text-neon" />
                </div>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(s.startedAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Terminal className="h-3 w-3" />
                    {s.commandCount} commands
                  </span>
                  {s.participantCount > 1 && (
                    <span className="flex items-center gap-1">
                      {s.participantCount} participants
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
