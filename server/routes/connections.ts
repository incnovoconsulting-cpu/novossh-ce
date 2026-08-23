import express from 'express';
import { connectionMetadataService } from '../services/ConnectionMetadataService.js';
import { vaultService } from './vaults.js';
import { shareService } from './entries.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(optionalAuthMiddleware);

function requireAuth(req: express.Request, res: express.Response): { id: string; organizationId: string } | null {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { id: user.id, organizationId: user.organizationId || '' };
}

// GET /api/connections/:entryId - Get connection metadata for a host
router.get('/:entryId', async (req, res) => {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    const entry = await vaultService.getEntry(req.params.entryId);

    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    const vault = await vaultService.getVault(entry.vault_id);
    const access = await shareService.checkAccess(vault!.id, user.id);
    if (!access.hasAccess && vault!.owner_id !== user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const metadata = await connectionMetadataService.getConnectionMetadata(entry.id);
    const hints = await connectionMetadataService.getConnectionHints(entry.id);
    const stats = await connectionMetadataService.getRecentConnectionStats(entry.id);

    res.json({
      metadata: metadata || {},
      hints: hints || {},
      stats: stats || {},
    });
  } catch (error) {
    console.error('Failed to get connection metadata:', error);
    res.status(500).json({ error: 'Failed to get connection metadata' });
  }
});

// POST /api/connections/:entryId/attempt - Record connection attempt
router.post('/:entryId/attempt', async (req, res) => {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    const {
      connectionType,
      targetHost,
      targetPort,
      success,
      errorMessage,
      fallbackUsed,
      fallbackType,
      durationMs,
    } = req.body;

    if (!connectionType || !targetHost || targetPort == null) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const port = Number(targetPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      res.status(400).json({ error: 'Invalid port number' });
      return;
    }

    const entry = await vaultService.getEntry(req.params.entryId);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    const deviceId = (req as any).user?.deviceId || req.headers['x-device-id'] as string || 'web';

    await connectionMetadataService.recordConnectionAttempt(
      entry.id,
      user.id,
      deviceId,
      connectionType,
      targetHost,
      port,
      success,
      errorMessage,
      fallbackUsed,
      fallbackType,
      durationMs
    );

    if (success && connectionType === 'direct') {
      await connectionMetadataService.recordDirectConnectionSuccess(entry.id);
    } else if (!success && connectionType === 'direct') {
      await connectionMetadataService.recordDirectConnectionFailure(entry.id);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to record connection attempt:', error);
    res.status(500).json({ error: 'Failed to record connection attempt' });
  }
});

// PUT /api/connections/:entryId/metadata - Update connection metadata
router.put('/:entryId/metadata', async (req, res) => {
  try {
    const user = requireAuth(req, res);
    if (!user) return;

    const { connectionMode, requiresRelay } = req.body;

    const entry = await vaultService.getEntry(req.params.entryId);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    const vault = await vaultService.getVault(entry.vault_id);
    const access = await shareService.checkAccess(vault!.id, user.id);
    if (
      !access.hasAccess &&
      vault!.owner_id !== user.id &&
      access.accessLevel !== 'editor'
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await connectionMetadataService.updateConnectionMetadata(entry.id, {
      connectionMode: connectionMode || 'relay',
      requiresRelay: requiresRelay ?? true,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to update connection metadata:', error);
    res.status(500).json({ error: 'Failed to update connection metadata' });
  }
});

export { router as connectionsRouter };
