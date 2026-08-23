import { ReactNode } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { useStore } from '../lib/store';
import { PlanLimits } from '../lib/types';
import { Lock } from '@/lib/icons';

interface PaywallGateProps {
  feature: keyof PlanLimits;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PaywallGate({ feature, children, fallback }: PaywallGateProps) {
  const { canAccess, loading, plan: _plan } = useSubscription();
  const setView = useStore((s) => s.setView);
  const setSettingsTab = useStore((s) => s.setSettingsTab);

  if (loading) return null;

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-ink-800/50 p-8 text-center">
      <Lock className="h-8 w-8 text-slate-500" />
      <p className="text-sm text-slate-400">
        This feature requires a higher plan.
      </p>
      <button
        onClick={() => { setView('settings'); setSettingsTab('subscription'); }}
        className="rounded-lg bg-neon px-4 py-2 text-sm font-medium text-white hover:bg-neon-600"
      >
        Upgrade Plan
      </button>
    </div>
  );
}
