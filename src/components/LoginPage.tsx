import { useState, FormEvent } from 'react';
import { Loader, AlertCircle, Github, Smartphone } from '@/lib/icons';
import { AppLogo } from './AppLogo';
import { useMFA } from '../hooks/useMFA';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

interface LoginPageProps {
  onLoginSuccess: (accessToken: string, expiresIn: number, user: any) => void;
  onSwitchToSignup?: () => void;
  onBackToHome?: () => void;
}

export function LoginPage({ onLoginSuccess, onSwitchToSignup, onBackToHome }: LoginPageProps) {
  const mfa = useMFA();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = 'Email is required';
    if (!password) errs.password = 'Password is required';

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('');
      return;
    }

    setFieldErrors({});
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Login failed');
      }

      const data = await response.json();

      if (data.mfaRequired) {
        setMfaUserId(data.userId);
        return;
      }

      localStorage.setItem('novossh-auth', JSON.stringify({
        accessToken: data.accessToken,
        expiresIn: data.expiresIn,
        expiresAt: Date.now() + data.expiresIn * 1000,
      }));

      onLoginSuccess(data.accessToken, data.expiresIn, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    if (!mfaUserId) return;
    setMfaVerifying(true);
    setError('');
    try {
      const assertion = await mfa.startAuth(mfaUserId);
      const response = await fetch(`${API_BASE}/api/auth/login/verify-mfa`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'MFA verification failed');
      }

      const data = await response.json();
      localStorage.setItem('novossh-auth', JSON.stringify({
        accessToken: data.accessToken,
        expiresIn: data.expiresIn,
        expiresAt: Date.now() + data.expiresIn * 1000,
      }));

      onLoginSuccess(data.accessToken, data.expiresIn, data.user);
    } catch (err: any) {
      setError(err?.name === 'NotAllowedError' ? 'Verification was cancelled.' : (err instanceof Error ? err.message : 'MFA verification failed'));
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      setForgotSent(true);
    } catch {
      setForgotSent(true); // still show success to avoid email enumeration
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center bg-ink-950 px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,229,255,0.06),transparent)]" />
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
      {/* Double-bezel card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-ink-900/80 p-1.5 shadow-modal backdrop-blur-sm ring-1 ring-white/[0.04]">
      <div className="rounded-[calc(1rem-2px)] border border-white/[0.04] bg-ink-850 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
        {onBackToHome && (
          <button onClick={onBackToHome} className="mb-4 text-[12px] text-slate-500 hover:text-slate-300 transition-colors">
            ← Back to home
          </button>
        )}

        {mfaUserId ? (
          <>
            <div className="mb-5 text-center">
              <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Two-Factor Authentication</h1>
              <p className="mt-1 text-[12px] text-slate-500">Verify your identity to continue.</p>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-terminal-red/20 bg-terminal-red/[0.06] p-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-terminal-red" />
                <p className="text-xs text-terminal-red/80">{error}</p>
              </div>
            )}

            <button
              onClick={handleMfaVerify}
              disabled={mfaVerifying}
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              {mfaVerifying ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" /> Waiting for device...
                </>
              ) : (
                <>
                  <Smartphone className="h-4 w-4" /> Verify with Security Key
                </>
              )}
            </button>

            <button
              onClick={() => { setMfaUserId(null); setError(''); setPassword(''); }}
              className="mt-4 w-full text-center text-[12px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Use a different account
            </button>
          </>
        ) : showForgot ? (
          <>
            <div className="mb-5 text-center">
              <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Reset Password</h1>
              <p className="mt-1 text-[12px] text-slate-500">Enter your email and we'll send a reset link.</p>
            </div>
            {forgotSent ? (
              <div className="rounded-lg border border-neon/20 bg-neon/5 p-4 text-center">
                <p className="text-sm text-slate-300">
                  If <span className="text-neon">{forgotEmail}</span> has an account, a reset link will be sent shortly.
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  Didn't receive it? Email{' '}
                  <a href="mailto:support@novossh.com" className="text-neon/70 hover:text-neon">
                    support@novossh.com
                  </a>
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-3">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary w-full">Send reset link</button>
              </form>
            )}
            <button
              onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
              className="mt-4 w-full text-center text-[12px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              ← Back to log in
            </button>
          </>
        ) : (
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3">
                <AppLogo className="h-10 w-10" />
              </div>
              <h1 className="text-lg font-semibold text-slate-100 tracking-tight">NovoSSH</h1>
              <p className="mt-0.5 text-[11px] text-slate-500">secure terminal client</p>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-terminal-red/20 bg-terminal-red/[0.06] p-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-terminal-red" />
                <p className="text-xs text-terminal-red/80">{error}</p>
              </div>
            )}

            {/* OAuth buttons */}
            <div className="mb-4 flex flex-col gap-2">
              <a
                href={`${API_BASE}/api/auth/oauth/github`}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.10] bg-white/5 py-2.5 text-sm text-slate-200 hover:bg-white/10 transition-all"
              >
                <Github className="h-4 w-4" /> Continue with GitHub
              </a>
              <a
                href={`${API_BASE}/api/auth/oauth/google`}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.10] bg-white/5 py-2.5 text-sm text-slate-200 hover:bg-white/10 transition-all"
              >
                <GoogleIcon /> Continue with Google
              </a>
            </div>
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.06]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-ink-800/80 px-3 text-[11px] text-slate-500">or with email</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined })); }}
                  placeholder="you@example.com"
                  className={`input ${fieldErrors.email ? 'border-terminal-red/60 focus:border-terminal-red' : ''}`}
                  disabled={loading}
                />
                {fieldErrors.email && <p className="mt-1 text-[10px] text-terminal-red">{fieldErrors.email}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label" style={{ margin: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-[11px] text-slate-500 hover:text-neon transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  placeholder="your password"
                  className={`input ${fieldErrors.password ? 'border-terminal-red/60 focus:border-terminal-red' : ''}`}
                  disabled={loading}
                />
                {fieldErrors.password && <p className="mt-1 text-[10px] text-terminal-red">{fieldErrors.password}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Log in'
                )}
              </button>
            </form>

            {onSwitchToSignup && (
              <p className="mt-4 text-center text-xs text-slate-500">
                No account?{' '}
                <button onClick={onSwitchToSignup} className="text-neon/70 hover:text-neon transition-colors">
                  Sign up free
                </button>
              </p>
            )}
            <p className="mt-3 text-center text-[11px] text-slate-600">
              Need help?{' '}
              <a href="mailto:support@novossh.com" className="text-slate-500 hover:text-neon transition-colors">
                Contact Support
              </a>
            </p>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

export default LoginPage;
