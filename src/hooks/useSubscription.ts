import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { fetchSubscription } from '../lib/billingApi';
import { Plan, PlanLimits, PLAN_LIMITS } from '../lib/types';

interface SubscriptionState {
  plan: Plan;
  status: string;
  limits: PlanLimits;
  usage: Record<string, number>;
  loading: boolean;
  canAccess: (feature: keyof PlanLimits) => boolean;
  checkLimit: (resource: 'hosts' | 'snippets' | 'vaults' | 'keys' | 'tabs') => { allowed: boolean; current: number; limit: number };
  isTrialing: boolean;
  trialDaysLeft: number;
}

// Shared, deduped subscription loader.
//
// useSubscription() is called independently by every PaywallGate, the Sidebar, and the
// billing page — each previously fired its own /api/billing/subscription request, and the
// hook refetched on every hosts/snippets/keys/tabs length change. During initial sync that
// burst could trip the billing rate limit (60/min); a single 429 then dropped an instance
// into the free-plan fallback and locked a paying/trialing user out of their own features
// (Pro account seeing "requires a higher plan" on Analytics/P2P).
//
// Caching the last successful response (short TTL) and sharing one in-flight request across
// all callers collapses that burst into a single fetch, and lets a failed instance reuse a
// sibling's good result instead of downgrading to free.
const CACHE_TTL_MS = 15_000;
let subCache: { token: string; data: any; at: number } | null = null;
let subInflight: { token: string; promise: Promise<any> } | null = null;

export function getCachedSubscription(token: string | null | undefined): any | null {
  return token && subCache && subCache.token === token ? subCache.data : null;
}

async function loadSubscriptionShared(token: string): Promise<any> {
  const now = Date.now();
  if (subCache && subCache.token === token && now - subCache.at < CACHE_TTL_MS) {
    return subCache.data;
  }
  if (subInflight && subInflight.token === token) {
    return subInflight.promise;
  }
  const promise = (async () => {
    try {
      const data = await fetchSubscription(token);
      subCache = { token, data, at: Date.now() };
      return data;
    } finally {
      subInflight = null;
    }
  })();
  subInflight = { token, promise };
  return promise;
}

export function useSubscription(): SubscriptionState {
  const { auth, hosts, snippets, keys, forwards, tabs } = useStore();
  const [state, setState] = useState<SubscriptionState>({
    plan: 'free',
    status: 'active',
    limits: PLAN_LIMITS.free,
    usage: {},
    loading: true,
    canAccess: () => false,
    checkLimit: () => ({ allowed: false, current: 0, limit: 0 }),
    isTrialing: false,
    trialDaysLeft: 0,
  });

  const SEED_SNIPPET_IDS = new Set(['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10','s11','s12','s13','s14','s15']);

  const localUsage = {
    hosts: hosts.length,
    snippets: snippets.filter((s) => !SEED_SNIPPET_IDS.has(s.id)).length,
    keys: keys.length,
    forwards: forwards.length,
    tabs: tabs.length,
  };

  useEffect(() => {
    let cancelled = false;
    if (!auth.isAuthenticated || !auth.accessToken) {
      setState(s => ({ ...s, loading: false }));
      return;
    }

    // Seed synchronously from the shared cache so gates render the real plan immediately
    // instead of flashing "locked" (or nothing) while a refresh is in flight.
    const cached = getCachedSubscription(auth.accessToken);
    if (cached) onSuccess(cached);

    const load = async (retriesLeft: number): Promise<void> => {
      try {
        const data = await loadSubscriptionShared(auth.accessToken!);
        onSuccess(data);
      } catch (err) {
        if (cancelled) return;
        if (retriesLeft > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 1500));
          return load(retriesLeft - 1);
        }
        onFailure(err);
      }
    };

    function onSuccess(data: any) {
        if (cancelled) return;
        const plan = (data.plan ?? 'free') as Plan;
        const limits = PLAN_LIMITS[plan];
        const isTrialing = data.status === 'trialing';
        // Prefer the server-computed count (single source of truth shared with the trial
        // banner); only fall back to a client calc if the server didn't send it.
        const trialDaysLeft = typeof data.trialDaysLeft === 'number'
          ? data.trialDaysLeft
          : data.trialEnd
            ? Math.max(0, Math.ceil((new Date(data.trialEnd).getTime() - Date.now()) / 86400000))
            : 0;

        // Merge server usage with local counts (prefer local for accuracy)
        const usage = { ...(data.usage ?? {}), ...localUsage };

        setState({
          plan,
          status: data.status,
          limits,
          usage,
          loading: false,
          canAccess: (feature) => !!limits[feature],
          checkLimit: (resource) => {
            const current = usage[resource] ?? localUsage[resource as keyof typeof localUsage] ?? 0;
            const limit = limits[resource];
            return { allowed: current < limit, current, limit };
          },
          isTrialing,
          trialDaysLeft,
        });
    }

    function onFailure(_err: unknown) {
        if (cancelled) return;
        // A transient failure must NOT downgrade a known plan to free — that would lock a
        // paying/trialing user out of features they're entitled to. If any caller has ever
        // loaded this account's subscription, reuse that last-known-good result. Only fall
        // back to free-plan limits when we have genuinely never loaded a subscription.
        const known = getCachedSubscription(auth.accessToken);
        if (known) { onSuccess(known); return; }

        const usage = localUsage;
        const limits = PLAN_LIMITS.free;
        setState(s => ({
          ...s,
          usage,
          limits,
          loading: false,
          canAccess: (feature) => !!limits[feature],
          checkLimit: (resource) => {
            const current = usage[resource as keyof typeof usage] ?? 0;
            const limit = limits[resource];
            return { allowed: current < limit, current, limit };
          },
        }));
    }

    load(2);

    return () => { cancelled = true; };
  }, [auth.isAuthenticated, auth.accessToken, hosts.length, snippets.length, keys.length, forwards.length, tabs.length]);

  return state;
}
