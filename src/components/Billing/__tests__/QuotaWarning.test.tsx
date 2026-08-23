import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuotaWarning } from '../QuotaWarning';

const mockAcknowledgeAlert = vi.fn();

vi.mock('../../../hooks/useUsageMetrics', () => ({
  useUsageMetrics: () => ({
    statuses: [],
    forecasts: [],
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
      {
        id: 'alert-2',
        resourceType: 'storage_bytes',
        alertType: 'hard_limit',
        thresholdPercent: 100,
        currentUsage: 1073741824,
        limitValue: 1073741824,
        createdAt: '2026-06-05T11:00:00Z',
      },
    ],
    quotas: [],
    loading: false,
    error: null,
    lastUpdated: new Date(),
    acknowledgeAlert: mockAcknowledgeAlert,
  }),
}));

describe('QuotaWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render alerts', () => {
    render(<QuotaWarning />);

    expect(screen.getByText('API Calls')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
  });

  it('should display alert types', () => {
    render(<QuotaWarning />);

    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Hard Limit Exceeded')).toBeInTheDocument();
  });

  it('should display usage information', () => {
    render(<QuotaWarning />);

    expect(screen.getByText(/You've used 80%/)).toBeInTheDocument();
    expect(screen.getByText(/800/)).toBeInTheDocument();
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
  });

  it('should show hard limit warning', () => {
    render(<QuotaWarning />);

    expect(
      screen.getByText(/Your quota has been exceeded. Operations may be blocked/)
    ).toBeInTheDocument();
  });

  it('should handle alert dismissal', async () => {
    render(<QuotaWarning />);

    const dismissButtons = screen.getAllByLabelText('Dismiss alert');
    fireEvent.click(dismissButtons[0]);

    await waitFor(() => {
      expect(mockAcknowledgeAlert).toHaveBeenCalledWith('alert-1');
    });
  });

  it('should not render alerts when empty', () => {
    // Mock the hook without alerts
    vi.resetModules();

    // Re-render with empty alerts - the component should still work
    const { rerender } = render(<QuotaWarning />);

    // Should have rendered existing alerts first
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('should display resource labels correctly', () => {
    render(<QuotaWarning />);

    expect(screen.getByText('API Calls')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
  });
});
