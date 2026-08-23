import { useState, useEffect } from 'react';
import { useStore } from '../lib/store';

export default function NetworkSetup() {
  const [status, setStatus] = useState<'waiting' | 'sending' | 'done' | 'error'>('waiting');
  const [message, setMessage] = useState('');
  const auth = useStore((s) => s.auth);

  useEffect(() => {
    // Get the callback port from URL params
    const params = new URLSearchParams(window.location.hash.split('?')[1] || window.location.search);
    const port = params.get('port') || '19876';

    if (auth.isAuthenticated && auth.accessToken) {
      // Auto-send token to local installer
      setStatus('sending');
      setMessage('Sending token to Network Client installer...');

      fetch(`http://localhost:${port}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: auth.accessToken }),
      })
        .then((res) => {
          if (res.ok) {
            setStatus('done');
            setMessage('Token sent! The installer will connect you to the NovoSSH network.');
          } else {
            setStatus('error');
            setMessage('Failed to send token to installer. Check that the installer is still running.');
          }
        })
        .catch(() => {
          setStatus('error');
          setMessage('Could not reach the installer. Make sure it is still running on port ' + port + '.');
        });
    }
  }, [auth.isAuthenticated, auth.accessToken]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-4">
      <div className="w-full max-w-md rounded-xl border border-white/[0.06] bg-ink-900 p-8 text-center">
        <div className="mb-4 text-3xl">🔐</div>
        <h1 className="mb-2 text-xl font-bold text-white">Network Setup</h1>

        {status === 'waiting' && (
          <p className="text-sm text-slate-400">
            Please log in to your NovoSSH account. Once authenticated, your token will be sent automatically to the Network Client installer.
          </p>
        )}

        {status === 'sending' && (
          <div className="mt-4">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#00e5ff] border-t-transparent" />
            <p className="text-sm text-slate-400">{message}</p>
          </div>
        )}

        {status === 'done' && (
          <div className="mt-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400">✓</div>
            <p className="text-sm text-green-400">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400">✗</div>
            <p className="text-sm text-red-400">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
