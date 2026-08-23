import { Request, Response, NextFunction } from 'express';
import { Plan, ResourceType, SubscriptionService } from '../services/SubscriptionService.js';

// Extend Express Request with subscription info
declare global {
  namespace Express {
    interface Request {
      subscription?: {
        plan: Plan;
        status: string;
      };
    }
  }
}

const subscriptionService = new SubscriptionService();

/**
 * Middleware: require minimum plan level
 * Usage: router.get('/teams', authMiddleware, requirePlan('pro'), handler)
 */
export function requirePlan(minimumPlan: Plan) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const sub = await subscriptionService.getSubscription(userId);
    const userPlan = (sub?.plan ?? 'free') as Plan;

    req.subscription = { plan: userPlan, status: sub?.status ?? 'active' };

    if (!subscriptionService.planMeetsRequired(userPlan, minimumPlan)) {
      res.status(403).json({
        error: 'Plan upgrade required',
        requiredPlan: minimumPlan,
        currentPlan: userPlan,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: check resource limit
 * Usage: router.post('/hosts', authMiddleware, checkLimit('hosts'), handler)
 */
export function checkLimit(resourceType: ResourceType) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const result = await subscriptionService.checkLimit(userId, resourceType);

    if (!result.allowed) {
      res.status(403).json({
        error: 'Resource limit reached',
        resourceType,
        current: result.current,
        limit: result.limit,
      });
      return;
    }

    next();
  };
}

export { subscriptionService };
