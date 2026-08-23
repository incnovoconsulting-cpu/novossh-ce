import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UsageForecast } from '../UsageForecast';

vi.mock('../../../hooks/useUsageMetrics', () => ({
  useUsageMetrics: () => ({
    statuses: [],
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
      {
        resourceType: 'storage_bytes',
        currentUsage: 500000000,
        dailyAverage: 100000000,
        projectedEndOfMonth: 2000000000,
        confidenceLow: 1700000000,
        confidenceHigh: 2300000000,
        currentDay: 5,
        totalDays: 30,
        usagePercent: 186.2,
        exceedanceRisk: 'very_high',
      },
    ],
    alerts: [],
    quotas: [],
    loading: false,
    error: null,
    lastUpdated: new Date(),
  }),
}));

describe('UsageForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render component', () => {
    render(<UsageForecast />);

    expect(screen.getByText('Usage Forecast')).toBeInTheDocument();
  });

  it('should display forecast cards', async () => {
    render(<UsageForecast />);

    await waitFor(() => {
      expect(screen.getByText('API Calls')).toBeInTheDocument();
      expect(screen.getByText('Storage')).toBeInTheDocument();
    });
  });

  it('should display risk badges', async () => {
    render(<UsageForecast />);

    await waitFor(() => {
      expect(screen.getByText('Low Risk')).toBeInTheDocument();
      expect(screen.getByText(/Very high Risk/)).toBeInTheDocument();
    });
  });

  it('should display days elapsed', async () => {
    render(<UsageForecast />);

    await waitFor(() => {
      expect(screen.getAllByText(/5 \/ 30/).length).toBeGreaterThan(0);
    });
  });

  it('should display current usage', async () => {
    render(<UsageForecast />);

    await waitFor(() => {
      expect(screen.getAllByText(/Current Usage/).length).toBeGreaterThan(0);
    });
  });

  it('should display daily average', async () => {
    render(<UsageForecast />);

    await waitFor(() => {
      expect(screen.getAllByText(/Daily Average/).length).toBeGreaterThan(0);
    });
  });

  it('should display projected end-of-month usage', async () => {
    render(<UsageForecast />);

    await waitFor(() => {
      expect(screen.getAllByText(/Projected End-of-Month/).length).toBeGreaterThan(0);
    });
  });

  it('should display confidence ranges', async () => {
    render(<UsageForecast />);

    await waitFor(() => {
      expect(screen.getAllByText(/Confidence Range:/).length).toBeGreaterThan(0);
    });
  });

  it('should display exceedance warning for high usage', async () => {
    render(<UsageForecast />);

    await waitFor(() => {
      expect(
        screen.getByText(/Your usage is projected to exceed the quota/)
      ).toBeInTheDocument();
    });
  });

  it('should display projected usage percentages', async () => {
    render(<UsageForecast />);

    await waitFor(() => {
      expect(screen.getByText(/75\.0%/)).toBeInTheDocument();
      expect(screen.getByText(/186\.2%/)).toBeInTheDocument();
    });
  });
});
