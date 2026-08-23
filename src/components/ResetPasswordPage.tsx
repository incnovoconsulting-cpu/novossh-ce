import { useState, FormEvent } from 'react';
import { Loader, AlertCircle } from '@/lib/icons';
import { AppLogo } from './AppLogo';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center bg-ink-950 px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,229,255,0.06),transparent)]" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-ink-900/80 p-1.5 shadow-modal backdrop-blur-sm ring-1 ring-white/[0.04]">
        <div className="rounded-[calc(1rem-2px)] border border-white/[0.04] bg-ink-850 p-6">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3"><AppLogo className="h-10 w-10" /></div>
            <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Set New Password</h1>
            <p className="mt-0.5 text-[11px] text-slate-500">Choose a strong password for your account.</p>
          </div>

          {!token && (
            <div className="rounded-lg border border-terminal-red/20 bg-terminal-red/[0.06] p-4 text-center">
              <p className="text-sm text-terminal-red/80">Invalid or missing reset token. Please request a new reset link.</p>
            </div>
          )}

          {token && done && (
            <div className="rounded-lg border border-neon/20 bg-neon/5 p-4 text-center space-y-3">
              <p className="text-sm text-slate-200">Password updated! You can now sign in with your new password.</p>
              <a href="/" className="inline-block text-sm text-neon hover:underline">Go to sign in →</a>
            </div>
          )}

          {token && !done && (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-terminal-red/20 bg-terminal-red/[0.06] p-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-terminal-red" />
                  <p className="text-xs text-terminal-red/80">{error}</p>
                </div>
              )}
              <div>
                <label className="label">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="min 8 characters"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="repeat password"
                  className="input"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
                {loading ? <><Loader className="h-4 w-4 animate-spin" /> Updating...</> : 'Set New Password'}
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-[11px] text-slate-600">
            Need help?{' '}
            <a href="mailto:support@novossh.com" className="text-slate-500 hover:text-neon transition-colors">
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
