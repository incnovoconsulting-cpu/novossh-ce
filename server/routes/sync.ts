import express from 'express';
import { VaultService } from '../services/VaultService.js';
import { SyncService } from '../services/SyncService.js';
import { ShareService } from '../services/ShareService.js';
import { syncRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

export const vaultService = new VaultService();
export const syncService = new SyncService();
export const shareService = new ShareService();

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// GET /api/vaults/:vaultId/sync - Get sync state and changes
router.get('/:vaultId/sync', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const since = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const vault = await vaultService.getVault(req.params.vaultId);
    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    const access = await shareService.checkAccess(vault.id, user.id);
    if (!access.hasAccess && vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const changes = await syncService.getChanges(req.params.vaultId, since);
    const stats = await syncService.getSyncStats(req.params.vaultId);

    res.json({
      lastSyncAt: vault.last_modified_at,
      pendingChanges: changes,
      conflicts: stats.totalConflicts,
      syncStats: stats,
    });
  } catch (error) {
    console.error('Failed to get sync state:', error);
    res.status(500).json({ error: 'Failed to get sync state' });
  }
});

// POST /api/vaults/:vaultId/sync - Push changes
router.post('/:vaultId/sync', syncRateLimit, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const deviceId = (req.headers['x-device-id'] as string) || 'device-1';
    const { changes } = req.body;

    const vault = await vaultService.getVault(req.params.vaultId);
    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    const access = await shareService.checkAccess(vault.id, user.id);
    if (!access.hasAccess && vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!Array.isArray(changes)) {
      res.status(400).json({ error: 'Changes must be an array' });
      return;
    }

    // Record all changes in sync log
    for (const change of changes) {
      await syncService.recordChange(
        req.params.vaultId,
        user.id,
        deviceId,
        change.operation,
        change.entryId,
        change.previousVersion,
        change.newVersion
      );
    }

    // Detect conflicts
    const conflicts = await syncService.detectConflicts(req.params.vaultId);

    // Mark synced entries
    const entryIds = changes
      .filter((c: any) => c.entryId)
      .map((c: any) => c.entryId);

    if (entryIds.length > 0) {
      await syncService.markSynced(req.params.vaultId, entryIds);
    }

    res.json({
      appliedChanges: changes,
      conflicts: conflicts,
      lastSyncAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to push changes:', error);
    res.status(500).json({ error: 'Failed to push changes' });
  }
});

// POST /api/vaults/:vaultId/sync/resolve - Resolve conflict
router.post('/:vaultId/sync/resolve', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { entryId, resolution } = req.body;

    const vault = await vaultService.getVault(req.params.vaultId);
    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    const access = await shareService.checkAccess(vault.id, user.id);
    if (!access.hasAccess && vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (!entryId || !resolution) {
      res.status(400).json({ error: 'Missing entryId or resolution' });
      return;
    }

    const validStrategies = ['local', 'remote', 'merge', 'last-write-wins'];
    if (!validStrategies.includes(resolution)) {
      res.status(400).json({ error: `Invalid resolution strategy. Must be one of: ${validStrategies.join(', ')}` });
      return;
    }

    // winningData is required for 'local' and 'merge' strategies
    const { winningData } = req.body;
    if ((resolution === 'local' || resolution === 'merge') && !winningData) {
      res.status(400).json({ error: 'winningData (encrypted entry payload) required for local/merge resolution' });
      return;
    }

    await syncService.resolveConflict(req.params.vaultId, entryId, resolution, winningData);

    const entry = await vaultService.getEntry(entryId);
    res.json(entry);
  } catch (error) {
    console.error('Failed to resolve conflict:', error);
    res.status(500).json({ error: 'Failed to resolve conflict' });
  }
});

export { router as syncRouter };
