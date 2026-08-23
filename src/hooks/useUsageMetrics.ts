import { useState, useEffect, useCallback } from 'react';

export interface QuotaStatus {
  resourceType: string;
  currentUsage: number;
  hardLimit: number;
  softLimitWarning: number;
  softLimitCritical: number;
  usagePercent: number;
  exceeded: boolean;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
  periodStart: string;
  periodEnd: string;
}

export interface UsageForecast {
  resourceType: string;
  currentUsage: number;
  dailyAverage: number;
  projectedEndOfMonth: number;
  confidenceLow: number;
  confidenceHigh: number;
  currentDay: number;
  totalDays: number;
  usagePercent: number;
  exceedanceRisk: 'low' | 'medium' | 'high' | 'very_high';
}

export interface QuotaAlert {
  id: string;
  resourceType: string;
  alertType: 'soft_warning' | 'critical' | 'hard_limit';
  thresholdPercent: number;
  currentUsage: number;
  limitValue: number;
  createdAt: string;
}

export interface QuotaConfig {
  resource: string;
  hardLimit: number;
  softLimitWarning: number;
  softLimitCritical: number;
  period: string;
}

interface UsageMetricsState {
  statuses: QuotaStatus[];
  forecasts: UsageForecast[];
  alerts: QuotaAlert[];
  quotas: QuotaConfig[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

/**
 * React hook for managing usage metrics and quotas
 * Auto-refreshes every 30 seconds
 */
export function useUsageMetrics() {
  const [state, setState] = useState<UsageMetricsState>({
    statuses: [],
    forecasts: [],
    alerts: [],
    quotas: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const apiUrl = process.env.VITE_API_URL || 'http://localhost:8787';

  const fetchMetrics = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Fetch current usage
      const usageRes = await fetch(`${apiUrl}/api/billing/usage/current`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!usageRes.ok) throw new Error('Failed to fetch usage');
      const usageData = await usageRes.json();

      // Fetch forecasts
      const forecastRes = await fetch(`${apiUrl}/api/billing/usage/forecast`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const forecastData = forecastRes.ok ? await forecastRes.json() : { forecasts: [] };

      // Fetch alerts
      const alertRes = await fetch(`${apiUrl}/api/billing/usage/alerts`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const alertData = alertRes.ok ? await alertRes.json() : { alerts: [] };

      // Fetch quota config
      const quotaRes = await fetch(`${apiUrl}/api/billing/usage/quotas`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const quotaData = quotaRes.ok ? await quotaRes.json() : { quotas: [] };

      setState((prev) => ({
        ...prev,
        statuses: usageData.statuses || [],
        forecasts: forecastData.forecasts || [],
        alerts: alertData.alerts || [],
        quotas: quotaData.quotas || [],
        loading: false,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      console.error('[useUsageMetrics] Failed to fetch metrics:', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
      }));
    }
  }, [apiUrl]);

  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      try {
        const res = await fetch(`${apiUrl}/api/billing/usage/alerts/${alertId}/acknowledge`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });

        if (!res.ok) throw new Error('Failed to acknowledge alert');

        // Refresh alerts
        const alertRes = await fetch(`${apiUrl}/api/billing/usage/alerts`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const alertData = alertRes.ok ? await alertRes.json() : { alerts: [] };

        setState((prev) => ({
          ...prev,
          alerts: alertData.alerts || [],
        }));
      } catch (error) {
        console.error('[useUsageMetrics] Failed to acknowledge alert:', error);
      }
    },
    [apiUrl]
  );

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return {
    ...state,
    fetchMetrics,
    acknowledgeAlert,
  };
}
