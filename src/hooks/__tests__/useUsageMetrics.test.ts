import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUsageMetrics } from '../useUsageMetrics';

describe('useUsageMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');

    // Mock fetch
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/usage/current')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              statuses: [
                {
                  resourceType: 'api_calls',
                  currentUsage: 150,
                  hardLimit: 1000,
                  softLimitWarning: 800,
                  softLimitCritical: 950,
                  usagePercent: 15.0,
                  exceeded: false,
                  status: 'ok',
                  periodStart: '2026-06-01T00:00:00Z',
                  periodEnd: '2026-06-30T23:59:59Z',
                },
              ],
            }),
        });
      }
      if (url.includes('/usage/forecast')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              forecasts: [
                {
                  resourceType: 'api_calls',
                  currentUsage: 150,
                  dailyAverage: 30,
                  projectedEndOfMonth: 750,
                  confidenceLow: 600,
                  confidenceHigh: 900,
                  currentDay: 5,
                  totalDays: 30,
                  usagePercent: 75.0,
                  exceedanceRisk: 'low',
                },
              ],
            }),
        });
      }
      if (url.includes('/usage/alerts')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              alerts: [
                {
                  id: 'alert-1',
                  resourceType: 'api_calls',
                  alertType: 'soft_warning',
                  thresholdPercent: 80,
                  currentUsage: 800,
                  limitValue: 1000,
                  createdAt: '2026-06-05T10:00:00Z',
                },
              ],
            }),
        });
      }
      if (url.includes('/usage/quotas')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              plan: 'starter',
              quotas: [
                {
                  resource: 'api_calls',
                  hardLimit: 1000,
                  softLimitWarning: 800,
                  softLimitCritical: 950,
                  period: 'monthly',
                },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useUsageMetrics());

    expect(result.current.statuses).toEqual([]);
    expect(result.current.forecasts).toEqual([]);
    expect(result.current.alerts).toEqual([]);
    expect(result.current.quotas).toEqual([]);
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('should fetch metrics on mount', async () => {
    const { result } = renderHook(() => useUsageMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.statuses).toHaveLength(1);
    expect(result.current.statuses[0].resourceType).toBe('api_calls');
    expect(result.current.statuses[0].currentUsage).toBe(150);
  });

  it('should fetch forecasts', async () => {
    const { result } = renderHook(() => useUsageMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.forecasts).toHaveLength(1);
    expect(result.current.forecasts[0].resourceType).toBe('api_calls');
    expect(result.current.forecasts[0].projectedEndOfMonth).toBe(750);
  });

  it('should fetch alerts', async () => {
    const { result } = renderHook(() => useUsageMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].alertType).toBe('soft_warning');
  });

  it('should fetch quotas', async () => {
    const { result } = renderHook(() => useUsageMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.quotas).toHaveLength(1);
    expect(result.current.quotas[0].resource).toBe('api_calls');
  });

  it('should update lastUpdated timestamp', async () => {
    const { result } = renderHook(() => useUsageMetrics());

    expect(result.current.lastUpdated).toBe(null);

    await waitFor(() => {
      expect(result.current.lastUpdated).not.toBe(null);
    });
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      })
    );

    const { result } = renderHook(() => useUsageMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBe(null);
  });

  it('should acknowledge alerts', async () => {
    const { result } = renderHook(() => useUsageMetrics());

    await waitFor(() => {
      expect(result.current.alerts).toHaveLength(1);
    });

    await result.current.acknowledgeAlert('alert-1');

    // After acknowledgement, fetch should be called again
    expect(global.fetch).toHaveBeenCalled();
  });

  it('should manually refresh metrics', async () => {
    const { result } = renderHook(() => useUsageMetrics());

    const initialCallCount = (global.fetch as any).mock.calls.length;

    await result.current.fetchMetrics();

    expect((global.fetch as any).mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it('should handle missing token gracefully', () => {
    localStorage.removeItem('token');

    const { result } = renderHook(() => useUsageMetrics());

    // Should not error, fetch will be called with undefined token
    expect(result.current).toBeDefined();
  });
});
