import { useState } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { createCheckoutSession } from '../lib/billingApi';
import { useStore } from '../lib/store';
import { Loader, Check, X } from '@/lib/icons';
import { AppLogo } from './AppLogo';

const plans = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    features: ['3 hosts', '5 snippets', '1 vault', '1 key', '2 tabs'],
    limitations: ['No port forwarding', 'No P2P sync', 'No teams'],
    plan: 'free',
  },
  {
    name: 'Starter',
    monthlyPrice: 4.99,
    annualPrice: 3.33,
    features: ['25 hosts', '50 snippets', '10 vaults', '10 keys', '10 tabs', 'Port forwarding'],
    limitations: ['No P2P sync', 'No teams'],
    plan: 'starter',
    popular: true,
  },
  {
    name: 'Pro',
    monthlyPrice: 9.99,
    annualPrice: 6.67,
    features: ['Unlimited everything', 'Port forwarding', 'P2P sync', 'Teams', 'Session recording', 'Audit logs'],
    limitations: [],
    plan: 'pro',
  },
];

export function PricingPage() {
  const { auth } = useStore();
  const subscription = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');

  const handleUpgrade = async (plan: string) => {
    if (!auth.accessToken) return;
    setLoading(plan);
    try {
      const { url } = await createCheckoutSession(auth.accessToken, plan, billing);
      window.location.href = url;
    } catch (err) {
      console.error('Checkout failed:', err);
      setLoading(null);
    }
  };

  const planOrder = ['free', 'starter', 'pro'];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center">
            <AppLogo className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Choose a plan</h1>
            <p className="mt-0.5 text-xs text-slate-500 font-mono">7-day free trial · cancel anytime</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-ink-900 p-0.5">
          <button
            onClick={() => setBilling('monthly')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
              billing === 'monthly' ? 'bg-white/[0.08] text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
              billing === 'annual' ? 'bg-white/[0.08] text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Annual
            <span className="ml-1 text-[10px] text-terminal-green">-33%</span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1.08fr_1fr]">
        {plans.map((p) => {
          const isCurrent = subscription.plan === p.plan;
          const isDowngrade = planOrder.indexOf(subscription.plan) > planOrder.indexOf(p.plan);
          const price = billing === 'annual' ? p.annualPrice : p.monthlyPrice;
          const period = p.plan === 'free' ? 'forever' : '/mo';

          return (
            <div
              key={p.plan}
              className={`relative rounded-xl border p-5 transition-all duration-150 ${
                p.popular
                  ? 'border-neon/20 bg-ink-800/80 shadow-glow-sm'
                  : 'border-white/[0.04] bg-ink-800/40 hover:border-white/[0.08]'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-neon/20 border border-neon/30 px-2.5 py-0.5 text-[10px] font-medium text-neon">
                  Most popular
                </span>
              )}

              <h2 className="text-sm font-semibold text-slate-200">{p.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-100">${price}</span>
                <span className="text-xs text-slate-500">{period}</span>
              </div>
              {billing === 'annual' && p.plan !== 'free' && (
                <p className="mt-1 text-[10px] text-terminal-green/60 font-mono">
                  ${p.plan === 'starter' ? '39.99' : '79.99'}/yr billed annually
                </p>
              )}

              <ul className="mt-5 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
                    <Check className="h-3 w-3 text-terminal-green flex-shrink-0" />
                    {f}
                  </li>
                ))}
                {p.limitations.map((l) => (
                  <li key={l} className="flex items-center gap-2 text-xs text-slate-600">
                    <X className="h-3 w-3 text-slate-700 flex-shrink-0" />
                    {l}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(p.plan)}
                disabled={isCurrent || isDowngrade || loading !== null}
                className={`mt-5 w-full rounded-lg px-4 py-2 text-xs font-medium transition-all duration-150 ${
                  isCurrent
                    ? 'cursor-default bg-ink-700 text-slate-500'
                    : p.popular
                    ? 'bg-neon text-ink-950 hover:bg-neon-400 hover:shadow-glow active:scale-[0.98]'
                    : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] border border-white/[0.06]'
                }`}
              >
                {loading === p.plan ? (
                  <Loader className="mx-auto h-4 w-4 animate-spin" />
                ) : isCurrent ? (
                  'Current plan'
                ) : isDowngrade ? (
                  'Downgrade'
                ) : p.plan === 'free' ? (
                  'Current plan'
                ) : (
                  'Start 7-day trial'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
