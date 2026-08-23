import { Request, Response, NextFunction } from 'express';
import { UsageMeterService, ResourceType } from '../services/UsageMeterService.js';

/**
 * Quota enforcement configuration
 */
export interface QuotaConfig {
  resource: ResourceType;
  costPerRequest?: number; // For API calls: cost in units (default 1)
  costFixed?: number; // For storage: total bytes (default quantity in request)
  checkOnly?: boolean; // If true, only check without enforcement (default false)
}

const meterService = new UsageMeterService();

/**
 * Middleware to check quota before operation
 * Returns 429 (Too Many Requests) if quota exceeded
 *
 * Usage:
 *   router.post('/api/command', checkQuotaBefore({ resource: 'api_calls' }), commandHandler);
 */
export async function checkQuotaBefore(config: QuotaConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const status = await meterService.getQuotaStatus(userId, config.resource);

      // Check if quota exceeded
      if (status.exceeded) {
        // Store quota info on request for response handling
        req.quotaExceeded = {
          resource: config.resource,
          current: status.currentUsage,
          limit: status.hardLimit,
          percent: status.usagePercent,
        };

        // Return 429 Too Many Requests
        return res.status(429).json({
          error: 'Quota exceeded',
          resource: config.resource,
          currentUsage: status.currentUsage,
          hardLimit: status.hardLimit,
          usagePercent: status.usagePercent,
          retryAfter: null, // Could calculate based on plan renewal date
        });
      }

      // Warn if nearing limit
      if (status.status === 'critical' || status.status === 'warning') {
        req.quotaWarning = {
          resource: config.resource,
          current: status.currentUsage,
          limit: status.hardLimit,
          percent: status.usagePercent,
          status: status.status,
        };
      }

      next();
    } catch (error) {
      console.error('[quotaEnforcement] checkQuotaBefore failed:', error);
      // Don't fail the request on error - log and continue
      next();
    }
  };
}

/**
 * Middleware to check quota after operation
 * Records the usage and generates alerts if needed
 *
 * Usage:
 *   router.post('/api/command', checkQuotaBefore(...), commandHandler, checkQuotaAfter(...));
 */
export async function checkQuotaAfter(config: QuotaConfig) {
  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return _next();
      }

      // Check if operation succeeded
      const statusCode = res.statusCode;
      if (statusCode >= 400) {
        // Don't meter failed requests
        return _next();
      }

      // Calculate usage quantity
      let quantity = config.costPerRequest || 1;
      if (config.costFixed) {
        quantity = config.costFixed;
      } else if (req.body?.quantity) {
        quantity = parseInt(req.body.quantity, 10) || 1;
      }

      // Map resource type to event type
      const eventType = config.resource === 'api_calls' ? 'api_call' : config.resource;

      // Record the usage event
      await meterService.recordUsageEvent({
        userId,
        eventType: eventType as any,
        resourceType: config.resource,
        quantity,
        unit: config.resource === 'storage_bytes' || config.resource === 'sftp_bytes' ? 'bytes' : config.resource === 'session_minutes' ? 'minutes' : 'calls',
        metadata: {
          endpoint: req.path,
          method: req.method,
          statusCode,
        },
      });

      // Check if quota is now exceeded or near limit
      const status = await meterService.getQuotaStatus(userId, config.resource);

      if (status.exceeded && status.usagePercent >= 100) {
        // Generate hard limit alert
        await meterService.recordQuotaAlert(
          userId,
          config.resource,
          'hard_limit',
          status.currentUsage,
          status.hardLimit
        );

        // Add header to response
        res.setHeader('X-Quota-Status', 'exceeded');
        res.setHeader('X-Quota-Usage', status.currentUsage.toString());
        res.setHeader('X-Quota-Limit', status.hardLimit.toString());
      } else if (status.status === 'critical' && status.usagePercent >= 95) {
        // Generate critical alert
        await meterService.recordQuotaAlert(
          userId,
          config.resource,
          'critical',
          status.currentUsage,
          status.hardLimit
        );

        res.setHeader('X-Quota-Status', 'critical');
        res.setHeader('X-Quota-Usage', status.currentUsage.toString());
        res.setHeader('X-Quota-Limit', status.hardLimit.toString());
      } else if (status.status === 'warning' && status.usagePercent >= 80) {
        // Generate warning alert
        await meterService.recordQuotaAlert(
          userId,
          config.resource,
          'soft_warning',
          status.currentUsage,
          status.hardLimit
        );

        res.setHeader('X-Quota-Status', 'warning');
        res.setHeader('X-Quota-Usage', status.currentUsage.toString());
        res.setHeader('X-Quota-Limit', status.hardLimit.toString());
      }

      _next();
    } catch (error) {
      console.error('[quotaEnforcement] checkQuotaAfter failed:', error);
      // Don't fail the request on error - log and continue
      _next();
    }
  };
}

/**
 * Pre-check quota without enforcement (monitoring only)
 * Useful for rate limiting or analytics
 */
export async function getQuotaStatus(req: Request, res: Response, _next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const resource = (req.query.resource as ResourceType) || 'api_calls';
    const status = await meterService.getQuotaStatus(userId, resource);

    res.json({
      resource,
      ...status,
    });
  } catch (error) {
    console.error('[quotaEnforcement] getQuotaStatus failed:', error);
    res.status(500).json({ error: 'Failed to get quota status' });
  }
}

/**
 * Declare custom properties on Express Request
 */
declare global {
  namespace Express {
    interface Request {
      quotaExceeded?: {
        resource: ResourceType;
        current: number;
        limit: number;
        percent: number;
      };
      quotaWarning?: {
        resource: ResourceType;
        current: number;
        limit: number;
        percent: number;
        status: 'warning' | 'critical';
      };
    }
  }
}

export default {
  checkQuotaBefore,
  checkQuotaAfter,
  getQuotaStatus,
};
