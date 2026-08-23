import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UsageMetrics } from '../UsageMetrics';

vi.mock('../../../hooks/useUsageMetrics', () => ({
  useUsageMetrics: () => ({
    statuses: [
      {
        resourceType: 'api_calls',
        currentUsage: 500,
        hardLimit: 1000,
        softLimitWarning: 800,
        softLimitCritical: 950,
        usagePercent: 50.0,
        exceeded: false,
        status: 'ok',
        periodStart: '2026-06-01T00:00:00Z',
        periodEnd: '2026-06-30T23:59:59Z',
      },
      {
        resourceType: 'storage_bytes',
        currentUsage: 500000000,
        hardLimit: 1073741824,
        softLimitWarning: 858993459,
        softLimitCritical: 1020054732,
        usagePercent: 46.6,
        exceeded: false,
        status: 'ok',
        periodStart: '2026-06-01T00:00:00Z',
        periodEnd: '2026-06-30T23:59:59Z',
      },
    ],
    forecasts: [],
    alerts: [],
    quotas: [],
    loading: false,
    error: null,
    lastUpdated: new Date('2026-06-09T12:00:00Z'),
  }),
}));

describe('UsageMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render component', () => {
    render(<UsageMetrics />);

    expect(screen.getByText('Resource Usage')).toBeInTheDocument();
  });

  it('should display last updated time', () => {
    render(<UsageMetrics />);

    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('should render all quota metrics', async () => {
    render(<UsageMetrics />);

    await waitFor(() => {
      expect(screen.getByText('API Calls')).toBeInTheDocument();
      expect(screen.getByText('Storage')).toBeInTheDocument();
    });
  });

  it('should display current usage and limits', async () => {
    render(<UsageMetrics />);

    await waitFor(() => {
      expect(screen.getByText(/500/)).toBeInTheDocument();
      expect(screen.getByText(/1,000/)).toBeInTheDocument();
    });
  });

  it('should display usage percentage', async () => {
    render(<UsageMetrics />);

    await waitFor(() => {
      expect(screen.getByText(/50\.0%/)).toBeInTheDocument();
    });
  });

  it('should display status badges', async () => {
    render(<UsageMetrics />);

    await waitFor(() => {
      const badges = screen.getAllByText('OK');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('should display billing period', async () => {
    render(<UsageMetrics />);

    await waitFor(() => {
      expect(screen.getAllByText(/Billing Period:/).length).toBeGreaterThan(0);
    });
  });
});
