import { useState, useCallback, useEffect, useRef } from 'react';
import { P2PSyncService, PeerInfo } from '../services/P2PSyncService';
import { OfflineChange, OfflineSyncService } from '../services/OfflineSyncService';

export interface SyncResult {
  success: boolean;
  changeCount: number;
  error?: Error;
}

export interface UseP2PSyncState {
  peers: PeerInfo[];
  isDiscovering: boolean;
  isSyncing: boolean;
  syncProgress: number;
  lastSyncAt: Map<string, number>;
  connectedPeerCount: number;
  errors: string[];
}

export interface UseP2PSyncMethods {
  discoverPeers(): Promise<PeerInfo[]>;
  connectToPeer(peerId: string): Promise<void>;
  disconnectFromPeer(peerId: string): Promise<void>;
  syncWithPeer(peerId: string): Promise<SyncResult>;
  broadcastToAll(changes: OfflineChange[]): Promise<Map<string, boolean>>;
  cancelSync(): void;
  clearErrors(): void;
}

export type UseP2PSyncResult = UseP2PSyncState & UseP2PSyncMethods;

export function useP2PSync(
  p2pSync: P2PSyncService,
  offlineSync?: OfflineSyncService
): UseP2PSyncResult {
  const [state, setState] = useState<UseP2PSyncState>({
    peers: [],
    isDiscovering: false,
    isSyncing: false,
    syncProgress: 0,
    lastSyncAt: new Map(),
    connectedPeerCount: 0,
    errors: [],
  });

  const p2pSyncRef = useRef<P2PSyncService>(p2pSync);
  const offlineSyncRef = useRef<OfflineSyncService | undefined>(offlineSync);
  const abortControllerRef = useRef<AbortController | null>(null);
  const peerListenerRef = useRef<((data: any) => void) | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await p2pSyncRef.current.initialize();

        const onPeerConnected = (data: any) => {
          setState((prev) => {
            const peers = [...prev.peers];
            const peerIndex = peers.findIndex((p) => p.id === data.peerId);

            if (peerIndex >= 0) {
              peers[peerIndex].isConnected = true;
              peers[peerIndex].lastSeen = Date.now();
            } else {
              peers.push({
                id: data.peerId,
                name: data.peerId,
                lastSeen: Date.now(),
                isConnected: true,
              });
            }

            const connectedCount = peers.filter((p) => p.isConnected).length;

            return {
              ...prev,
              peers,
              connectedPeerCount: connectedCount,
            };
          });
        };

        const onPeerDisconnected = (data: any) => {
          setState((prev) => {
            const peers = [...prev.peers];
            const peerIndex = peers.findIndex((p) => p.id === data.peerId);

            if (peerIndex >= 0) {
              peers[peerIndex].isConnected = false;
            }

            const connectedCount = peers.filter((p) => p.isConnected).length;

            return {
              ...prev,
              peers,
              connectedPeerCount: connectedCount,
            };
          });
        };

        p2pSyncRef.current.on('peer-connected', onPeerConnected);
        p2pSyncRef.current.on('peer-disconnected', onPeerDisconnected);

        peerListenerRef.current = onPeerConnected;

        try {
          await discoverPeers();
        } catch (error) {
          console.error('Failed to auto-discover peers:', error);
        }
      } catch (error) {
        console.error('Failed to initialize P2P sync:', error);
        addError('Failed to initialize P2P sync service');
      }
    };

    initialize();

    return () => {
      if (peerListenerRef.current) {
        p2pSyncRef.current.off('peer-connected', peerListenerRef.current);
        p2pSyncRef.current.off('peer-disconnected', peerListenerRef.current);
      }
    };
  }, []);

  const addError = useCallback((error: string) => {
    setState((prev) => ({
      ...prev,
      errors: [...prev.errors, error],
    }));
  }, []);

  const discoverPeers = useCallback(async (): Promise<PeerInfo[]> => {
    try {
      setState((prev) => ({
        ...prev,
        isDiscovering: true,
      }));

      const connectedPeers = p2pSyncRef.current.getConnectedPeers();

      setState((prev) => ({
        ...prev,
        peers: connectedPeers,
        isDiscovering: false,
        connectedPeerCount: connectedPeers.length,
      }));

      return connectedPeers;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during peer discovery';
      console.error('Peer discovery failed:', error);
      addError(`Peer discovery failed: ${errorMsg}`);
      setState((prev) => ({
        ...prev,
        isDiscovering: false,
      }));
      throw error;
    }
  }, []);

  const connectToPeer = useCallback(async (peerId: string): Promise<void> => {
    try {
      await p2pSyncRef.current.connectToPeer(peerId);

      setState((prev) => {
        const peers = [...prev.peers];
        const peerIndex = peers.findIndex((p) => p.id === peerId);

        if (peerIndex >= 0) {
          peers[peerIndex].isConnected = true;
          peers[peerIndex].lastSeen = Date.now();
        } else {
          peers.push({
            id: peerId,
            name: peerId,
            lastSeen: Date.now(),
            isConnected: true,
          });
        }

        const connectedCount = peers.filter((p) => p.isConnected).length;

        return {
          ...prev,
          peers,
          connectedPeerCount: connectedCount,
        };
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during connection';
      console.error(`Failed to connect to peer ${peerId}:`, error);
      addError(`Connection to peer ${peerId} failed: ${errorMsg}`);
      throw error;
    }
  }, []);

  const disconnectFromPeer = useCallback(async (peerId: string): Promise<void> => {
    try {
      setState((prev) => {
        const peers = [...prev.peers];
        const peerIndex = peers.findIndex((p) => p.id === peerId);

        if (peerIndex >= 0) {
          peers[peerIndex].isConnected = false;
        }

        const connectedCount = peers.filter((p) => p.isConnected).length;

        return {
          ...prev,
          peers,
          connectedPeerCount: connectedCount,
        };
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during disconnection';
      console.error(`Failed to disconnect from peer ${peerId}:`, error);
      addError(`Disconnection from peer ${peerId} failed: ${errorMsg}`);
      throw error;
    }
  }, []);

  const syncWithPeer = useCallback(
    async (peerId: string): Promise<SyncResult> => {
      try {
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setState((prev) => ({
          ...prev,
          isSyncing: true,
          syncProgress: 0,
        }));

        const changes = offlineSyncRef.current
          ? await offlineSyncRef.current.getUnsyncedChanges()
          : [];

        if (signal.aborted) {
          throw new Error('Sync operation cancelled');
        }

        if (changes.length > 0) {
          try {
            await p2pSyncRef.current.sendChangesToPeer(peerId, changes);
          } catch (error) {
            console.error(`Failed to send changes to peer ${peerId}:`, error);
          }
        }

        setState((prev) => ({
          ...prev,
          syncProgress: 50,
        }));

        if (signal.aborted) {
          throw new Error('Sync operation cancelled');
        }

        try {
          await p2pSyncRef.current.requestSyncFromPeer(peerId);
        } catch (error) {
          console.error(`Failed to request sync from peer ${peerId}:`, error);
        }

        setState((prev) => {
          const lastSyncAt = new Map(prev.lastSyncAt);
          lastSyncAt.set(peerId, Date.now());

          return {
            ...prev,
            lastSyncAt,
            syncProgress: 100,
            isSyncing: false,
          };
        });

        abortControllerRef.current = null;

        return {
          success: true,
          changeCount: changes.length,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown sync error';
        console.error(`Sync with peer ${peerId} failed:`, error);
        addError(`Sync with peer ${peerId} failed: ${errorMsg}`);

        setState((prev) => ({
          ...prev,
          isSyncing: false,
        }));

        abortControllerRef.current = null;

        return {
          success: false,
          changeCount: 0,
          error: error instanceof Error ? error : new Error(errorMsg),
        };
      }
    },
    []
  );

  const broadcastToAll = useCallback(
    async (changes: OfflineChange[]): Promise<Map<string, boolean>> => {
      const results = new Map<string, boolean>();

      try {
        setState((prev) => ({
          ...prev,
          isSyncing: true,
          syncProgress: 0,
        }));

        const connectedPeers = state.peers.filter((p) => p.isConnected);
        const totalPeers = connectedPeers.length;

        if (totalPeers === 0) {
          setState((prev) => ({
            ...prev,
            isSyncing: false,
          }));
          return results;
        }

        for (let i = 0; i < connectedPeers.length; i++) {
          const peer = connectedPeers[i];

          try {
            await p2pSyncRef.current.sendChangesToPeer(peer.id, changes);
            results.set(peer.id, true);
          } catch (error) {
            console.error(`Failed to broadcast to peer ${peer.id}:`, error);
            results.set(peer.id, false);
          }

          const progress = Math.round(((i + 1) / totalPeers) * 100);
          setState((prev) => ({
            ...prev,
            syncProgress: progress,
          }));
        }

        setState((prev) => ({
          ...prev,
          isSyncing: false,
        }));

        return results;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown broadcast error';
        console.error('Broadcast failed:', error);
        addError(`Broadcast to all peers failed: ${errorMsg}`);

        setState((prev) => ({
          ...prev,
          isSyncing: false,
        }));

        throw error;
      }
    },
    [state.peers]
  );

  const cancelSync = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isSyncing: false,
      syncProgress: 0,
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: [],
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    discoverPeers,
    connectToPeer,
    disconnectFromPeer,
    syncWithPeer,
    broadcastToAll,
    cancelSync,
    clearErrors,
  };
}
