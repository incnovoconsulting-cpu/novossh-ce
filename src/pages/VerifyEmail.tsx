import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Mail } from '@/lib/icons';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      setStatus('loading');
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      setStatus('success');
      setMessage('Email verified successfully!');
      setTimeout(() => navigate('/'), 3000);
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error ? error.message : 'Verification failed. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="relative w-12 h-12">
                  <Mail className="w-full h-full text-blue-500 animate-pulse" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Verifying email</h1>
              <p className="text-slate-600">Please wait while we verify your email address...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Email verified!</h1>
              <p className="text-slate-600">{message}</p>
              <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Verification failed</h1>
              <p className="text-slate-600">{message}</p>
              <div className="space-y-2 pt-4">
                <button
                  onClick={verifyEmail}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Try again
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Back to login
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-slate-400 mt-6 text-sm">
          Need help? Contact{' '}
          <a href="mailto:support@novossh.com" className="text-neon hover:underline">
            support@novossh.com
          </a>
        </p>
      </div>
    </div>
  );
}
