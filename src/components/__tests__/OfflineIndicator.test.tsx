import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OfflineIndicator } from '../Status/OfflineIndicator';

describe('OfflineIndicator Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Online/Offline States', () => {
    it('should render green indicator when online', () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={0}
        />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('🟢');
    });

    it('should render red indicator when offline', () => {
      render(
        <OfflineIndicator
          isOnline={false}
          unsavedChanges={0}
        />
      );

      const indicator = screen.getByRole('status');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('🔴');
    });
  });

  describe('Unsaved Changes Badge', () => {
    it('should show unsaved changes badge when count > 0', () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={5}
        />
      );

      const badge = screen.getByText('5');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('title', '5 unsaved changes');
    });

    it('should display correct count in badge', () => {
      const { rerender } = render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={3}
        />
      );

      expect(screen.getByText('3')).toBeInTheDocument();

      rerender(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={12}
        />
      );

      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('should not show badge when unsavedChanges is 0', () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={0}
        />
      );

      expect(screen.queryByRole('button', { name: /badge/i })).not.toBeInTheDocument();
    });
  });

  describe('Tooltip', () => {
    it('should show tooltip on mouse enter', async () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={2}
        />
      );

      const indicator = screen.getByRole('status');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={2}
        />
      );

      const indicator = screen.getByRole('status');
      fireEvent.mouseEnter(indicator);

      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(indicator);

      await waitFor(() => {
        expect(screen.queryByText('Online')).not.toBeInTheDocument();
      });
    });

    it('should display correct status in tooltip when online', async () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={0}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));

      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
      });
    });

    it('should display correct status in tooltip when offline', async () => {
      render(
        <OfflineIndicator
          isOnline={false}
          unsavedChanges={0}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));

      await waitFor(() => {
        expect(screen.getByText('Offline')).toBeInTheDocument();
      });
    });

    it('should show unsaved changes in tooltip', async () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={3}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));

      await waitFor(() => {
        expect(screen.getByText('3 changes pending')).toBeInTheDocument();
      });
    });

    it('should show "Tap to sync" message when onTapToSync provided', async () => {
      const onTapToSync = vi.fn();
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={2}
          onTapToSync={onTapToSync}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));

      await waitFor(() => {
        expect(screen.getByText('Tap to sync')).toBeInTheDocument();
      });
    });
  });

  describe('Click Handling', () => {
    it('should trigger onTapToSync when clicked with unsaved changes', () => {
      const onTapToSync = vi.fn();
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={3}
          onTapToSync={onTapToSync}
        />
      );

      fireEvent.click(screen.getByRole('status'));

      expect(onTapToSync).toHaveBeenCalledTimes(1);
    });

    it('should not trigger onTapToSync when no unsaved changes', () => {
      const onTapToSync = vi.fn();
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={0}
          onTapToSync={onTapToSync}
        />
      );

      fireEvent.click(screen.getByRole('status'));

      expect(onTapToSync).not.toHaveBeenCalled();
    });

    it('should handle click gracefully when onTapToSync is undefined', () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={3}
        />
      );

      expect(() => {
        fireEvent.click(screen.getByRole('status'));
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have correct aria-label when online with no changes', () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={0}
        />
      );

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Online - 0 unsaved changes'
      );
    });

    it('should have correct aria-label when offline with changes', () => {
      render(
        <OfflineIndicator
          isOnline={false}
          unsavedChanges={5}
        />
      );

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Offline - 5 unsaved changes'
      );
    });

    it('should update aria-label when props change', () => {
      const { rerender } = render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={1}
        />
      );

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Online - 1 unsaved changes'
      );

      rerender(
        <OfflineIndicator
          isOnline={false}
          unsavedChanges={3}
        />
      );

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Offline - 3 unsaved changes'
      );
    });

    it('should have proper title attribute on badge', () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={4}
        />
      );

      expect(screen.getByText('4')).toHaveAttribute(
        'title',
        '4 unsaved changes'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle large unsaved changes count', () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={999}
        />
      );

      expect(screen.getByText('999')).toBeInTheDocument();
    });

    it('should handle single unsaved change text correctly', async () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={1}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));

      await waitFor(() => {
        expect(screen.getByText('1 change pending')).toBeInTheDocument();
      });
    });

    it('should handle multiple unsaved changes text correctly', async () => {
      render(
        <OfflineIndicator
          isOnline={true}
          unsavedChanges={2}
        />
      );

      fireEvent.mouseEnter(screen.getByRole('status'));

      await waitFor(() => {
        expect(screen.getByText('2 changes pending')).toBeInTheDocument();
      });
    });
  });
});
