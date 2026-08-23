import { getDb } from '../db/connection.js';

const RETENTION_DAYS = 90;

export class ConnectionCleanupService {
  private db = getDb();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  async cleanupOldAttempts(): Promise<{ deleted: number }> {
    try {
      const result = await this.db`
        DELETE FROM connection_attempts
        WHERE completed_at < NOW() - (${RETENTION_DAYS} * INTERVAL '1 day')
      `;
      const deleted = (result as any).count ?? 0;
      console.log(`ConnectionCleanupService: deleted ${deleted} attempts older than ${RETENTION_DAYS} days`);
      return { deleted };
    } catch (err) {
      console.error('ConnectionCleanupService: failed to clean up old attempts:', err);
      return { deleted: 0 };
    }
  }

  startPeriodicCleanup(intervalMs: number = 24 * 60 * 60 * 1000): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
    this.intervalHandle = setInterval(() => {
      this.cleanupOldAttempts().catch((err) => {
        console.error('ConnectionCleanupService: periodic cleanup failed:', err);
      });
    }, intervalMs);
    console.log(`ConnectionCleanupService: periodic cleanup started (every ${intervalMs / 1000}s)`);
  }

  stopPeriodicCleanup(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log('ConnectionCleanupService: periodic cleanup stopped');
    }
  }
}

export const connectionCleanupService = new ConnectionCleanupService();
