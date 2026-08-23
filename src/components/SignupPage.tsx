import { useState, FormEvent } from 'react';
import { Loader, AlertCircle, Check, Github } from '@/lib/icons';
import { AppLogo } from './AppLogo';
import { createCheckoutSession } from '../lib/billingApi';

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

type Plan = 'free' | 'starter' | 'pro';
type Billing = 'monthly' | 'annual';

const PLAN_INFO: Record<Plan, Record<Billing, { label: string; price: string; note: string; trial: boolean }>> = {
  free: {
    monthly: { label: 'Free', price: '$0/mo', note: 'No credit card required', trial: false },
    annual:  { label: 'Free', price: '$0/mo', note: 'No credit card required', trial: false },
  },
  starter: {
    monthly: { label: 'Starter', price: '$4.99/mo', note: '7-day free trial · $4.99/mo after · cancel anytime', trial: true },
    annual:  { label: 'Starter', price: '$3.33/mo', note: '7-day free trial · $3.33/mo after, billed annually · cancel anytime', trial: true },
  },
  pro: {
    monthly: { label: 'Pro', price: '$9.99/mo', note: '7-day free trial · $9.99/mo after · cancel anytime', trial: true },
    annual:  { label: 'Pro', price: '$6.67/mo', note: '7-day free trial · $6.67/mo after, billed annually · cancel anytime', trial: true },
  },
};

interface SignupPageProps {
  initialPlan?: Plan;
  onPlanChange?: (plan: Plan) => void;
  onSignupSuccess: (accessToken: string, expiresIn: number, user: any) => void;
  onNeedsEmailVerification?: (email: string, accessToken?: string) => void;
  onSwitchToLogin: () => void;
  onBackToHome?: () => void;
}

export function SignupPage({ initialPlan = 'starter', onPlanChange, onSignupSuccess, onNeedsEmailVerification, onSwitchToLogin, onBackToHome }: SignupPageProps) {
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [billing, setBilling] = useState<Billing>('annual');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  const info = PLAN_INFO[plan][billing];

  const switchPlan = (p: Plan) => {
    setPlan(p);
    onPlanChange?.(p);
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const errs: typeof fieldErrors = {};
    if (!email.trim()) errs.email = 'Email is required';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
    else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      localStorage.setItem('novossh-auth', JSON.stringify({
        accessToken: data.accessToken,
        expiresIn: data.expiresIn,
        expiresAt: Date.now() + data.expiresIn * 1000,
      }));

      if (plan !== 'free') {
        try {
          const { url } = await createCheckoutSession(data.accessToken, plan, billing);
          window.location.href = url;
          return;
        } catch {
          // Stripe not configured — fall through
        }
      }

      // Email signup always requires verification before accessing the dashboard
      if (onNeedsEmailVerification) {
        onNeedsEmailVerification(email, data.accessToken);
      } else {
        onSignupSuccess(data.accessToken, data.expiresIn, data.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-ink-950 px-4 py-8">
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
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3">
            <AppLogo className="h-10 w-10" />
          </div>
          <h1 className="text-lg font-semibold text-slate-100 tracking-tight">Create account</h1>
        </div>

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

        {/* Plan selector */}
        <div className="mb-5 rounded-lg border border-white/[0.06] bg-ink-900/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-widest text-slate-500">Plan</span>
            <div className="flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-ink-900 p-0.5">
              <button
                type="button"
                onClick={() => setBilling('monthly')}
                className={`rounded-full px-2 py-1 text-[10px] font-medium transition-all duration-150 ${
                  billing === 'monthly' ? 'bg-white/[0.08] text-slate-200' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling('annual')}
                className={`rounded-full px-2 py-1 text-[10px] font-medium transition-all duration-150 ${
                  billing === 'annual' ? 'bg-white/[0.08] text-slate-200' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Annual
                <span className="ml-1 text-[9px] text-terminal-green">-33%</span>
              </button>
            </div>
          </div>
          <div className="flex gap-1">
            {(['free', 'starter', 'pro'] as Plan[]).map((p) => (
              <button
                key={p}
                onClick={() => switchPlan(p)}
                className={`flex-1 rounded-md py-1.5 text-[12px] font-medium transition-all capitalize ${
                  plan === p
                    ? 'bg-neon/15 text-neon border border-neon/30'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex items-start gap-2">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-neon" />
            <p className="text-[11px] font-sans text-slate-400">{info.note}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-terminal-red/20 bg-terminal-red/[0.06] p-3">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-terminal-red" />
            <p className="text-xs text-terminal-red/80">{error}</p>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-3">
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
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })); }}
              placeholder="at least 8 characters"
              className={`input ${fieldErrors.password ? 'border-terminal-red/60 focus:border-terminal-red' : ''}`}
              disabled={loading}
            />
            {fieldErrors.password && <p className="mt-1 text-[10px] text-terminal-red">{fieldErrors.password}</p>}
          </div>

          <div>
            <label className="label">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
              placeholder="repeat password"
              className={`input ${fieldErrors.confirmPassword ? 'border-terminal-red/60 focus:border-terminal-red' : ''}`}
              disabled={loading}
            />
            {fieldErrors.confirmPassword && <p className="mt-1 text-[10px] text-terminal-red">{fieldErrors.confirmPassword}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
            {loading ? (
              <><Loader className="h-4 w-4 animate-spin" /> Creating account...</>
            ) : info.trial ? (
              'Start free trial'
            ) : (
              'Get started'
            )}
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <button onClick={onSwitchToLogin} className="text-neon/70 hover:text-neon transition-colors">
            Log in
          </button>
        </p>
      </div>
      </div>
    </div>
  );
}

export default SignupPage;
