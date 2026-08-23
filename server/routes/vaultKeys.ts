import express from 'express';
import { VaultKeyService } from '../services/VaultKeyService.js';
import { VaultService } from '../services/VaultService.js';
import { SubscriptionService } from '../services/SubscriptionService.js';
import { getDb } from '../db/connection.js';

const router = express.Router();

export const vaultKeyService = new VaultKeyService();
const vaultService = new VaultService();
const subscriptionService = new SubscriptionService();

function getUser(req: express.Request): { id: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id };
}

// POST /api/vault-keys - register (or rotate) this user's keypair
router.post('/', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    const { publicKey, encryptedPrivateKey, privateKeyNonce, kdfSalt, kdfParams } = req.body;
    if (!publicKey || !encryptedPrivateKey || !privateKeyNonce || !kdfSalt || !kdfParams) {
      res.status(400).json({ error: 'Missing required key fields' });
      return;
    }

    const key = await vaultKeyService.registerKey(
      user.id, publicKey, encryptedPrivateKey, privateKeyNonce, kdfSalt, kdfParams
    );
    await subscriptionService.incrementUsage(user.id, 'keys');
    res.status(201).json(key);
  } catch (error) {
    console.error('Failed to register vault key:', error);
    res.status(500).json({ error: 'Failed to register vault key' });
  }
});

// GET /api/vault-keys/me - this user's own key material (to unlock locally)
router.get('/me', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    const key = await vaultKeyService.getKey(user.id);
    if (!key) { res.status(404).json({ error: 'No vault key registered' }); return; }
    res.json(key);
  } catch (error) {
    console.error('Failed to fetch vault key:', error);
    res.status(500).json({ error: 'Failed to fetch vault key' });
  }
});

// GET /api/vault-keys/:userId/public - another user's public key (for sharing/wrapping)
router.get('/:userId/public', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    const publicKey = await vaultKeyService.getPublicKey(req.params.userId);
    if (!publicKey) { res.status(404).json({ error: 'No vault key registered for this user' }); return; }
    res.json({ userId: req.params.userId, publicKey });
  } catch (error) {
    console.error('Failed to fetch public key:', error);
    res.status(500).json({ error: 'Failed to fetch public key' });
  }
});

// GET /api/vault-keys/vaults/:vaultId/wrapped-dek - this user's wrapped DEK for a vault
router.get('/vaults/:vaultId/wrapped-dek', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    const wrap = await vaultKeyService.getWrappedDekForUser(req.params.vaultId, user.id);
    if (!wrap) { res.status(404).json({ error: 'No wrapped key for this vault/user' }); return; }
    res.json(wrap);
  } catch (error) {
    console.error('Failed to fetch wrapped DEK:', error);
    res.status(500).json({ error: 'Failed to fetch wrapped DEK' });
  }
});

// PUT /api/vault-keys/vaults/:vaultId/owner-wrap - set the owner's sealed DEK (on vault creation)
router.put('/vaults/:vaultId/owner-wrap', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { wrappedDek } = req.body;
    if (!wrappedDek) { res.status(400).json({ error: 'wrappedDek is required' }); return; }

    // Verify the user owns this vault before overwriting the DEK
    const vault = await vaultService.getVault(req.params.vaultId);
    if (!vault) { res.status(404).json({ error: 'Vault not found' }); return; }
    if (vault.owner_id !== user.id) {
      res.status(403).json({ error: 'Only the vault owner can wrap the DEK' });
      return;
    }

    await vaultKeyService.setOwnerWrappedDek(req.params.vaultId, wrappedDek);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to set owner wrapped DEK:', error);
    res.status(500).json({ error: 'Failed to set owner wrapped DEK' });
  }
});

// PUT /api/vault-keys/shares/:shareId/wrap - set a grantee's sealed DEK (on share)
router.put('/shares/:shareId/wrap', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { wrappedDek } = req.body;
    if (!wrappedDek) { res.status(400).json({ error: 'wrappedDek is required' }); return; }

    // Verify the share belongs to this user
    const db = getDb();
    const shares = await db`SELECT grantee_id FROM vault_shares WHERE id = ${req.params.shareId} LIMIT 1`;
    if (shares.length === 0) { res.status(404).json({ error: 'Share not found' }); return; }
    if ((shares[0] as any).grantee_id !== user.id) {
      res.status(403).json({ error: 'You can only wrap DEKs for your own shares' });
      return;
    }

    await vaultKeyService.setShareWrappedDek(req.params.shareId, wrappedDek);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to set share wrapped DEK:', error);
    res.status(500).json({ error: 'Failed to set share wrapped DEK' });
  }
});

export { router as vaultKeysRouter };
