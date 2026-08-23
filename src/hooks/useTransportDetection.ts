/**
 * useTransportDetection
 * Detects available SSH transport methods on the client
 * Helps web clients understand their connection options
 */

import { useState, useEffect } from 'react';

export type TransportType = 'tailscale' | 'direct' | 'relay' | 'unknown';

interface TransportStatus {
  tailscaleAvailable: boolean;
  transport: TransportType;
  loading: boolean;
}

/**
 * Check if Tailscale is running on the client machine
 * Tailscale exposes a local API on port 41112
 */
async function detectTailscale(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:41112/localapi/v0/status', {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Detect available transport methods
 * - Electron/iOS/Android: direct SSH (always available)
 * - Web: needs Tailscale on client or falls back to relay
 */
export function useTransportDetection(): TransportStatus {
  const [status, setStatus] = useState<TransportStatus>({
    tailscaleAvailable: false,
    transport: 'unknown',
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function detect() {
      // Check if we're in Electron (native client)
      const isElectron = typeof window !== 'undefined' && 
        window.navigator?.userAgent?.includes('Electron');

      if (isElectron) {
        // Electron can always do direct SSH
        if (mounted) {
          setStatus({
            tailscaleAvailable: false,
            transport: 'direct',
            loading: false,
          });
        }
        return;
      }

      // Web client - check for Tailscale
      const tailscaleAvailable = await detectTailscale();

      if (mounted) {
        setStatus({
          tailscaleAvailable,
          transport: tailscaleAvailable ? 'tailscale' : 'relay',
          loading: false,
        });
      }
    }

    detect();

    return () => {
      mounted = false;
    };
  }, []);

  return status;
}

/**
 * Get connection help text based on transport
 */
export function getTransportHelpText(transport: TransportType): string {
  switch (transport) {
    case 'direct':
      return 'Connecting directly to host via SSH.';
    case 'tailscale':
      return 'Connecting via Tailscale network.';
    case 'relay':
      return 'Connecting through server relay. For direct connections, install Tailscale or use the desktop app.';
    default:
      return 'Detecting connection method...';
  }
}
