/**
 * Tailscale Routes
 * API endpoints for headscale integration
 */

import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requirePlan } from '../middleware/planGate.js';
import { headscaleService } from '../services/HeadscaleService.js';

const router = express.Router();

/**
 * POST /api/tailscale/auth
 * Generate a pre-auth key for the authenticated user.
 * userId comes ONLY from the verified JWT (req.user), never from the body.
 */
router.post('/auth', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Generate pre-auth key using userId from JWT
    const authKey = await headscaleService.generateAuthKey(userId);

    if (!authKey) {
      res.status(500).json({ error: 'Failed to generate auth key' });
      return;
    }

    res.json({ authKey });
  } catch (error) {
    console.error('[tailscale] Auth key generation failed:', error);
    res.status(500).json({ error: 'Failed to generate auth key' });
  }
});

/**
 * GET /api/tailscale/status
 * Check headscale connectivity and user's Tailscale IP
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const ip = await headscaleService.getNodeIP(userId);
    const healthy = await headscaleService.healthCheck();

    res.json({ healthy, ip: ip || null });
  } catch (error) {
    console.error('[tailscale] Status check failed:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

/**
 * GET /api/tailscale/nodes
 * List all nodes in the network (admin only)
 */
router.get('/nodes', authMiddleware, requirePlan('pro'), async (_req: Request, res: Response) => {
  try {
    const nodes = await headscaleService.getNodes();
    res.json({ nodes });
  } catch (error) {
    console.error('[tailscale] Failed to list nodes:', error);
    res.status(500).json({ error: 'Failed to list nodes' });
  }
});

export { router as tailscaleRouter };
