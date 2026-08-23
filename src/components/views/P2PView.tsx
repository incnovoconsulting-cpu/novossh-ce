import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from '@/lib/icons';
import { PeerList } from '../P2P/PeerList';
import { P2PSessionsPanel } from '../P2P/P2PSessionsPanel';
import { PaywallGate } from '../PaywallGate';
import { useStore } from '../../lib/store';
import { heartbeat, listPeers, syncWithPeer } from '../../lib/p2pApi';
import type { PeerInfo } from '../../lib/types';

const HEARTBEAT_INTERVAL_MS = 30 * 1000;

export function P2PView() {
  const accessToken = useStore((s) => s.auth.accessToken);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPeers = useCallback(async () => {
    if (!accessToken) return;
    try {
      setError(null);
      const data = await listPeers(accessToken);
      setPeers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load peers');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    const register = async () => {
      try {
        await heartbeat(accessToken);
      } catch {
        // best-effort; peer list will just be stale until the next heartbeat succeeds
      }
      if (!cancelled) await loadPeers();
    };
    register();

    const interval = setInterval(() => {
      heartbeat(accessToken).then(loadPeers).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [accessToken, loadPeers]);

  const handleSync = async (peerId: string) => {
    if (!accessToken) return;
    try {
      setIsSyncing(true);
      setError(null);
      await syncWithPeer(accessToken, peerId);
      await loadPeers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <PaywallGate feature="p2pSync">
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">P2P Sync</h2>
            <p className="text-sm text-slate-400">Sync data between your devices.</p>
          </div>
          <button onClick={loadPeers} className="btn-ghost p-2" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-terminal-red/20 bg-terminal-red/[0.06] p-3">
            <AlertCircle className="h-4 w-4 text-terminal-red" />
            <p className="text-xs text-terminal-red/80">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-12 text-slate-500">Loading peers...</div>
        ) : (
          <PeerList peers={peers} isSyncing={isSyncing} onSyncWithPeer={handleSync} />
        )}

        <div className="border-t border-white/[0.06] pt-6">
          <P2PSessionsPanel />
        </div>
      </div>
    </div>
    </PaywallGate>
  );
}
