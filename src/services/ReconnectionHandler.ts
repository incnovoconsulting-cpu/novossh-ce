/**
 * ReconnectionHandler
 * Detects connection restore and manages offline changes sync with server and peers
 */

import { OfflineSyncService, OfflineChange, SyncConflict } from './OfflineSyncService.js';
import { P2PSyncService } from './P2PSyncService.js';

export interface SyncResult {
  success: boolean;
  unsyncedChanges: number;
  syncedChanges: number;
  conflicts: SyncConflict[];
  errors: string[];
}

export interface ReconnectionOptions {
  autoSync?: boolean;
  conflictResolution?: 'local' | 'remote' | 'manual';
  maxRetries?: number;
  retryDelay?: number;
}

export class ReconnectionHandler {
  private offlineSync: OfflineSyncService;
  private p2pSync: P2PSyncService;
  private serverApi: any; // Placeholder for server API
  private isReconnecting: boolean = false;
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();
  private options: ReconnectionOptions;

  constructor(
    offlineSync: OfflineSyncService,
    p2pSync: P2PSyncService,
    serverApi: any,
    options: ReconnectionOptions = {}
  ) {
    this.offlineSync = offlineSync;
    this.p2pSync = p2pSync;
    this.serverApi = serverApi;
    this.options = {
      autoSync: true,
      conflictResolution: 'manual',
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    };
  }

  /**
   * Initialize reconnection handler
   */
  async initialize(): Promise<void> {
    this.eventListeners.set('reconnecting', new Set());
    this.eventListeners.set('reconnected', new Set());
    this.eventListeners.set('sync-progress', new Set());
    this.eventListeners.set('conflict-detected', new Set());
    this.eventListeners.set('sync-complete', new Set());

    // Listen for online event
    window.addEventListener('online', () => this.handleReconnection());
  }

  /**
   * Handle reconnection event
   */
  private async handleReconnection(): Promise<void> {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.emitEvent('reconnecting', {});

    try {
      const result = await this.synchronizeAllChanges();
      this.emitEvent('sync-complete', result);
    } catch (_error) {
      console.error('Reconnection sync failed:', _error);
      this.emitEvent('sync-complete', {
        success: false,
        errors: [(_error as Error).message],
      });
    } finally {
      this.isReconnecting = false;
      this.emitEvent('reconnected', {});
    }
  }

  /**
   * Synchronize all offline changes with server and peers
   */
  async synchronizeAllChanges(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      unsyncedChanges: 0,
      syncedChanges: 0,
      conflicts: [],
      errors: [],
    };

    try {
      // Get all unsynced changes
      const unsyncedChanges = await this.offlineSync.getUnsyncedChanges();
      result.unsyncedChanges = unsyncedChanges.length;

      if (unsyncedChanges.length === 0) {
        return result; // Nothing to sync
      }

      // Emit progress
      this.emitEvent('sync-progress', {
        stage: 'fetching-remote',
        message: 'Fetching latest changes from server...',
      });

      // Get remote changes from server
      const remoteChanges = await this.fetchRemoteChanges();

      // Detect conflicts
      const conflicts = await this.offlineSync.detectConflicts(remoteChanges);
      result.conflicts = conflicts;

      if (conflicts.length > 0) {
        this.emitEvent('conflict-detected', { conflicts });

        if (this.options.conflictResolution === 'manual') {
          // Wait for manual resolution
          await this.waitForConflictResolution(conflicts);
        } else {
          // Auto-resolve conflicts
          await this.autoResolveConflicts(conflicts, this.options.conflictResolution!);
        }
      }

      // Emit progress
      this.emitEvent('sync-progress', {
        stage: 'syncing-server',
        message: 'Syncing changes to server...',
      });

      // Push changes to server
      const syncedCount = await this.pushChangesToServer(unsyncedChanges);
      result.syncedChanges = syncedCount;

      // Emit progress
      this.emitEvent('sync-progress', {
        stage: 'syncing-peers',
        message: 'Syncing with connected peers...',
      });

      // Sync with peers
      await this.syncWithPeers(unsyncedChanges);

      // Mark changes as synced
      for (const change of unsyncedChanges) {
        await this.offlineSync.markAsSynced(change.id);
      }

      // Cleanup
      await this.offlineSync.clearSyncedChanges();

      result.success = true;
    } catch (_error) {
      result.success = false;
      result.errors.push((_error as Error).message);
    }

    return result;
  }

  /**
   * Push changes to server
   */
  private async pushChangesToServer(changes: OfflineChange[]): Promise<number> {
    let syncedCount = 0;
    const maxRetries = this.options.maxRetries || 3;

    for (const change of changes) {
      let retries = 0;
      let success = false;

      while (retries < maxRetries && !success) {
        try {
          // Call server API to push change
          await this.serverApi.syncChange(change);
          syncedCount++;
          success = true;
        } catch (_error) {
          retries++;
          if (retries < maxRetries) {
            // Exponential backoff
            const delay = (this.options.retryDelay || 1000) * Math.pow(2, retries - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      if (!success) {
        console.warn(`Failed to sync change ${change.id} after ${maxRetries} retries`);
      }
    }

    return syncedCount;
  }

  /**
   * Fetch remote changes from server
   */
  private async fetchRemoteChanges(): Promise<OfflineChange[]> {
    try {
      const lastSync = await this.offlineSync.getMetadata('lastServerSync');
      const response = await this.serverApi.getChanges({ since: lastSync || 0 });

      // Update last sync time
      await this.offlineSync.setMetadata('lastServerSync', Date.now());

      return response.changes || [];
      } catch (_error) {
        console.error('Failed to fetch remote changes:', _error);
        return [];
      }
  }

  /**
   * Sync changes with connected peers
   */
  private async syncWithPeers(changes: OfflineChange[]): Promise<void> {
    const peers = this.p2pSync.getConnectedPeers();

    for (const peer of peers) {
      try {
        await this.p2pSync.sendChangesToPeer(peer.id, changes);
      } catch (_error) {
        console.warn(`Failed to sync with peer ${peer.id}:`, _error);
      }
    }
  }

  /**
   * Auto-resolve conflicts
   */
  private async autoResolveConflicts(conflicts: SyncConflict[], strategy: 'local' | 'remote'): Promise<void> {
    for (const conflict of conflicts) {
      const resolution = strategy === 'local' ? 'local' : 'remote';
      await this.offlineSync.resolveConflict(conflict.id, resolution);
    }
  }

  /**
   * Wait for manual conflict resolution
   */
  private async waitForConflictResolution(conflicts: SyncConflict[], timeout: number = 30000): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkResolution = async () => {
        const unresolvedCount = conflicts.filter((c) => !c.resolvedAt).length;

        if (unresolvedCount === 0) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          // Timeout waiting for resolution - proceed anyway
          resolve();
        } else {
          // Check again in 1 second
          setTimeout(checkResolution, 1000);
        }
      };

      checkResolution();
    });
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<{
    isOnline: boolean;
    isReconnecting: boolean;
    unsyncedCount: number;
    conflictCount: number;
  }> {
    const status = await this.offlineSync.getSyncStatus();

    return {
      isOnline: status.isOnline,
      isReconnecting: this.isReconnecting,
      unsyncedCount: status.unsyncedCount,
      conflictCount: status.conflictCount,
    };
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Unregister event listener
   */
  off(event: string, listener: (data: any) => void): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  }

  /**
   * Resolve conflict manually
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merged',
    mergedData?: Record<string, unknown>
  ): Promise<void> {
    await this.offlineSync.resolveConflict(conflictId, resolution, mergedData);
  }
}
