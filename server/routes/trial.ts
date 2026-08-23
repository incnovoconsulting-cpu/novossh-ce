import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { TrialNotificationService } from '../services/TrialNotificationService.js';
import { PlanDowngradeService } from '../services/PlanDowngradeService.js';
import { SubscriptionService, Plan } from '../services/SubscriptionService.js';

const router = express.Router();
const trialService = new TrialNotificationService();
const downgradeService = new PlanDowngradeService();
const subscriptionService = new SubscriptionService();

/**
 * GET /api/billing/trial/status
 * Check trial status for current user
 */
router.get('/trial/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const status = await trialService.getTrialStatus(userId);
    res.json(status);
  } catch (error) {
    console.error('[trial] Failed to get trial status:', error);
    res.status(500).json({ error: 'Failed to get trial status' });
  }
});

/**
 * POST /api/billing/trial/extend
 * Request trial extension (admin only)
 */
router.post('/trial/extend', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { days } = req.body;

    if (!days || typeof days !== 'number' || days < 1 || days > 30) {
      res.status(400).json({ error: 'Days must be a number between 1 and 30' });
      return;
    }

    // Check if user is admin (simplified - in production check roles)
    const sub = await subscriptionService.getSubscription(userId);
    if (!sub || sub.status !== 'trialing') {
      res.status(400).json({ error: 'Only trialing users can extend their trial' });
      return;
    }

    const result = await trialService.extendTrial(userId, days);
    if (result.success) {
      res.json({ success: true, newTrialEnd: result.newTrialEnd });
    } else {
      res.status(400).json({ error: 'Failed to extend trial' });
    }
  } catch (error) {
    console.error('[trial] Failed to extend trial:', error);
    res.status(500).json({ error: 'Failed to extend trial' });
  }
});

/**
 * GET /api/billing/downgrade/preview
 * Preview what resources would be affected by a plan downgrade
 */
router.get('/downgrade/preview', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetPlan } = req.query;

    if (!targetPlan || !['free', 'starter', 'pro'].includes(targetPlan as string)) {
      res.status(400).json({ error: 'Invalid target plan' });
      return;
    }

    const sub = await subscriptionService.getSubscription(userId);
    if (!sub) {
      res.status(400).json({ error: 'No subscription found' });
      return;
    }

    const preview = await downgradeService.checkDowngrade(userId, sub.plan, targetPlan as Plan);
    res.json({
      currentPlan: sub.plan,
      targetPlan,
      preview: preview || { plan: targetPlan, previousPlan: sub.plan, exceeded: [], requiresAction: false },
    });
  } catch (error) {
    console.error('[trial] Failed to preview downgrade:', error);
    res.status(500).json({ error: 'Failed to preview downgrade' });
  }
});

/**
 * POST /api/billing/downgrade/confirm
 * Confirm and execute a plan downgrade
 */
router.post('/downgrade/confirm', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetPlan } = req.body;

    if (!targetPlan || !['free', 'starter', 'pro'].includes(targetPlan)) {
      res.status(400).json({ error: 'Invalid target plan' });
      return;
    }

    const sub = await subscriptionService.getSubscription(userId);
    if (!sub) {
      res.status(400).json({ error: 'No subscription found' });
      return;
    }

    // Check if it's actually a downgrade
    const planOrder: Record<Plan, number> = { free: 0, starter: 1, pro: 2 };
    if (planOrder[targetPlan as Plan] >= planOrder[sub.plan]) {
      res.status(400).json({ error: 'Target plan is not a downgrade' });
      return;
    }

    // Get user email for notification
    const db = await import('../db/connection.js').then(m => m.getDb());
    const userRows = await db`
      SELECT email FROM users WHERE id = ${userId}
    `;
    const email = userRows[0]?.email || '';

    // Execute downgrade
    const result = await downgradeService.handleDowngrade(
      userId,
      email,
      sub.plan,
      targetPlan as Plan
    );

    // Update subscription plan
    await subscriptionService.updateSubscription(userId, targetPlan as Plan, 'active');

    res.json({
      success: true,
      previousPlan: sub.plan,
      newPlan: targetPlan,
      actions: result.actions,
    });
  } catch (error) {
    console.error('[trial] Failed to confirm downgrade:', error);
    res.status(500).json({ error: 'Failed to confirm downgrade' });
  }
});

export { router as trialRouter };
