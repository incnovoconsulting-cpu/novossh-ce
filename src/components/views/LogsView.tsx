import { useState } from 'react';
import { BookOpen, Bookmark, BookmarkCheck, MessageSquare } from '@/lib/icons';
import { useStore } from '../../lib/store';
import { colorFor, initials, timeAgo } from '../../lib/format';

export function LogsView() {
  const sessionLogs = useStore((s) => s.sessionLogs);
  const bookmarkLog = useStore((s) => s.bookmarkLog);
  const unbookmarkLog = useStore((s) => s.unbookmarkLog);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const sortedLogs = [...sessionLogs].sort((a, b) => {
    if (a.bookmarked !== b.bookmarked) return a.bookmarked ? -1 : 1;
    return b.startedAt - a.startedAt;
  });

  const handleBookmark = (id: string) => {
    bookmarkLog(id);
    setEditingId(id);
    setComment('');
  };

  const handleSaveComment = () => {
    if (editingId) {
      bookmarkLog(editingId, comment);
      setEditingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Session logs</h1>
          <p className="text-sm text-slate-400">Review past sessions. Bookmark important ones for future reference.</p>
        </div>
      </div>

      <div className="mt-8 space-y-2">
        {sortedLogs.map((log) => {
          const color = colorFor(log.hostLabel);
          return (
            <div
              key={log.id}
              className="rounded-lg border border-white/[0.04] bg-ink-800 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold text-white"
                    style={{ background: color }}
                  >
                    {initials(log.hostLabel)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100">{log.hostLabel}</span>
                      {log.bookmarked && (
                        <BookmarkCheck className="h-3.5 w-3.5 text-amber-400" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {timeAgo(log.startedAt)} · {log.commandCount} commands
                      {log.endedAt && ` · ${Math.round((log.endedAt - log.startedAt) / 1000)}s`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {log.bookmarked ? (
                    <button
                      onClick={() => unbookmarkLog(log.id)}
                      className="rounded p-1 text-amber-400 hover:bg-amber-400/10"
                      title="Remove bookmark"
                    >
                      <BookmarkCheck className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBookmark(log.id)}
                      className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                      title="Bookmark"
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {log.bookmarked && log.bookmarkComment && editingId !== log.id && (
                <div className="mt-2 flex items-start gap-2 rounded bg-ink-900 px-3 py-2">
                  <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-slate-500" />
                  <span className="text-xs text-slate-400">{log.bookmarkComment}</span>
                </div>
              )}

              {editingId === log.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveComment()}
                    placeholder="Add a comment…"
                    className="input flex-1 text-xs"
                  />
                  <button onClick={handleSaveComment} className="btn-primary text-xs">Save</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-xs">Cancel</button>
                </div>
              )}
            </div>
          );
        })}

        {sortedLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-slate-600 mb-4" />
            <h2 className="text-lg text-slate-400 font-medium mb-1">No session logs yet</h2>
            <p className="text-sm text-slate-500">Connect to a host to start recording sessions</p>
          </div>
        )}
      </div>
    </div>
  );
}
