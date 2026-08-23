import { EventEmitter } from 'events';

/**
 * Represents a detected conflict between local and remote versions
 */
export interface SyncConflict {
  entryId: string;
  localVersion: number;
  remoteVersion: number;
  localTimestamp: Date;
  remoteTimestamp: Date;
  resolution: 'last-write-wins' | 'manual' | 'merged';
  resolvedAt?: Date;
}

/**
 * Current sync state for a vault
 */
export interface SyncState {
  vaultId: string;
  deviceId: string;
  lastSyncAt: Date;
  isSyncing: boolean;
  pendingChanges: any[]; // VaultEntry[]
  conflicts: SyncConflict[];
  syncProgress: number; // 0-100
}

/**
 * Change log entry for tracking operations
 */
export interface SyncChange {
  entryId: string;
  operation: 'create' | 'update' | 'delete';
  timestamp: Date;
  version: number;
  deviceId: string;
}

/**
 * SyncService: Manages cross-device synchronization and conflict resolution
 *
 * Features:
 * - Real-time sync state tracking
 * - Conflict detection (version-based)
 * - Multiple resolution strategies
 * - Sync history logging
 *
 * Events emitted:
 * - 'syncStarted': When sync begins
 * - 'syncProgress': Periodic progress updates (0-100)
 * - 'syncCompleted': When sync finishes
 * - 'conflictDetected': When a conflict is found
 * - 'conflictResolved': When a conflict is resolved
 * - 'error': When an error occurs
 */
export class SyncService extends EventEmitter {
  private syncStates = new Map<string, SyncState>(); // Key: vaultId_deviceId
  private changeLog = new Map<string, SyncChange[]>(); // Changes by entry ID
  private conflicts = new Map<string, SyncConflict[]>(); // Conflicts by vault ID

  /**
   * Initialize sync state for a device
   */
  async initializeSync(vaultId: string, deviceId: string): Promise<SyncState> {
    const key = `${vaultId}_${deviceId}`;

    if (!this.syncStates.has(key)) {
      this.syncStates.set(key, {
        vaultId,
        deviceId,
        lastSyncAt: new Date(),
        isSyncing: false,
        pendingChanges: [],
        conflicts: [],
        syncProgress: 0,
      });
    }

    return this.syncStates.get(key)!;
  }

  /**
   * Start a sync operation for a vault
   */
  async startSync(vaultId: string, deviceId: string): Promise<void> {
    const state = await this.initializeSync(vaultId, deviceId);

    state.isSyncing = true;
    state.syncProgress = 0;
    this.emit('syncStarted', { vaultId, deviceId });
  }

  /**
   * Complete a sync operation
   */
  async completeSync(vaultId: string, deviceId: string): Promise<SyncState> {
    const key = `${vaultId}_${deviceId}`;
    const state = this.syncStates.get(key);

    if (!state) {
      throw new Error(`No sync state for ${key}`);
    }

    state.isSyncing = false;
    state.lastSyncAt = new Date();
    state.syncProgress = 100;
    state.pendingChanges = [];

    this.emit('syncCompleted', state);
    return state;
  }

  /**
   * Update sync progress
   */
  updateProgress(vaultId: string, deviceId: string, progress: number): void {
    const key = `${vaultId}_${deviceId}`;
    const state = this.syncStates.get(key);

    if (state) {
      state.syncProgress = Math.min(100, Math.max(0, progress));
      this.emit('syncProgress', { vaultId, deviceId, progress: state.syncProgress });
    }
  }

  /**
   * Record a change to the sync log
   */
  async recordChange(
    entryId: string,
    change: SyncChange
  ): Promise<void> {
    if (!this.changeLog.has(entryId)) {
      this.changeLog.set(entryId, []);
    }

    this.changeLog.get(entryId)!.push(change);
  }

  /**
   * Get changes since a specific timestamp
   */
  async getChanges(
    _vaultId: string,
    since: Date
  ): Promise<SyncChange[]> {
    const changes: SyncChange[] = [];

    for (const entryChanges of this.changeLog.values()) {
      for (const change of entryChanges) {
        if (change.timestamp > since) {
          changes.push(change);
        }
      }
    }

    return changes.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Detect conflicts between local and remote versions
   *
   * A conflict occurs when:
   * - Same entry modified on two devices
   * - Both changes have different content
   * - Neither version is a strict superset of the other
   */
  async detectConflicts(
    vaultId: string,
    localChanges: SyncChange[],
    remoteChanges: SyncChange[]
  ): Promise<SyncConflict[]> {
    const detected: SyncConflict[] = [];
    const entryMap = new Map<string, { local?: SyncChange; remote?: SyncChange }>();

    // Map local and remote changes by entry
    for (const change of localChanges) {
      if (!entryMap.has(change.entryId)) {
        entryMap.set(change.entryId, {});
      }
      entryMap.get(change.entryId)!.local = change;
    }

    for (const change of remoteChanges) {
      if (!entryMap.has(change.entryId)) {
        entryMap.set(change.entryId, {});
      }
      entryMap.get(change.entryId)!.remote = change;
    }

    // Detect conflicts
    for (const [entryId, { local, remote }] of entryMap.entries()) {
      // Only a conflict if both sides modified
      if (local && remote && local.operation !== 'delete' && remote.operation !== 'delete') {
        // Check if they have different versions
        if (local.version !== remote.version) {
          const conflict: SyncConflict = {
            entryId,
            localVersion: local.version,
            remoteVersion: remote.version,
            localTimestamp: local.timestamp,
            remoteTimestamp: remote.timestamp,
            resolution: 'last-write-wins', // Default strategy
          };

          detected.push(conflict);
          this.emit('conflictDetected', conflict);
        }
      }
    }

    // Store conflicts for this vault
    this.conflicts.set(vaultId, detected);
    return detected;
  }

  /**
   * Resolve a conflict using a specified strategy
   */
  async resolveConflict(
    vaultId: string,
    entryId: string,
    strategy: 'local' | 'remote' | 'merge' | 'last-write-wins'
  ): Promise<SyncConflict | null> {
    const vaultConflicts = this.conflicts.get(vaultId) || [];
    const conflictIndex = vaultConflicts.findIndex((c) => c.entryId === entryId);

    if (conflictIndex < 0) {
      return null;
    }

    const conflict = vaultConflicts[conflictIndex];

    // Determine winner based on strategy
    let winner: 'local' | 'remote';
    if (strategy === 'last-write-wins') {
      winner =
        conflict.localTimestamp > conflict.remoteTimestamp ? 'local' : 'remote';
    } else if (strategy === 'local' || strategy === 'remote') {
      winner = strategy;
    } else if (strategy === 'merge') {
      // Merge means take highest version
      winner = conflict.localVersion > conflict.remoteVersion ? 'local' : 'remote';
    } else {
      winner = 'remote';
    }

    conflict.resolution = 'manual';
    conflict.resolvedAt = new Date();

    this.emit('conflictResolved', {
      conflict,
      winner,
    });

    vaultConflicts.splice(conflictIndex, 1);
    return conflict;
  }

  /**
   * Auto-resolve conflicts using default strategy
   */
  async autoResolveConflicts(vaultId: string): Promise<SyncConflict[]> {
    const vaultConflicts = this.conflicts.get(vaultId) || [];
    const resolved: SyncConflict[] = [];

    for (const conflict of vaultConflicts) {
      // Last-write-wins by default
      const winner =
        conflict.localTimestamp > conflict.remoteTimestamp ? 'local' : 'remote';

      conflict.resolution = 'last-write-wins';
      conflict.resolvedAt = new Date();

      this.emit('conflictResolved', {
        conflict,
        winner,
      });

      resolved.push(conflict);
    }

    // Clear resolved conflicts
    this.conflicts.set(vaultId, []);
    return resolved;
  }

  /**
   * Get all conflicts for a vault
   */
  async getConflicts(vaultId: string): Promise<SyncConflict[]> {
    return this.conflicts.get(vaultId) || [];
  }

  /**
   * Get sync state for a device
   */
  async getSyncState(vaultId: string, deviceId: string): Promise<SyncState | null> {
    const key = `${vaultId}_${deviceId}`;
    return this.syncStates.get(key) || null;
  }

  /**
   * Add pending change to sync queue
   */
  async addPendingChange(
    vaultId: string,
    deviceId: string,
    change: any // VaultEntry
  ): Promise<void> {
    const key = `${vaultId}_${deviceId}`;
    const state = this.syncStates.get(key);

    if (state) {
      state.pendingChanges.push(change);
    }
  }

  /**
   * Check if sync is needed
   */
  async isSyncNeeded(
    vaultId: string,
    deviceId: string,
    maxAge: number = 30000 // 30 seconds
  ): Promise<boolean> {
    const key = `${vaultId}_${deviceId}`;
    const state = this.syncStates.get(key);

    if (!state) {
      return true; // First sync
    }

    const timeSinceSync = Date.now() - state.lastSyncAt.getTime();
    return timeSinceSync > maxAge || state.pendingChanges.length > 0;
  }

  /**
   * Clear sync state (e.g., on logout)
   */
  async clearSyncState(vaultId?: string, deviceId?: string): Promise<void> {
    if (vaultId && deviceId) {
    const key = `${vaultId}_${deviceId}`;
      this.syncStates.delete(key);
    } else {
      this.syncStates.clear();
      this.changeLog.clear();
      this.conflicts.clear();
    }
  }

  /**
   * Get sync statistics for a vault
   */
  async getSyncStats(vaultId: string): Promise<{
    totalChanges: number;
    totalConflicts: number;
    resolvedConflicts: number;
    activeDevices: number;
  }> {
    let totalChanges = 0;
    for (const changes of this.changeLog.values()) {
      totalChanges += changes.length;
    }

    const conflicts = this.conflicts.get(vaultId) || [];
    const activeDevices = Array.from(this.syncStates.keys()).filter((k) =>
      k.startsWith(`${vaultId}_`)
    ).length;

    return {
      totalChanges,
      totalConflicts: conflicts.length,
      resolvedConflicts: conflicts.filter((c) => c.resolvedAt).length,
      activeDevices,
    };
  }
}
