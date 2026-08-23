import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyncProgressPanel } from '../Sync/SyncProgressPanel';

describe('SyncProgressPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Progress Bar', () => {
    it('should render progress bar at correct width', () => {
      const { container } = render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="syncing"
        />
      );

      const progressFill = container.querySelector('[role="progressbar"]') as HTMLElement;
      expect(progressFill).toHaveStyle('width: 50%');
    });

    it('should update progress bar width when progress changes', () => {
      const { container, rerender } = render(
        <SyncProgressPanel
          progress={25}
          syncedCount={25}
          totalCount={100}
          status="syncing"
        />
      );

      let progressFill = container.querySelector('[role="progressbar"]') as HTMLElement;
      expect(progressFill).toHaveStyle('width: 25%');

      rerender(
        <SyncProgressPanel
          progress={75}
          syncedCount={75}
          totalCount={100}
          status="syncing"
        />
      );

      progressFill = container.querySelector('[role="progressbar"]') as HTMLElement;
      expect(progressFill).toHaveStyle('width: 75%');
    });

    it('should cap progress bar at 100%', () => {
      const { container } = render(
        <SyncProgressPanel
          progress={150}
          syncedCount={150}
          totalCount={100}
          status="syncing"
        />
      );

      const progressFill = container.querySelector('[role="progressbar"]') as HTMLElement;
      expect(progressFill).toHaveStyle('width: 100%');
    });

    it('should have aria attributes on progress bar', () => {
      const { container } = render(
        <SyncProgressPanel
          progress={45}
          syncedCount={45}
          totalCount={100}
          status="syncing"
        />
      );

      const progressBar = container.querySelector('[role="progressbar"]') as HTMLElement;
      expect(progressBar).toHaveAttribute('aria-valuenow', '45');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('Count Display', () => {
    it('should show synced/total count', () => {
      render(
        <SyncProgressPanel
          progress={40}
          syncedCount={40}
          totalCount={100}
          status="syncing"
        />
      );

      expect(screen.getByText('40 / 100')).toBeInTheDocument();
    });

    it('should update count display', () => {
      const { rerender } = render(
        <SyncProgressPanel
          progress={10}
          syncedCount={10}
          totalCount={50}
          status="syncing"
        />
      );

      expect(screen.getByText('10 / 50')).toBeInTheDocument();

      rerender(
        <SyncProgressPanel
          progress={30}
          syncedCount={30}
          totalCount={50}
          status="syncing"
        />
      );

      expect(screen.getByText('30 / 50')).toBeInTheDocument();
    });

    it('should display percentage correctly', () => {
      render(
        <SyncProgressPanel
          progress={67}
          syncedCount={67}
          totalCount={100}
          status="syncing"
        />
      );

      expect(screen.getByText('67%')).toBeInTheDocument();
    });

    it('should round percentage correctly', () => {
      render(
        <SyncProgressPanel
          progress={33.7}
          syncedCount={34}
          totalCount={100}
          status="syncing"
        />
      );

      expect(screen.getByText('34%')).toBeInTheDocument();
    });
  });

  describe('Status Messages', () => {
    it('should display "Syncing..." when status is syncing', () => {
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="syncing"
        />
      );

      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });

    it('should display "Sync complete" when status is idle', () => {
      render(
        <SyncProgressPanel
          progress={100}
          syncedCount={100}
          totalCount={100}
          status="idle"
        />
      );

      expect(screen.getByText('Sync complete')).toBeInTheDocument();
    });

    it('should display "Sync failed" when status is error', () => {
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="error"
        />
      );

      expect(screen.getByText('Sync failed')).toBeInTheDocument();
    });
  });

  describe('ETA Calculation', () => {
    it('should calculate ETA in seconds', () => {
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="syncing"
        />
      );

      expect(screen.getByText(/ETA: \d+s/)).toBeInTheDocument();
    });

    it('should calculate ETA in minutes when > 60 seconds', () => {
      render(
        <SyncProgressPanel
          progress={10}
          syncedCount={10}
          totalCount={100}
          status="syncing"
        />
      );

      expect(screen.getByText(/ETA: \d+m/)).toBeInTheDocument();
    });

    it('should not show ETA when not syncing', () => {
      render(
        <SyncProgressPanel
          progress={100}
          syncedCount={100}
          totalCount={100}
          status="idle"
        />
      );

      expect(screen.queryByText(/ETA:/)).not.toBeInTheDocument();
    });

    it('should not show ETA when progress is 0', () => {
      render(
        <SyncProgressPanel
          progress={0}
          syncedCount={0}
          totalCount={100}
          status="syncing"
        />
      );

      expect(screen.queryByText(/ETA:/)).not.toBeInTheDocument();
    });

    it('should not show ETA on error status', () => {
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="error"
        />
      );

      expect(screen.queryByText(/ETA:/)).not.toBeInTheDocument();
    });
  });

  describe('Spinner', () => {
    it('should show spinner when syncing', () => {
      const { container } = render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="syncing"
        />
      );

      const spinner = container.querySelector('.spinner');
      expect(spinner).toBeInTheDocument();
    });

    it('should not show spinner when idle', () => {
      const { container } = render(
        <SyncProgressPanel
          progress={100}
          syncedCount={100}
          totalCount={100}
          status="idle"
        />
      );

      expect(container.querySelector('.spinner')).not.toBeInTheDocument();
    });

    it('should not show spinner on error', () => {
      const { container } = render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="error"
        />
      );

      expect(container.querySelector('.spinner')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error state styles', () => {
      const { container } = render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="error"
        />
      );

      const panel = container.firstChild;
      expect(panel).toHaveClass('error');
    });

    it('should show retry button on error', () => {
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="error"
          onRetry={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should not show retry button when onRetry not provided', () => {
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="error"
        />
      );

      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    });

    it('should call onRetry when retry button clicked', () => {
      const onRetry = vi.fn();
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="error"
          onRetry={onRetry}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /retry/i }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dismiss Functionality', () => {
    it('should show dismiss button when onDismiss provided', () => {
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="syncing"
          onDismiss={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should not show dismiss button when onDismiss not provided', () => {
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="syncing"
        />
      );

      expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
    });

    it('should call onDismiss when dismiss button clicked', () => {
      const onDismiss = vi.fn();
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="syncing"
          onDismiss={onDismiss}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('Animation', () => {
    it('should apply animating class during sync', () => {
      const { container } = render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="syncing"
        />
      );

      const progressFill = container.querySelector('[role="progressbar"]') as HTMLElement;
      expect(progressFill).toHaveClass('animating');
    });

    it('should remove animating class when not syncing', () => {
      const { container } = render(
        <SyncProgressPanel
          progress={100}
          syncedCount={100}
          totalCount={100}
          status="idle"
        />
      );

      const progressFill = container.querySelector('[role="progressbar"]') as HTMLElement;
      expect(progressFill).not.toHaveClass('animating');
    });

    it('should remove animating class on error', () => {
      const { container } = render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="error"
        />
      );

      const progressFill = container.querySelector('[role="progressbar"]') as HTMLElement;
      expect(progressFill).not.toHaveClass('animating');
    });
  });

  describe('Title', () => {
    it('should display "Sync Progress" title', () => {
      render(
        <SyncProgressPanel
          progress={50}
          syncedCount={50}
          totalCount={100}
          status="syncing"
        />
      );

      expect(screen.getByText('Sync Progress')).toBeInTheDocument();
    });
  });
});
