import express from 'express';
import { VaultService } from '../services/VaultService.js';
import { ShareService } from '../services/ShareService.js';
import { SyncService } from '../services/SyncService.js';

const router = express.Router();

export const vaultService = new VaultService();
export const shareService = new ShareService();
export const syncService = new SyncService();

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// POST /api/vaults/:vaultId/entries - Add entry
router.post('/:vaultId/entries', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const deviceId = (req.headers['x-device-id'] as string) || 'device-1';
    const vault = await vaultService.getVault(req.params.vaultId);

    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    const access = await shareService.checkAccess(vault.id, user.id);
    if (
      !access.hasAccess &&
      vault.owner_id !== user.id &&
      access.accessLevel !== 'editor'
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { type, name, encryptedData } = req.body;

    if (!type || !name || !encryptedData) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const entry = await vaultService.createEntry(
      req.params.vaultId,
      type,
      name,
      encryptedData,
      deviceId
    );

    // Record change in sync log
    await syncService.recordChange(
      req.params.vaultId,
      user.id,
      deviceId,
      'create',
      entry.id,
      undefined,
      entry.local_version
    );

    res.status(201).json(entry);
  } catch (error) {
    console.error('Failed to create entry:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// GET /api/vaults/:vaultId/entries - List entries
router.get('/:vaultId/entries', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
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

    const entries = await vaultService.listEntries(req.params.vaultId);
    res.json(entries);
  } catch (error) {
    console.error('Failed to list entries:', error);
    res.status(500).json({ error: 'Failed to list entries' });
  }
});

// PUT /api/vaults/:vaultId/entries/:entryId - Update entry
router.put('/:vaultId/entries/:entryId', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const deviceId = (req.headers['x-device-id'] as string) || 'device-1';
    const vault = await vaultService.getVault(req.params.vaultId);

    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    const access = await shareService.checkAccess(vault.id, user.id);
    if (
      !access.hasAccess &&
      vault.owner_id !== user.id &&
      access.accessLevel !== 'editor'
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const entry = await vaultService.getEntry(req.params.entryId);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    // Verify entry belongs to the vault in the URL (prevents cross-vault IDOR)
    if (entry.vault_id !== req.params.vaultId) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    const { name, encryptedData, localVersion } = req.body;

    const updated = await vaultService.updateEntry(
      req.params.entryId,
      name || entry.name,
      encryptedData || entry.encrypted_data,
      localVersion || entry.local_version,
      deviceId
    );

    // Record change
    await syncService.recordChange(
      req.params.vaultId,
      user.id,
      deviceId,
      'update',
      req.params.entryId,
      entry.local_version,
      updated.local_version
    );

    res.json(updated);
  } catch (error) {
    console.error('Failed to update entry:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// DELETE /api/vaults/:vaultId/entries/:entryId - Delete entry
router.delete('/:vaultId/entries/:entryId', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const deviceId = (req.headers['x-device-id'] as string) || 'device-1';
    const vault = await vaultService.getVault(req.params.vaultId);

    if (!vault) {
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    const access = await shareService.checkAccess(vault.id, user.id);
    if (
      !access.hasAccess &&
      vault.owner_id !== user.id &&
      access.accessLevel !== 'editor'
    ) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const entry = await vaultService.getEntry(req.params.entryId);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    // Verify entry belongs to the vault in the URL (prevents cross-vault IDOR)
    if (entry.vault_id !== req.params.vaultId) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    await vaultService.deleteEntry(req.params.entryId);

    // Record change
    await syncService.recordChange(
      req.params.vaultId,
      user.id,
      deviceId,
      'delete',
      req.params.entryId,
      entry.local_version,
      entry.local_version + 1
    );

    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete entry:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

export { router as entriesRouter };
