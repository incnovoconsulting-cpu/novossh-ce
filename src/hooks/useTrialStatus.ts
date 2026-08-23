import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../lib/store';
import { fetchTrialStatus, extendTrial } from '../lib/billingApi';

interface TrialStatusState {
  isTrialing: boolean;
  trialEnd: Date | null;
  daysRemaining: number;
  status: string;
  plan: string;
  loading: boolean;
  error: string | null;
  extending: boolean;
  extend: (days: number) => Promise<{ success: boolean; message: string }>;
}

export function useTrialStatus(): TrialStatusState {
  const { auth } = useStore();
  const [state, setState] = useState<TrialStatusState>({
    isTrialing: false,
    trialEnd: null,
    daysRemaining: 0,
    status: 'active',
    plan: 'free',
    loading: true,
    error: null,
    extending: false,
    extend: async () => ({ success: false, message: 'Not initialized' }),
  });

  const loadTrialStatus = useCallback(async () => {
    if (!auth.isAuthenticated || !auth.accessToken) {
      setState(s => ({ ...s, loading: false }));
      return;
    }

    try {
      const data = await fetchTrialStatus(auth.accessToken);
      setState({
        isTrialing: data.isTrialing,
        trialEnd: data.trialEnd ? new Date(data.trialEnd) : null,
        daysRemaining: data.daysRemaining,
        status: data.status,
        plan: data.plan,
        loading: false,
        error: null,
        extending: false,
        extend: async (days: number) => {
          setState(s => ({ ...s, extending: true }));
          try {
            const result = await extendTrial(auth.accessToken!, days);
            if (result.success) {
              await loadTrialStatus();
              return { success: true, message: `Trial extended by ${days} days` };
            }
            return { success: false, message: 'Failed to extend trial' };
          } catch (err) {
            setState(s => ({ ...s, extending: false, error: 'Failed to extend trial' }));
            return { success: false, message: 'Failed to extend trial' };
          }
        },
      });
    } catch (err) {
      setState(s => ({
        ...s,
        loading: false,
        error: 'Failed to load trial status',
        extend: async () => ({ success: false, message: 'Failed to load trial status' }),
      }));
    }
  }, [auth.isAuthenticated, auth.accessToken]);

  useEffect(() => {
    loadTrialStatus();
  }, [loadTrialStatus]);

  return state;
}
