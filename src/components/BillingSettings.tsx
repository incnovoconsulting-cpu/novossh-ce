import { useSubscription } from '../hooks/useSubscription';
import { createPortalSession } from '../lib/billingApi';
import { useStore } from '../lib/store';
import { Loader } from '@/lib/icons';
import { useState } from 'react';

export function BillingSettings() {
  const { auth } = useStore();
  const subscription = useSubscription();
  const [loading, setLoading] = useState(false);

  const handleManageBilling = async () => {
    if (!auth.accessToken) return;
    setLoading(true);
    try {
      const { url } = await createPortalSession(auth.accessToken);
      window.location.href = url;
    } catch (err: any) {
      console.error('Failed to open billing portal:', err);
      alert(err?.message || 'Failed to open billing portal. Apple/Google IAP subscriptions are managed through the App Store / Play Store.');
      setLoading(false);
    }
  };

  if (subscription.loading) return null;

  return (
    <section className="rounded-lg border border-white/10 bg-ink-800 p-4">
      <h3 className="mb-4 text-lg font-semibold text-white">Billing</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Current plan</span>
          <span className="text-sm font-medium text-white capitalize">{subscription.plan}</span>
        </div>

        {subscription.isTrialing && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Trial</span>
            <span className="text-sm text-yellow-400">{subscription.trialDaysLeft} days left</span>
          </div>
        )}

        <div className="border-t border-white/10 pt-3">
          <h4 className="mb-2 text-sm font-medium text-slate-300">Usage</h4>
          {(['hosts', 'snippets', 'vaults', 'keys', 'tabs'] as const).map((resource) => {
            const { current, limit } = subscription.checkLimit(resource);
            return (
              <div key={resource} className="flex items-center justify-between py-1">
                <span className="text-sm capitalize text-slate-400">{resource}</span>
                <span className="text-sm text-slate-300">
                  {current} / {limit >= 999999 ? '\u221e' : limit}
                </span>
              </div>
            );
          })}
        </div>

        {subscription.plan !== 'free' && (
          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="btn-secondary w-full"
          >
            {loading ? (
              <Loader className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              'Manage billing'
            )}
          </button>
        )}

        <button
          onClick={() => useStore.getState().setView('portal')}
          className="btn-ghost w-full text-sm"
        >
          View invoices &amp; payment methods
        </button>
      </div>
    </section>
  );
}
