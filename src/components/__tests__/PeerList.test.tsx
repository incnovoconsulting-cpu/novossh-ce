import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PeerList } from '../P2P/PeerList';
import type { PeerInfo } from '../../lib/types';

describe('PeerList Component', () => {
  const mockPeer: PeerInfo = {
    id: 'peer-1',
    name: 'Device 1',
    connectionStatus: 'connected',
    lastSyncedAt: Date.now() - 5 * 60 * 1000, // 5 minutes ago
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render peer list correctly', () => {
      render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Device 1')).toBeInTheDocument();
    });

    it('should display multiple peers', () => {
      const peers: PeerInfo[] = [
        { ...mockPeer, id: 'peer-1', name: 'Device 1' },
        { ...mockPeer, id: 'peer-2', name: 'Device 2' },
        { ...mockPeer, id: 'peer-3', name: 'Device 3' },
      ];

      render(
        <PeerList
          peers={peers}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Device 1')).toBeInTheDocument();
      expect(screen.getByText('Device 2')).toBeInTheDocument();
      expect(screen.getByText('Device 3')).toBeInTheDocument();
    });

    it('should display peer count in header', () => {
      const peers: PeerInfo[] = [
        { ...mockPeer, id: 'peer-1' },
        { ...mockPeer, id: 'peer-2' },
      ];

      render(
        <PeerList
          peers={peers}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText(/Peers \(2\)/)).toBeInTheDocument();
    });
  });

  describe('Connection Status', () => {
    it('should show green indicator for connected peer', () => {
      const { container } = render(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'connected' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      const indicator = container.querySelector('.statusIndicator.connected');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('🟢');
    });

    it('should show yellow indicator for connecting peer', () => {
      const { container } = render(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'connecting' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      const indicator = container.querySelector('.statusIndicator.connecting');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('🟡');
    });

    it('should show red indicator for disconnected peer', () => {
      const { container } = render(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'disconnected' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      const indicator = container.querySelector('.statusIndicator.disconnected');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('🔴');
    });

    it('should display correct status text for each connection state', () => {
      const { rerender } = render(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'connected' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();

      rerender(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'connecting' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Connecting')).toBeInTheDocument();

      rerender(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'disconnected' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  describe('Last Sync Time', () => {
    it('should display last sync time', () => {
      render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText(/Synced \d+m ago/)).toBeInTheDocument();
    });

    it('should display "Never" when no lastSyncedAt', () => {
      render(
        <PeerList
          peers={[{ ...mockPeer, lastSyncedAt: undefined }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Synced Never')).toBeInTheDocument();
    });

    it('should show "Just now" for recent sync', () => {
      render(
        <PeerList
          peers={[{ ...mockPeer, lastSyncedAt: Date.now() - 30 * 1000 }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Synced Just now')).toBeInTheDocument();
    });

    it('should show hours for older syncs', () => {
      render(
        <PeerList
          peers={[{ ...mockPeer, lastSyncedAt: Date.now() - 2 * 60 * 60 * 1000 }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText(/Synced \d+h ago/)).toBeInTheDocument();
    });

    it('should show days for very old syncs', () => {
      render(
        <PeerList
          peers={[{ ...mockPeer, lastSyncedAt: Date.now() - 3 * 24 * 60 * 60 * 1000 }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText(/Synced \d+d ago/)).toBeInTheDocument();
    });
  });

  describe('Sync Button', () => {
    it('should trigger onSyncWithPeer when sync button clicked', () => {
      const onSyncWithPeer = vi.fn();
      render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={false}
          onSyncWithPeer={onSyncWithPeer}
        />
      );

      fireEvent.click(screen.getByRole('button'));

      expect(onSyncWithPeer).toHaveBeenCalledWith('peer-1');
      expect(onSyncWithPeer).toHaveBeenCalledTimes(1);
    });

    it('should disable sync button when not connected', () => {
      render(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'disconnected' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should disable sync button when connecting', () => {
      render(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'connecting' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should disable sync button during sync operation', () => {
      render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={true}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should enable sync button for connected peer when not syncing', () => {
      render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    it('should show sync spinner during sync', () => {
      const { container } = render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={true}
          onSyncWithPeer={() => {}}
        />
      );

      expect(container.querySelector('.syncSpinner')).toBeInTheDocument();
    });

    it('should show sync icon when not syncing', () => {
      const { container } = render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(container.querySelector('.syncIcon')).toBeInTheDocument();
    });

    it('should have correct tooltip for disabled sync button', () => {
      render(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'disconnected' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'Peer is disconnected'
      );
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no peers', () => {
      render(
        <PeerList
          peers={[]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('No Peers Discovered')).toBeInTheDocument();
    });

    it('should show empty description', () => {
      render(
        <PeerList
          peers={[]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(
        screen.getByText('Peers will appear here as they connect to the P2P network')
      ).toBeInTheDocument();
    });

    it('should show search emoji in empty state', () => {
      const { container } = render(
        <PeerList
          peers={[]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(container.querySelector('.emptyIcon')).toHaveTextContent('🔍');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on sync button', () => {
      render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Sync with Device 1'
      );
    });

    it('should have title attribute on status indicator', () => {
      const { container } = render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      const indicator = container.querySelector('.statusIndicator');
      expect(indicator).toHaveAttribute('title', 'Connected');
    });

    it('should be keyboard accessible', () => {
      const onSyncWithPeer = vi.fn();
      render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={false}
          onSyncWithPeer={onSyncWithPeer}
        />
      );

      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();

      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      fireEvent.click(button);

      expect(onSyncWithPeer).toHaveBeenCalled();
    });
  });

  describe('Dynamic Updates', () => {
    it('should update when peers list changes', () => {
      const { rerender } = render(
        <PeerList
          peers={[{ ...mockPeer, id: 'peer-1', name: 'Device 1' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Device 1')).toBeInTheDocument();
      expect(screen.queryByText('Device 2')).not.toBeInTheDocument();

      rerender(
        <PeerList
          peers={[
            { ...mockPeer, id: 'peer-1', name: 'Device 1' },
            { ...mockPeer, id: 'peer-2', name: 'Device 2' },
          ]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Device 1')).toBeInTheDocument();
      expect(screen.getByText('Device 2')).toBeInTheDocument();
    });

    it('should update syncing state', () => {
      const { container, rerender } = render(
        <PeerList
          peers={[mockPeer]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(container.querySelector('.syncIcon')).toBeInTheDocument();
      expect(container.querySelector('.syncSpinner')).not.toBeInTheDocument();

      rerender(
        <PeerList
          peers={[mockPeer]}
          isSyncing={true}
          onSyncWithPeer={() => {}}
        />
      );

      expect(container.querySelector('.syncIcon')).not.toBeInTheDocument();
      expect(container.querySelector('.syncSpinner')).toBeInTheDocument();
    });

    it('should handle peer connection status changes', () => {
      const { rerender } = render(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'connecting' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Connecting')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();

      rerender(
        <PeerList
          peers={[{ ...mockPeer, connectionStatus: 'connected' }]}
          isSyncing={false}
          onSyncWithPeer={() => {}}
        />
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  describe('Multiple Peers Interactions', () => {
    it('should handle multiple sync buttons correctly', () => {
      const onSyncWithPeer = vi.fn();
      const peers: PeerInfo[] = [
        { ...mockPeer, id: 'peer-1', name: 'Device 1' },
        { ...mockPeer, id: 'peer-2', name: 'Device 2' },
      ];

      render(
        <PeerList
          peers={peers}
          isSyncing={false}
          onSyncWithPeer={onSyncWithPeer}
        />
      );

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[1]);

      expect(onSyncWithPeer).toHaveBeenCalledWith('peer-1');
      expect(onSyncWithPeer).toHaveBeenCalledWith('peer-2');
      expect(onSyncWithPeer).toHaveBeenCalledTimes(2);
    });

    it('should disable all buttons during global sync', () => {
      const peers: PeerInfo[] = [
        { ...mockPeer, id: 'peer-1', name: 'Device 1' },
        { ...mockPeer, id: 'peer-2', name: 'Device 2' },
      ];

      render(
        <PeerList
          peers={peers}
          isSyncing={true}
          onSyncWithPeer={() => {}}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });
});
