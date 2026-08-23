import express from 'express';
import { VaultService } from '../services/VaultService.js';
import { ShareService } from '../services/ShareService.js';

const router = express.Router();

export const vaultService = new VaultService();
export const shareService = new ShareService();

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// POST /api/vaults/:vaultId/shares - Share with user
router.post('/:vaultId/shares', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { userId, accessLevel } = req.body;

    const vault = await vaultService.getVault(req.params.vaultId);
    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    if (vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Only owner can share vault' });
      return;
    }

    if (!userId || !accessLevel) {
      res.status(400).json({ error: 'Missing userId or accessLevel' });
      return;
    }

    if (!['viewer', 'editor', 'owner'].includes(accessLevel)) {
      res.status(400).json({ error: 'Invalid access level' });
      return;
    }

    const share = await shareService.shareWithUser(
      req.params.vaultId,
      user.id,
      userId,
      accessLevel
    );

    res.status(201).json(share);
  } catch (error) {
    console.error('Failed to share vault:', error);
    res.status(500).json({ error: 'Failed to share vault' });
  }
});

// GET /api/vaults/:vaultId/shares - List shares
router.get('/:vaultId/shares', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const vault = await vaultService.getVault(req.params.vaultId);

    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    if (vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Only owner can list shares' });
      return;
    }

    const shares = await shareService.listShares(req.params.vaultId);
    res.json(shares);
  } catch (error) {
    console.error('Failed to list shares:', error);
    res.status(500).json({ error: 'Failed to list shares' });
  }
});

// DELETE /api/vaults/:vaultId/shares/:shareId - Revoke share
router.delete('/:vaultId/shares/:shareId', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const vault = await vaultService.getVault(req.params.vaultId);

    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    if (vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Only owner can revoke shares' });
      return;
    }

    await shareService.revokeShare(req.params.shareId);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to revoke share:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  }
});

// POST /api/vaults/:vaultId/shares/generate-link - Generate share link
router.post('/:vaultId/shares/generate-link', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { accessLevel, expiresIn } = req.body;

    const vault = await vaultService.getVault(req.params.vaultId);
    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    if (vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Only owner can generate share links' });
      return;
    }

    if (!accessLevel) {
      res.status(400).json({ error: 'Missing accessLevel' });
      return;
    }

    const share = await shareService.generateShareLink(
      req.params.vaultId,
      user.id,
      accessLevel,
      expiresIn
    );

    const shareUrl = `${process.env.BASE_URL || 'http://localhost:5173'}/vault/join/${share.share_token}`;

    res.status(201).json({
      shareToken: share.share_token,
      expiresAt: share.expires_at,
      shareUrl,
    });
  } catch (error) {
    console.error('Failed to generate share link:', error);
    res.status(500).json({ error: 'Failed to generate share link' });
  }
});

export { router as sharingRouter };
