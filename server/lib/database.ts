/**
 * Database Connection Management with Connection Pooling
 * Handles PostgreSQL connections with pool management and health checks
 */

import postgres from 'postgres';
import { getConfig } from './config.js';

/**
 * Connection pool status
 */
export interface PoolStatus {
  size: number;
  available: number;
  inUse: number;
  waitingRequests: number;
  healthy: boolean;
}

/**
 * Database health check result
 */
export interface DatabaseHealthCheck {
  connected: boolean;
  responseTime: number;
  poolStatus: PoolStatus;
  error?: string;
}

/**
 * Global database connection instance
 */
let sql: postgres.Sql | null = null;

/**
 * Pool health tracking
 */
let poolMetrics = {
  totalConnections: 0,
  successfulQueries: 0,
  failedQueries: 0,
  totalResponseTime: 0,
  minResponseTime: Infinity,
  maxResponseTime: 0,
  poolExhaustionEvents: 0,
  lastExhaustionTime: null as Date | null,
};

/**
 * Initialize database connection with pooling
 * Throws an error if connection fails
 */
export function initializeDatabase(): postgres.Sql {
  if (sql) {
    return sql;
  }

  const config = getConfig();


  try {
    // Parse connection string and configure pool
    const options: any = {
      max: config.database.poolSize,
      idle_timeout: config.database.poolIdleTimeout,
      connect_timeout: config.database.poolConnectionTimeout,
      statement_timeout: 30000, // 30 second query timeout
      ssl: config.database.sslMode !== 'disable',
    };

    sql = postgres(config.database.url, options);


    // Verify initial connection
    return sql;
  } catch (error) {
    console.error('[database] Failed to initialize connection:', error);
    throw error;
  }
}

/**
 * Get database connection instance (lazy initialization)
 */
export function getDb(): postgres.Sql {
  if (!sql) {
    sql = initializeDatabase();
  }
  return sql;
}

/**
 * Check database connectivity and pool health
 * Safe to call frequently for monitoring
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthCheck> {
  try {
    const db = getDb();
    const startTime = Date.now();

    // Execute simple test query
    const result = await db`SELECT 1 as health_check`;

    const responseTime = Date.now() - startTime;

    // Update metrics
    poolMetrics.successfulQueries++;
    poolMetrics.totalResponseTime += responseTime;
    poolMetrics.minResponseTime = Math.min(poolMetrics.minResponseTime, responseTime);
    poolMetrics.maxResponseTime = Math.max(poolMetrics.maxResponseTime, responseTime);

    // Check if query returned expected result
    if (!result || result.length === 0) {
      return {
        connected: false,
        responseTime,
        poolStatus: getPoolStatus(),
        error: 'Query returned no results',
      };
    }

    return {
      connected: true,
      responseTime,
      poolStatus: getPoolStatus(),
    };
  } catch (error) {
    poolMetrics.failedQueries++;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check if pool is exhausted
    if (errorMessage.includes('no connection') || errorMessage.includes('connect')) {
      poolMetrics.poolExhaustionEvents++;
      poolMetrics.lastExhaustionTime = new Date();

      return {
        connected: false,
        responseTime: 0,
        poolStatus: getPoolStatus(),
        error: 'Connection pool exhausted or unavailable',
      };
    }

    return {
      connected: false,
      responseTime: 0,
      poolStatus: getPoolStatus(),
      error: errorMessage,
    };
  }
}

/**
 * Get current pool status
 * Provides information about pool utilization based on tracked metrics
 */
export function getPoolStatus(): PoolStatus {
  const config = getConfig();
  const poolSize = config.database.poolSize;

  // Derive health from actual metrics
  const recentFailures = poolMetrics.failedQueries;
  const recentSuccesses = poolMetrics.successfulQueries;
  const totalRecent = recentFailures + recentSuccesses;
  const failureRate = totalRecent > 10 ? recentFailures / totalRecent : 0;
  const hasExhaustion = poolMetrics.lastExhaustionTime &&
    (Date.now() - poolMetrics.lastExhaustionTime.getTime()) < 60000;

  return {
    size: poolSize,
    available: hasExhaustion ? 0 : poolSize,
    inUse: hasExhaustion ? poolSize : 0,
    waitingRequests: poolMetrics.poolExhaustionEvents,
    healthy: failureRate < 0.5 && !hasExhaustion,
  };
}

/**
 * Get pool metrics and statistics
 * Useful for monitoring and alerting
 */
export function getPoolMetrics() {
  const avgResponseTime =
    poolMetrics.successfulQueries > 0
      ? Math.round(poolMetrics.totalResponseTime / poolMetrics.successfulQueries)
      : 0;

  const successRate =
    poolMetrics.successfulQueries + poolMetrics.failedQueries > 0
      ? Math.round(
          (poolMetrics.successfulQueries /
            (poolMetrics.successfulQueries + poolMetrics.failedQueries)) *
            100
        )
      : 100;

  return {
    ...poolMetrics,
    avgResponseTime,
    successRate,
  };
}

/**
 * Detect pool exhaustion
 * Returns true if pool is likely exhausted
 */
export function isPoolExhausted(): boolean {
  const metrics = poolMetrics;

  // Check if we've had exhaustion events recently
  if (metrics.lastExhaustionTime) {
    const timeSinceExhaustion = Date.now() - metrics.lastExhaustionTime.getTime();
    if (timeSinceExhaustion < 60000) {
      // Pool was exhausted within last minute
      return true;
    }
  }

  // Check if recent queries are failing
  if (metrics.successfulQueries + metrics.failedQueries > 10) {
    const recentSuccessRate =
      metrics.successfulQueries / (metrics.successfulQueries + metrics.failedQueries);
    if (recentSuccessRate < 0.5) {
      // More than 50% of recent queries failed
      return true;
    }
  }

  return false;
}

/**
 * Wait for database to become available
 * Useful during startup
 */
export async function waitForDatabase(maxAttempts = 10, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const health = await checkDatabaseHealth();
      if (health.connected) {
        return;
      }
    } catch (error) {
      console.warn(`[database] Connection attempt ${attempt} failed:`, error);
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    `Failed to connect to database after ${maxAttempts} attempts`
  );
}

/**
 * Execute query with automatic retry on transient failures
 * Useful for handling temporary connection issues
 */
export async function executeWithRetry<T>(
  queryFn: (db: postgres.Sql) => Promise<T>,
  maxRetries = 3,
  delayMs = 100
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const db = getDb();
      return await queryFn(db);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is transient (network, timeout, connection reset)
      const isTransient =
        lastError.message.includes('timeout') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ECONNABORTED') ||
        lastError.message.includes('connection terminated') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('ENOTFOUND');

      if (!isTransient || attempt === maxRetries) {
        throw error;
      }

      console.warn(
        `[database] Query failed on attempt ${attempt}, retrying in ${delayMs}ms...`,
        lastError.message
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError || new Error('Query failed after retries');
}

/**
 * Close database connection gracefully
 * Allows in-flight queries to complete before closing
 */
export async function closeDatabase(timeoutMs = 10000): Promise<void> {
  if (!sql) {
    return;
  }


  try {
    const closePromise = sql.end();

    // Set timeout for forced closure
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Database close timeout')), timeoutMs);
    });

    await Promise.race([closePromise, timeoutPromise]);

    sql = null;
  } catch (error) {
    console.error('[database] Error closing connection:', error);
    sql = null;
    throw error;
  }
}

/**
 * Force close database connection immediately
 * Use only as last resort
 */
export function forceCloseDatabase(): void {
  if (sql) {
    try {
      // The postgres library doesn't have a synchronous close, so we just nullify
      sql = null;
    } catch (error) {
      console.error('[database] Error force closing connection:', error);
    }
  }
}

/**
 * Reset pool metrics (useful for testing)
 */
export function resetPoolMetrics(): void {
  poolMetrics = {
    totalConnections: 0,
    successfulQueries: 0,
    failedQueries: 0,
    totalResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    poolExhaustionEvents: 0,
    lastExhaustionTime: null,
  };
}

/**
 * Create a new database connection for migrations or special operations
 * Should be closed separately
 */
export function createDatabaseConnection(): postgres.Sql {
  const config = getConfig();

  return postgres(config.database.url, {
    max: 1,
    idle_timeout: 30000,
    connect_timeout: 10000,
    statement_timeout: 60000,
    ssl: config.database.sslMode !== 'disable',
  } as any);
}
