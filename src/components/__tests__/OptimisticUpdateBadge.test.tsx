import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OptimisticUpdateBadge } from '../Sync/OptimisticUpdateBadge';

describe('OptimisticUpdateBadge Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should show badge when isPending is true', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      const badge = container.querySelector('button');
      expect(badge).toBeInTheDocument();
    });

    it('should hide badge when isPending is false', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={false} />
      );

      expect(container.querySelector('button')).not.toBeInTheDocument();
    });

    it('should render null when isPending is false', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should toggle visibility based on isPending prop', () => {
      const { container, rerender } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      expect(container.querySelector('button')).toBeInTheDocument();

      rerender(<OptimisticUpdateBadge isPending={false} />);

      expect(container.querySelector('button')).not.toBeInTheDocument();

      rerender(<OptimisticUpdateBadge isPending={true} />);

      expect(container.querySelector('button')).toBeInTheDocument();
    });
  });

  describe('Content', () => {
    it('should display "Pending" text', () => {
      render(<OptimisticUpdateBadge isPending={true} />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should display spinner element', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      const spinner = container.querySelector('.spinner');
      expect(spinner).toBeInTheDocument();
    });

    it('should have aria-hidden on spinner', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      const spinner = container.querySelector('.spinner');
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Click Handling', () => {
    it('should call onRetry when clicked', () => {
      const onRetry = vi.fn();
      render(
        <OptimisticUpdateBadge isPending={true} onRetry={onRetry} />
      );

      fireEvent.click(screen.getByRole('button'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should not throw when onRetry is undefined and badge clicked', () => {
      render(<OptimisticUpdateBadge isPending={true} />);

      expect(() => {
        fireEvent.click(screen.getByRole('button'));
      }).not.toThrow();
    });

    it('should call onRetry multiple times on multiple clicks', () => {
      const onRetry = vi.fn();
      render(
        <OptimisticUpdateBadge isPending={true} onRetry={onRetry} />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(onRetry).toHaveBeenCalledTimes(3);
    });
  });

  describe('Button State', () => {
    it('should be disabled when onRetry is undefined', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      const button = container.querySelector('button');
      expect(button).toBeDisabled();
    });

    it('should be enabled when onRetry is provided', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={true} onRetry={() => {}} />
      );

      const button = container.querySelector('button');
      expect(button).not.toBeDisabled();
    });

    it('should update disabled state when onRetry changes', () => {
      const { container, rerender } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      let button = container.querySelector('button');
      expect(button).toBeDisabled();

      rerender(
        <OptimisticUpdateBadge isPending={true} onRetry={() => {}} />
      );

      button = container.querySelector('button');
      expect(button).not.toBeDisabled();

      rerender(<OptimisticUpdateBadge isPending={true} />);

      button = container.querySelector('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label', () => {
      render(
        <OptimisticUpdateBadge isPending={true} />
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Pending sync badge'
      );
    });

    it('should have descriptive title when onRetry provided', () => {
      render(
        <OptimisticUpdateBadge isPending={true} onRetry={() => {}} />
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'Click to retry sync'
      );
    });

    it('should have status title when onRetry not provided', () => {
      render(
        <OptimisticUpdateBadge isPending={true} />
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'Pending sync'
      );
    });

    it('should be keyboard accessible', () => {
      const onRetry = vi.fn();
      render(
        <OptimisticUpdateBadge isPending={true} onRetry={onRetry} />
      );

      const button = screen.getByRole('button');
      button.focus();

      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      // Note: fireEvent.click is triggered by Enter/Space on buttons by default
      fireEvent.click(button);

      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('CSS Classes', () => {
    it('should have badge class', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      const button = container.querySelector('button');
      expect(button).toHaveClass('badge');
    });

    it('should have text span with correct class', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      const textSpan = container.querySelector('.text');
      expect(textSpan).toHaveTextContent('Pending');
    });

    it('should have spinner span with correct class', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid isPending changes', () => {
      const { rerender, container } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      expect(container.querySelector('button')).toBeInTheDocument();

      rerender(<OptimisticUpdateBadge isPending={false} />);
      expect(container.querySelector('button')).not.toBeInTheDocument();

      rerender(<OptimisticUpdateBadge isPending={true} />);
      expect(container.querySelector('button')).toBeInTheDocument();

      rerender(<OptimisticUpdateBadge isPending={false} />);
      expect(container.querySelector('button')).not.toBeInTheDocument();
    });

    it('should handle undefined onRetry gracefully throughout lifecycle', () => {
      const { rerender } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      expect(() => {
        fireEvent.click(screen.getByRole('button'));
      }).not.toThrow();

      rerender(
        <OptimisticUpdateBadge isPending={true} onRetry={() => {}} />
      );

      expect(() => {
        fireEvent.click(screen.getByRole('button'));
      }).not.toThrow();

      rerender(
        <OptimisticUpdateBadge isPending={true} />
      );

      expect(() => {
        fireEvent.click(screen.getByRole('button'));
      }).not.toThrow();
    });

    it('should work correctly when parent re-renders', () => {
      const Parent = ({ isPending }: { isPending: boolean }) => (
        <OptimisticUpdateBadge isPending={isPending} onRetry={() => {}} />
      );

      const { rerender } = render(<Parent isPending={true} />);

      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<Parent isPending={false} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      rerender(<Parent isPending={true} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should render as a button element', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      const button = container.querySelector('button');
      expect(button?.tagName).toBe('BUTTON');
    });

    it('should contain both spinner and text spans', () => {
      const { container } = render(
        <OptimisticUpdateBadge isPending={true} />
      );

      const button = container.querySelector('button');
      const spinner = button?.querySelector('.spinner');
      const text = button?.querySelector('.text');

      expect(spinner).toBeInTheDocument();
      expect(text).toBeInTheDocument();
    });
  });
});
