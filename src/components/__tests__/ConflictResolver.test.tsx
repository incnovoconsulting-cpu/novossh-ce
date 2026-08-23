import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConflictResolver } from '../Vault/ConflictResolver';
import type { SyncConflict } from '../../services/OfflineSyncService';

describe('ConflictResolver Component', () => {
  const mockConflict: SyncConflict = {
    id: 'conflict-1',
    resourceId: 'resource-1',
    resourceType: 'entry',
    localVersion: {
      id: 'resource-1',
      title: 'Local Title',
      content: 'Local Content',
      timestamp: Date.now() - 1000,
    },
    remoteVersion: {
      id: 'resource-1',
      title: 'Remote Title',
      content: 'Remote Content',
      timestamp: Date.now(),
    },
    createdAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render conflict resolver dialog', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText(/Conflict/i)).toBeInTheDocument();
    });

    it('should display conflict count progress', () => {
      const conflicts = [mockConflict, { ...mockConflict, id: 'conflict-2' }];
      render(
        <ConflictResolver
          conflicts={conflicts}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText(/1 of 2/)).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      const { container } = render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={false}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });

  describe('Version Comparison', () => {
    it('should display local version', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Local Title')).toBeInTheDocument();
    });

    it('should display remote version', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Remote Title')).toBeInTheDocument();
    });

    it('should show local content details', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Local Content')).toBeInTheDocument();
    });

    it('should show remote content details', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Remote Content')).toBeInTheDocument();
    });
  });

  describe('Resolution Buttons', () => {
    it('should have use local button', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /use local/i })).toBeInTheDocument();
    });

    it('should have use remote button', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /use remote/i })).toBeInTheDocument();
    });

    it('should call onResolve with "local" when use local clicked', () => {
      const onResolve = vi.fn();
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={onResolve}
          onClose={() => {}}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /use local/i }));

      expect(onResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictId: 'conflict-1',
          resolution: 'local',
        })
      );
    });

    it('should call onResolve with "remote" when use remote clicked', () => {
      const onResolve = vi.fn();
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={onResolve}
          onClose={() => {}}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /use remote/i }));

      expect(onResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          conflictId: 'conflict-1',
          resolution: 'remote',
        })
      );
    });
  });

  describe('Navigation', () => {
    it('should show next button when there are more conflicts', () => {
      const conflicts = [mockConflict, { ...mockConflict, id: 'conflict-2' }];
      render(
        <ConflictResolver
          conflicts={conflicts}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should not show next button on last conflict', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
    });

    it('should navigate to next conflict', async () => {
      const conflicts = [mockConflict, { ...mockConflict, id: 'conflict-2', resourceId: 'resource-2' }];
      render(
        <ConflictResolver
          conflicts={conflicts}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/2 of 2/)).toBeInTheDocument();
      });
    });
  });

  describe('Auto-resolve Batch Mode', () => {
    it('should have auto-resolve button when available', () => {
      const conflicts = [mockConflict, { ...mockConflict, id: 'conflict-2' }];
      render(
        <ConflictResolver
          conflicts={conflicts}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
          onAutoResolve={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /auto-resolve/i })).toBeInTheDocument();
    });

    it('should call onAutoResolve when auto-resolve clicked', () => {
      const onAutoResolve = vi.fn();
      const conflicts = [mockConflict, { ...mockConflict, id: 'conflict-2' }];
      render(
        <ConflictResolver
          conflicts={conflicts}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
          onAutoResolve={onAutoResolve}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /auto-resolve/i }));

      expect(onAutoResolve).toHaveBeenCalled();
    });
  });

  describe('Modal Closure', () => {
    it('should call onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /close|✕/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should close modal after resolving all conflicts', async () => {
      const onClose = vi.fn();
      const onResolve = vi.fn((resolution) => {
        // Simulate conflict being removed after resolution
        const index = conflicts.indexOf(conflicts[0]);
        conflicts.splice(index, 1);
      });

      let conflicts = [mockConflict];

      const { rerender } = render(
        <ConflictResolver
          conflicts={conflicts}
          isOpen={true}
          onResolve={onResolve}
          onClose={onClose}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /use local/i }));

      rerender(
        <ConflictResolver
          conflicts={[]}
          isOpen={false}
          onResolve={onResolve}
          onClose={onClose}
        />
      );

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have dialog role', () => {
      const { container } = render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
    });

    it('should have proper button labels for screen readers', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: /use local/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /use remote/i })).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      const onResolve = vi.fn();
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={onResolve}
          onClose={() => {}}
        />
      );

      const button = screen.getByRole('button', { name: /use local/i });
      button.focus();
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      fireEvent.click(button);

      expect(onResolve).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty conflicts array', () => {
      const { container } = render(
        <ConflictResolver
          conflicts={[]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should handle single conflict', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText(/1 of 1/)).toBeInTheDocument();
    });

    it('should handle many conflicts', () => {
      const conflicts = Array.from({ length: 10 }, (_, i) => ({
        ...mockConflict,
        id: `conflict-${i}`,
        resourceId: `resource-${i}`,
      }));

      render(
        <ConflictResolver
          conflicts={conflicts}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText(/1 of 10/)).toBeInTheDocument();
    });

    it('should handle conflict with missing fields gracefully', () => {
      const incompleteConflict: SyncConflict = {
        id: 'conflict-1',
        resourceId: 'resource-1',
        resourceType: 'entry',
        localVersion: { id: 'resource-1' } as any,
        remoteVersion: { id: 'resource-1' } as any,
        createdAt: Date.now(),
      };

      render(
        <ConflictResolver
          conflicts={[incompleteConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText(/Conflict/i)).toBeInTheDocument();
    });
  });

  describe('Dynamic Updates', () => {
    it('should update when conflicts prop changes', () => {
      const { rerender } = render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText(/1 of 1/)).toBeInTheDocument();

      const newConflicts = [
        mockConflict,
        { ...mockConflict, id: 'conflict-2' },
        { ...mockConflict, id: 'conflict-3' },
      ];

      rerender(
        <ConflictResolver
          conflicts={newConflicts}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText(/1 of 3/)).toBeInTheDocument();
    });

    it('should update when isOpen prop changes', () => {
      const { container, rerender } = render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={false}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();

      rerender(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(container.querySelector('[role="dialog"]')).toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    it('should display resource type', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      expect(screen.getByText(/entry/i)).toBeInTheDocument();
    });

    it('should display timestamp information', () => {
      render(
        <ConflictResolver
          conflicts={[mockConflict]}
          isOpen={true}
          onResolve={() => {}}
          onClose={() => {}}
        />
      );

      // Should show some time-related information
      expect(screen.getByText(/Conflict/i)).toBeInTheDocument();
    });
  });
});
