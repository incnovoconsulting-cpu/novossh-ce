import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';

const router = Router();

interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
}

interface DetailedHealthResponse extends HealthResponse {
  checks: {
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      responseTime: number;
      poolSize?: number;
      activeConnections?: number;
      error?: string;
    };
    memory: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      heapUsedMB: number;
      heapTotalMB: number;
      externalMB: number;
      percentUsed: number;
    };
    uptime: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      seconds: number;
      minutes: number;
      hours: number;
    };
    database_pool?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      size: number;
      available: number;
      inUse: number;
      waitingRequests: number;
    };
  };
}

const startTime = Date.now();

/**
 * Basic health check endpoint for load balancers
 * GET /api/health
 * Response time < 100ms
 */
router.get('/', (_req: Request, res: Response) => {
  const response: HealthResponse = {
    ok: true,
    service: 'novossh',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  res.status(200).json(response);
});

/**
 * Detailed health check for operations team
 * Checks database connectivity, memory usage, and pool status
 * GET /api/health/detailed
 */
router.get('/detailed', async (req: Request, res: Response) => {
  // Require admin API key for detailed health check
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.HEALTH_API_KEY;
  if (!expectedKey || apiKey !== expectedKey) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const externalMB = Math.round((memUsage.external || 0) / 1024 / 1024);
  const percentUsed = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

  // Check memory health
  const memoryStatus =
    percentUsed > 90 ? 'unhealthy' : percentUsed > 75 ? 'degraded' : 'healthy';

  // Check uptime (restart if > 7 days indicates potential issues)
  const uptimeStatus =
    uptime > 604800 ? 'degraded' : uptime > 86400 ? 'healthy' : 'healthy';

  // Database health check
  let dbStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  let dbResponseTime = 0;
  let dbError: string | undefined;
  let poolSize = 0;
  let activeConnections = 0;

  try {
    const db = getDb();
    const dbStartTime = Date.now();

    // Simple query to test connectivity
    const result = await db`SELECT 1 as connected`;

    dbResponseTime = Date.now() - dbStartTime;
    dbStatus = dbResponseTime > 1000 ? 'degraded' : 'healthy';

    // Try to get pool stats (postgres library exposes count)
    if (typeof (db as any).count === 'number') {
      activeConnections = (db as any).count || 0;
      poolSize = parseInt(process.env.DB_POOL_SIZE || '20');
    }

    if (!result || result.length === 0) {
      dbStatus = 'unhealthy';
      dbError = 'Query returned no results';
    }
  } catch (error) {
    dbStatus = 'unhealthy';
    dbError = error instanceof Error ? error.message : 'Unknown error';
    dbResponseTime = Date.now();
  }

  // Determine overall status
  const overallStatus =
    dbStatus === 'unhealthy' || memoryStatus === 'unhealthy'
      ? 'unhealthy'
      : dbStatus === 'degraded' || memoryStatus === 'degraded'
        ? 'degraded'
        : 'healthy';

  const response: DetailedHealthResponse = {
    ok: overallStatus === 'healthy',
    service: 'novossh',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    uptime,
    checks: {
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
        poolSize,
        activeConnections,
        error: dbError,
      },
      memory: {
        status: memoryStatus,
        heapUsedMB,
        heapTotalMB,
        externalMB,
        percentUsed,
      },
      uptime: {
        status: uptimeStatus,
        seconds: uptime,
        minutes: Math.floor(uptime / 60),
        hours: Math.floor(uptime / 3600),
      },
      database_pool: {
        status:
          activeConnections > poolSize * 0.9
            ? 'degraded'
            : activeConnections > poolSize * 0.95
              ? 'unhealthy'
              : 'healthy',
        size: poolSize,
        available: Math.max(0, poolSize - activeConnections),
        inUse: activeConnections,
        waitingRequests: 0, // Would require db connection pool stats
      },
    },
  };

  // Set HTTP status based on health
  const statusCode =
    overallStatus === 'unhealthy'
      ? 503 // Service Unavailable
      : overallStatus === 'degraded'
        ? 200 // OK but degraded
        : 200; // OK

  res.status(statusCode).json(response);
});

/**
 * Startup readiness check
 * GET /api/health/ready
 * Returns 200 only when fully initialized
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Check database connectivity
    const db = getDb();
    await db`SELECT 1`;

    // Check environment
    const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = requiredEnv.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      return res.status(503).json({
        ok: false,
        reason: `Missing environment variables: ${missing.join(', ')}`,
      });
    }

    res.status(200).json({
      ok: true,
      message: 'Service is ready to accept traffic',
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      reason: 'Database not ready',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Liveness check for Kubernetes
 * GET /api/health/live
 * Returns 200 if process is still running
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    message: 'Service is alive',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Metrics endpoint for Prometheus scraping
 * GET /api/health/metrics
 * Returns Prometheus-formatted metrics
 */
router.get('/metrics', (_req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  const metrics = `# HELP novossh_uptime_seconds Service uptime in seconds
# TYPE novossh_uptime_seconds gauge
novossh_uptime_seconds ${uptime}

# HELP novossh_memory_heap_bytes Heap memory usage in bytes
# TYPE novossh_memory_heap_bytes gauge
novossh_memory_heap_bytes_used ${memUsage.heapUsed}
novossh_memory_heap_bytes_total ${memUsage.heapTotal}

# HELP novossh_memory_external_bytes External memory usage in bytes
# TYPE novossh_memory_external_bytes gauge
novossh_memory_external_bytes ${memUsage.external || 0}

# HELP novossh_version Service version
# TYPE novossh_version gauge
novossh_version{version="0.1.0"} 1
`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(metrics);
});

export { router as healthRouter };
