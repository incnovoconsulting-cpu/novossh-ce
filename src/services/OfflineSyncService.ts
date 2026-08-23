export interface OfflineChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId: string;
  data: Record<string, unknown>;
  timestamp: number;
  deviceId: string;
  synced: boolean;
  syncedAt?: number;
}

export interface SyncConflict {
  id: string;
  resourceId: string;
  resourceType: string;
  localChange: OfflineChange;
  remoteChange: OfflineChange;
  resolvedAt?: number;
  resolution?: 'local' | 'remote' | 'merged';
}

export interface SyncQueueItem {
  id: string;
  changes: OfflineChange[];
  target: 'server' | 'peer';
  peerId?: string;
  createdAt: number;
  sentAt?: number;
  status: 'pending' | 'sent' | 'failed';
  retries: number;
}

const DB_NAME = 'novossh-offline';
const DB_VERSION = 1;
const STORES = {
  changes: 'changes',
  conflicts: 'conflicts',
  syncQueue: 'syncQueue',
  metadata: 'metadata',
};

export class OfflineSyncService {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = navigator.onLine;
  private deviceId: string;

  constructor(deviceId: string = this.generateDeviceId()) {
    this.deviceId = deviceId;
    this.initializeEventListeners();
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.changes)) {
          db.createObjectStore(STORES.changes, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.conflicts)) {
          db.createObjectStore(STORES.conflicts, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.syncQueue)) {
          db.createObjectStore(STORES.syncQueue, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.metadata)) {
          db.createObjectStore(STORES.metadata, { keyPath: 'key' });
        }
      };
    });
  }

  async recordChange(
    type: 'create' | 'update' | 'delete',
    resourceType: string,
    resourceId: string,
    data: Record<string, unknown>
  ): Promise<OfflineChange> {
    if (!this.db) throw new Error('Database not initialized');

    const change: OfflineChange = {
      id: this.generateId(),
      type,
      resourceType,
      resourceId,
      data,
      timestamp: Date.now(),
      deviceId: this.deviceId,
      synced: false,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.changes], 'readwrite');
      const store = tx.objectStore(STORES.changes);
      const request = store.add(change);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(change);
    });
  }

  async getUnsyncedChanges(): Promise<OfflineChange[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.changes], 'readonly');
      const store = tx.objectStore(STORES.changes);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const changes = (request.result as OfflineChange[]).filter((c) => !c.synced);
        resolve(changes);
      };
    });
  }

  async getAllChanges(): Promise<OfflineChange[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.changes], 'readonly');
      const store = tx.objectStore(STORES.changes);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as OfflineChange[]);
    });
  }

  async markAsSynced(changeId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.changes], 'readwrite');
      const store = tx.objectStore(STORES.changes);

      const getRequest = store.get(changeId);
      getRequest.onsuccess = () => {
        const change = getRequest.result as OfflineChange | undefined;
        if (change) {
          change.synced = true;
          change.syncedAt = Date.now();
          const updateRequest = store.put(change);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve();
        } else {
          // Change not found — resolve (idempotent, not an error)
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async detectConflicts(remoteChanges: OfflineChange[]): Promise<SyncConflict[]> {
    const localChanges = await this.getAllChanges();
    const conflicts: SyncConflict[] = [];

    for (const remoteChange of remoteChanges) {
      const conflictingLocal = localChanges.filter(
        (local) =>
          local.resourceType === remoteChange.resourceType &&
          local.resourceId === remoteChange.resourceId &&
          local.timestamp > remoteChange.timestamp
      );

      for (const localChange of conflictingLocal) {
        conflicts.push({
          id: this.generateId(),
          resourceId: remoteChange.resourceId,
          resourceType: remoteChange.resourceType,
          localChange,
          remoteChange,
        });
      }
    }

    return conflicts;
  }

  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merged',
    mergedData?: Record<string, unknown>
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.conflicts], 'readwrite');
      const store = tx.objectStore(STORES.conflicts);
      const getRequest = store.get(conflictId);

      getRequest.onsuccess = () => {
        const conflict = getRequest.result as SyncConflict | undefined;
        if (conflict) {
          conflict.resolvedAt = Date.now();
          conflict.resolution = resolution;

          if (resolution === 'merged' && mergedData) {
            conflict.localChange.data = mergedData;
          }

          const updateRequest = store.put(conflict);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve();
        } else {
          resolve(); // Not found — idempotent
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async addToSyncQueue(
    changes: OfflineChange[],
    target: 'server' | 'peer' = 'server',
    peerId?: string
  ): Promise<SyncQueueItem> {
    if (!this.db) throw new Error('Database not initialized');

    const queueItem: SyncQueueItem = {
      id: this.generateId(),
      changes,
      target,
      peerId,
      createdAt: Date.now(),
      status: 'pending',
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.syncQueue], 'readwrite');
      const store = tx.objectStore(STORES.syncQueue);
      const request = store.add(queueItem);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(queueItem);
    });
  }

  async getPendingSyncQueue(): Promise<SyncQueueItem[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.syncQueue], 'readonly');
      const store = tx.objectStore(STORES.syncQueue);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const items = (request.result as SyncQueueItem[]).filter((item) => item.status === 'pending');
        resolve(items);
      };
    });
  }

  async markQueueItemSent(queueId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.syncQueue], 'readwrite');
      const store = tx.objectStore(STORES.syncQueue);
      const getRequest = store.get(queueId);

      getRequest.onsuccess = () => {
        const item = getRequest.result as SyncQueueItem | undefined;
        if (item) {
          item.status = 'sent';
          item.sentAt = Date.now();
          const updateRequest = store.put(item);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve();
        } else {
          resolve(); // Not found — idempotent
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async getMetadata(key: string): Promise<unknown> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.metadata], 'readonly');
      const store = tx.objectStore(STORES.metadata);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value);
    });
  }

  async setMetadata(key: string, value: unknown): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.metadata], 'readwrite');
      const store = tx.objectStore(STORES.metadata);
      const request = store.put({ key, value });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getSyncStatus(): Promise<{
    isOnline: boolean;
    unsyncedCount: number;
    conflictCount: number;
    queuedCount: number;
  }> {
    const unsynced = await this.getUnsyncedChanges();
    const queue = await this.getPendingSyncQueue();
    const conflicts = await this.getConflicts();

    return {
      isOnline: this.isOnline,
      unsyncedCount: unsynced.length,
      conflictCount: conflicts.length,
      queuedCount: queue.length,
    };
  }

  private async getConflicts(): Promise<SyncConflict[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.conflicts], 'readonly');
      const store = tx.objectStore(STORES.conflicts);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as SyncConflict[]);
    });
  }

  async clearSyncedChanges(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.changes], 'readwrite');
      const store = tx.objectStore(STORES.changes);

      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const changes = getAllRequest.result as OfflineChange[];
        const toDelete = changes.filter(c => c.synced);
        if (toDelete.length === 0) {
          resolve();
          return;
        }
        let remaining = toDelete.length;
        for (const change of toDelete) {
          const deleteRequest = store.delete(change.id);
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onsuccess = () => {
            remaining--;
            if (remaining === 0) resolve();
          };
        }
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  private handleOnline = (): void => {
    this.isOnline = true;
    window.dispatchEvent(new CustomEvent('offlineSync:online'));
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    window.dispatchEvent(new CustomEvent('offlineSync:offline'));
  };

  private initializeEventListeners(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  /**
   * Remove event listeners and close the database connection.
   * Call this when the service is no longer needed to prevent memory leaks.
   */
  dispose(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private generateId(): string {
    return `${this.deviceId}-${Date.now()}-${crypto.randomUUID()}`;
  }

  private generateDeviceId(): string {
    const stored = localStorage.getItem('novossh-device-id');
    if (stored) return stored;

    const deviceId = `device-${crypto.randomUUID()}`;
    localStorage.setItem('novossh-device-id', deviceId);
    return deviceId;
  }

  isConnected(): boolean {
    return this.isOnline;
  }

  getDeviceId(): string {
    return this.deviceId;
  }
}
