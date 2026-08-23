import { useEffect, useState, useCallback, lazy, Suspense, Component } from 'react';
import { useStore } from '../lib/store';
import { VaultKeyProvider } from '../contexts/VaultKeyContext';
import { PostHogProvider } from './PostHogProvider';
import { Loader, Mail, CheckCircle2, AlertCircle } from '@/lib/icons';

const LoginPage = lazy(() => import('./LoginPage'));
const SignupPage = lazy(() => import('./SignupPage'));
const LandingPage = lazy(() => import('./LandingPage'));
const App = lazy(() => import('../App'));
const NetworkSetup = lazy(() => import('./NetworkSetup'));

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type Plan = 'free' | 'starter' | 'pro';
type AuthView = 'landing' | 'login' | 'signup' | 'verify-pending' | 'verify-processing' | 'network-setup';

const Spinner = () => (
  <div className="flex h-screen items-center justify-center bg-ink-950">
    <div className="h-8 w-8 border-2 border-neon border-t-transparent rounded-full animate-spin" />
  </div>
);

class ChunkErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-ink-950 text-center">
          <p className="text-sm text-slate-300">Page updated — reload to continue.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-neon px-5 py-2 text-sm font-semibold text-ink-950 hover:bg-neon-400"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function VerifyPendingScreen({ email, accessToken, onBackToLogin }: { email: string; accessToken?: string; onBackToLogin: () => void }) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState('');

  const handleResend = async () => {
    setResending(true);
    setResendError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resend');
      }
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-ink-950 px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,229,255,0.06),transparent)]" />
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-ink-900/80 p-1.5 shadow-modal backdrop-blur-sm ring-1 ring-white/[0.04]">
        <div className="rounded-[calc(1rem-2px)] border border-white/[0.04] bg-ink-850 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
          <div className="mb-6 flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neon/10">
              <Mail className="h-7 w-7 text-neon" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">Check your email</h1>
              <p className="mt-1.5 text-sm text-slate-400">
                We sent a verification link to
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-200">{email}</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-ink-900/60 p-4 text-center text-xs text-slate-400 leading-relaxed">
            Click the link in the email to verify your account and access the dashboard.
            The link expires in 24 hours.
          </div>

          {resent && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/[0.06] p-3">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
              <p className="text-xs text-green-400">Verification email resent.</p>
            </div>
          )}

          {resendError && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-terminal-red/20 bg-terminal-red/[0.06] p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-terminal-red" />
              <p className="text-xs text-terminal-red/80">{resendError}</p>
            </div>
          )}

          <div className="mt-5 space-y-2">
            <button
              onClick={handleResend}
              disabled={resending}
              className="btn-primary w-full"
            >
              {resending ? (
                <><Loader className="h-4 w-4 animate-spin" /> Resending...</>
              ) : (
                'Resend verification email'
              )}
            </button>
            <button
              onClick={onBackToLogin}
              className="w-full rounded-lg py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerifyProcessingScreen({ token, onDone }: { token: string; onDone: (success: boolean) => void }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Verification failed');
        }
        setStatus('success');
        setMessage('Email verified! Redirecting...');
        setTimeout(() => {
          window.history.replaceState({}, '', '/');
          onDone(true);
        }, 1500);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      }
    })();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-950 px-4">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader className="mx-auto h-8 w-8 animate-spin text-neon" />
            <p className="text-sm text-slate-400">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-400" />
            <p className="text-sm text-slate-200">{message}</p>
          </>
        )}
        {status === 'error' && (
          <div className="max-w-sm space-y-4">
            <AlertCircle className="mx-auto h-10 w-10 text-terminal-red" />
            <p className="text-sm text-terminal-red/80">{message}</p>
            <button
              onClick={() => { window.history.replaceState({}, '', '/'); onDone(false); }}
              className="btn-primary mx-auto"
            >
              Back to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AuthGuard() {
  const { auth, setAuth, setOwnerStatus } = useStore((s) => ({
    auth: s.auth,
    setAuth: s.setAuth,
    setOwnerStatus: s.setOwnerStatus,
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [authView, setAuthView] = useState<AuthView>('landing');
  const [signupPlan, setSignupPlan] = useState<Plan>('starter');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationAccessToken, setVerificationAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState<string | null>(null);

  const tryRefreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem('novossh-auth', JSON.stringify({
          accessToken: data.accessToken,
          expiresIn: data.expiresIn,
          expiresAt: Date.now() + data.expiresIn * 1000,
        }));
        setAuth({
          accessToken: data.accessToken,
          expiresIn: data.expiresIn,
          user: null,
          tailscaleServerAddress: null,
          isAuthenticated: true,
          subscription: null,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [setAuth]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('oauth_token');
    const oauthExpires = parseInt(params.get('oauth_expires') || '3600', 10);
    const oauthError = params.get('oauth_error');
    const emailVerifyToken = params.get('token');
    const isVerifyPath = window.location.pathname === '/verify-email';
    const isNetworkSetup = window.location.pathname === '/network-setup';

    // Handle network setup page — render before auth check
    if (isNetworkSetup) {
      setAuthView('network-setup');
      setIsLoading(false);
      return;
    }

    // Handle email verification link click
    if (emailVerifyToken && isVerifyPath) {
      setVerifyToken(emailVerifyToken);
      setAuthView('verify-processing');
      setIsLoading(false);
      return;
    }

    if (oauthToken || oauthError) {
      window.history.replaceState({}, '', '/');
    }
    if (oauthToken) {
      localStorage.setItem('novossh-auth', JSON.stringify({
        accessToken: oauthToken,
        expiresIn: oauthExpires,
        expiresAt: Date.now() + oauthExpires * 1000,
      }));
      setAuth({ accessToken: oauthToken, expiresIn: oauthExpires, user: null, tailscaleServerAddress: null, isAuthenticated: true, subscription: null });
      setIsLoading(false);
      return;
    }
    // oauthError: fall through to show landing page (error shown by URL param absence)
  }, [setAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const authStr = localStorage.getItem('novossh-auth');
    if (authStr) {
      try {
        const stored = JSON.parse(authStr);
        const now = Date.now();
        const isExpired = stored.expiresAt && stored.expiresAt < now;

        if (!isExpired && stored.accessToken) {
          setAuth({
            accessToken: stored.accessToken,
            expiresIn: stored.expiresIn || 0,
            user: null,
            tailscaleServerAddress: null,
            isAuthenticated: true,
            subscription: null,
          });
          setIsLoading(false);
          return;
        }

        if (stored.expiresAt) {
          tryRefreshToken().then((refreshed) => {
            if (!refreshed) localStorage.removeItem('novossh-auth');
            setIsLoading(false);
          });
          return;
        }
      } catch {
        localStorage.removeItem('novossh-auth');
      }
    }
    setIsLoading(false);
  }, [setAuth, tryRefreshToken]);

  // Check owner status on authentication
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const token = auth.accessToken;
    if (!token) return;
    fetch(`${API_BASE}/api/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then(r => r.json())
      .then(data => {
        if (data.isOwner) setOwnerStatus(true);
      })
      .catch(() => {});
  }, [auth.isAuthenticated, auth.accessToken, setOwnerStatus]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-ink-950">
        <div className="flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Email verification link processing
  if (authView === 'verify-processing' && verifyToken) {
    return (
      <VerifyProcessingScreen
        token={verifyToken}
        onDone={() => {
          setVerifyToken(null);
          setAuthView('login');
        }}
      />
    );
  }

  // Network setup page (accessible before or after login)
  if (authView === 'network-setup') {
    return (
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-ink-950"><div className="h-8 w-8 border-2 border-neon border-t-transparent rounded-full animate-spin" /></div>}>
        <NetworkSetup />
      </Suspense>
    );
  }

  if (!auth.isAuthenticated) {
    const authSuccess = (accessToken: string, expiresIn: number, user: any) => {
      setAuth({
        accessToken,
        expiresIn,
        user,
        tailscaleServerAddress: null,
        isAuthenticated: true,
        subscription: null,
      });
    };

    const goToSignup = (plan: Plan = 'starter') => {
      setSignupPlan(plan);
      setAuthView('signup');
    };

    if (authView === 'verify-pending') {
      return (
        <VerifyPendingScreen
          email={verificationEmail}
          accessToken={verificationAccessToken}
          onBackToLogin={() => setAuthView('login')}
        />
      );
    }

    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<Spinner />}>
          {authView === 'signup' ? (
            <SignupPage
              initialPlan={signupPlan}
              onPlanChange={(p) => setSignupPlan(p)}
              onSignupSuccess={authSuccess}
              onNeedsEmailVerification={(email, token) => {
                setVerificationEmail(email);
                setVerificationAccessToken(token || '');
                setAuthView('verify-pending');
              }}
              onSwitchToLogin={() => setAuthView('login')}
              onBackToHome={() => setAuthView('landing')}
            />
          ) : authView === 'login' ? (
            <LoginPage
              onLoginSuccess={authSuccess}
              onSwitchToSignup={() => goToSignup('starter')}
              onBackToHome={() => setAuthView('landing')}
            />
          ) : (
            <LandingPage
              onLogin={() => setAuthView('login')}
              onSignup={goToSignup}
            />
          )}
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<Spinner />}>
        <PostHogProvider>
          <VaultKeyProvider>
            <App />
          </VaultKeyProvider>
        </PostHogProvider>
      </Suspense>
    </ChunkErrorBoundary>
  );
}

export default AuthGuard;
