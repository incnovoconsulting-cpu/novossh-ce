import express from 'express';
import { VaultService } from '../services/VaultService.js';
import { SyncService } from '../services/SyncService.js';
import { ShareService } from '../services/ShareService.js';
import { AuditService } from '../services/AuditService.js';
import { createAuditTracker } from '../middleware/auditTracker.js';
import { SubscriptionService, PLAN_LIMITS } from '../services/SubscriptionService.js';

const router = express.Router();

// Export service instances for testing (allows mocking in tests)
export const vaultService = new VaultService();
export const syncService = new SyncService();
export const shareService = new ShareService();
export const auditService = new AuditService();
export const auditTracker = createAuditTracker(auditService);
const subscriptionService = new SubscriptionService();

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// POST /api/vaults - Create vault
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    if (!name) {
      res.status(400).json({ error: 'Vault name is required' });
      return;
    }

    const sub = await subscriptionService.getSubscription(user.id);
    const plan = sub?.plan ?? 'free';
    const limit = PLAN_LIMITS[plan].vaults;

    // Increment atomically first, then check — prevents race condition
    const newCount = await subscriptionService.incrementUsage(user.id, 'vaults');
    if (newCount > limit) {
      await subscriptionService.decrementUsage(user.id, 'vaults');
      res.status(403).json({ error: 'Vault limit reached', current: newCount - 1, limit });
      return;
    }

    const vault = await vaultService.createVault(
      user.organizationId!,
      user.id,
      name,
      description
    );

    res.status(201).json(vault);
  } catch (error) {
    console.error('Failed to create vault:', error);
    res.status(500).json({ error: 'Failed to create vault' });
  }
});

// GET /api/vaults - List user's vaults
router.get('/', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const vaults = await vaultService.listVaults(user.organizationId!, user.id);
    res.json(vaults);
  } catch (error) {
    console.error('Failed to list vaults:', error);
    res.status(500).json({ error: 'Failed to list vaults' });
  }
});

// GET /api/vaults/:id - Get vault details
router.get('/:id', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const vault = await vaultService.getVault(req.params.id);

    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    // Check access
    const access = await shareService.checkAccess(vault.id, user.id);
    if (!access.hasAccess && vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Log vault access (sensitive operation)
    try {
      await auditTracker.logDataAccess(
        req,
        vault.organization_id,
        'vault',
        vault.id,
        'read',
        { vaultName: vault.name, accessType: 'direct_read' }
      );
    } catch (auditError) {
      console.error('Failed to log vault access:', auditError);
    }

    res.json(vault);
  } catch (error) {
    console.error('Failed to get vault:', error);
    res.status(500).json({ error: 'Failed to get vault' });
  }
});

// PUT /api/vaults/:id - Update vault
router.put('/:id', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const vault = await vaultService.getVault(req.params.id);

    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    if (vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Only owner can update vault' });
      return;
    }

    const updated = await vaultService.updateVault(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Failed to update vault:', error);
    res.status(500).json({ error: 'Failed to update vault' });
  }
});

// DELETE /api/vaults/:id - Delete vault
router.delete('/:id', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const vault = await vaultService.getVault(req.params.id);

    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    if (vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Only owner can delete vault' });
      return;
    }

    await vaultService.deleteVault(req.params.id);
    await subscriptionService.decrementUsage(user.id, 'vaults');
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete vault:', error);
    res.status(500).json({ error: 'Failed to delete vault' });
  }
});

export { router as vaultRouter };
