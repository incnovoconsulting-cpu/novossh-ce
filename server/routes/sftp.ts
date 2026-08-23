import express from 'express';
import multer from 'multer';
import path from 'path';
import { sftpService } from '../services/SFTPService.js';
import { getDb } from '../db/connection.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const router = express.Router();

function sanitizePath(p: string): string {
  const normalized = path.posix.normalize(p);
  if (normalized.includes('..')) throw new Error('Path traversal not allowed');
  return normalized.startsWith('/') ? normalized : '/' + normalized;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\]/g, '').replace(/\.\./g, '');
}

function requireUser(req: express.Request, res: express.Response): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return { id: user.id, organizationId: user.organizationId };
}

interface HostEntry {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  passphrase?: string;
  vaultId?: string;
}

async function getHostConfig(hostId: string): Promise<HostEntry> {
  const db = getDb();
  const result = await db`SELECT * FROM vault_entries WHERE id = ${hostId} AND is_deleted = false`;
  if (result.length === 0) {
    throw new Error('Host not found');
  }
  const entry = result[0] as any;
  const data = typeof entry.encrypted_data === 'string' ? JSON.parse(entry.encrypted_data) : entry.encrypted_data;
  return {
    id: entry.id,
    name: entry.name,
    host: data.host || data.address || '',
    port: data.port || 22,
    username: data.username || 'root',
    password: data.password,
    private_key: data.privateKey || data.private_key,
    passphrase: data.passphrase,
    vaultId: entry.vault_id,
  };
}

/**
 * Verify that the user owns or has shared access to the vault containing the entry.
 * Blocks cross-user SFTP access.
 */
async function verifyEntryAccess(hostId: string, userId: string): Promise<void> {
  const db = getDb();
  const rows = await db`
    SELECT ve.vault_id, v.owner_id
    FROM vault_entries ve
    JOIN vaults v ON v.id = ve.vault_id
    WHERE ve.id = ${hostId} AND ve.is_deleted = false AND v.is_deleted = false
    LIMIT 1
  `;
  if (rows.length === 0) {
    throw new Error('Host not found');
  }
  const { vault_id, owner_id } = rows[0] as { vault_id: string; owner_id: string };

  // Owner always has access
  if (owner_id === userId) return;

  // Check if user has shared access to this vault
  const shared = await db`
    SELECT 1 FROM vault_shares
    WHERE vault_id = ${vault_id} AND grantee_id = ${userId}
    LIMIT 1
  `;
  if (shared.length === 0) {
    throw new Error('Access denied: you do not have access to this host');
  }
}

async function ensureConnected(hostId: string): Promise<void> {
  if (sftpService.isConnected(hostId)) return;
  const hostConfig = await getHostConfig(hostId);
  const config: any = {
    host: hostConfig.host,
    port: hostConfig.port,
    username: hostConfig.username,
    readyTimeout: 15_000,
    keepaliveInterval: 30_000,
    tryKeyboard: true,
  };
  if (hostConfig.password) config.password = hostConfig.password;
  if (hostConfig.private_key) config.privateKey = hostConfig.private_key;
  if (hostConfig.passphrase) config.passphrase = hostConfig.passphrase;
  await sftpService.connect(hostId, config);
}

// GET /api/sftp/:entryId/list?path=
router.get('/:entryId/list', async (req, res) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    await verifyEntryAccess(req.params.entryId, user.id);
    await ensureConnected(req.params.entryId);
    const remotePath = sanitizePath((req.query.path as string) || '/');
    const entries = await sftpService.listDirectory(req.params.entryId, remotePath);
    res.json({ entries, path: remotePath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SFTP error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/sftp/:entryId/upload?path=
router.post('/:entryId/upload', upload.single('file'), async (req, res) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    await verifyEntryAccess(req.params.entryId, user.id);
    await ensureConnected(req.params.entryId);
    const remoteDir = sanitizePath((req.query.path as string) || '/');
    if (!req.file) { res.status(400).json({ error: 'No file provided' }); return; }
    const safeName = sanitizeFilename(req.file.originalname);
    const remotePath = remoteDir === '/'
      ? `/${safeName}`
      : `${remoteDir}/${safeName}`;
    await sftpService.uploadFile(req.params.entryId, remotePath, req.file.buffer);
    res.json({ ok: true, path: remotePath, size: req.file.size });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload error';
    res.status(500).json({ error: msg });
  }
});

// GET /api/sftp/:entryId/download?path=
router.get('/:entryId/download', async (req, res) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    await verifyEntryAccess(req.params.entryId, user.id);
    await ensureConnected(req.params.entryId);
    const remotePath = sanitizePath(req.query.path as string);
    if (!remotePath) { res.status(400).json({ error: 'Missing path' }); return; }
    const fileSize = await sftpService.getFileSize(req.params.entryId, remotePath);
    // Sanitize filename to prevent Content-Disposition header injection
    const fileName = (remotePath.split('/').pop() || 'download').replace(/[^a-zA-Z0-9._-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileSize.toString());
    const stream = sftpService.createReadStream(req.params.entryId, remotePath);
    stream.pipe(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Download error';
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/sftp/:entryId/delete
router.delete('/:entryId/delete', async (req, res) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    await verifyEntryAccess(req.params.entryId, user.id);
    await ensureConnected(req.params.entryId);
    const { path: remotePath, isDirectory } = req.body;
    if (!remotePath) { res.status(400).json({ error: 'Missing path' }); return; }
    const sanitizedPath = sanitizePath(remotePath);
    await sftpService.deletePath(req.params.entryId, sanitizedPath, !!isDirectory);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Delete error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/sftp/:entryId/mkdir
router.post('/:entryId/mkdir', async (req, res) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    await verifyEntryAccess(req.params.entryId, user.id);
    await ensureConnected(req.params.entryId);
    const { path: remotePath } = req.body;
    if (!remotePath) { res.status(400).json({ error: 'Missing path' }); return; }
    const sanitizedPath = sanitizePath(remotePath);
    await sftpService.createDirectory(req.params.entryId, sanitizedPath);
    res.json({ ok: true, path: sanitizedPath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Mkdir error';
    res.status(500).json({ error: msg });
  }
});

// PUT /api/sftp/:entryId/rename
router.put('/:entryId/rename', async (req, res) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    await verifyEntryAccess(req.params.entryId, user.id);
    await ensureConnected(req.params.entryId);
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) { res.status(400).json({ error: 'Missing paths' }); return; }
    await sftpService.rename(req.params.entryId, sanitizePath(oldPath), sanitizePath(newPath));
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Rename error';
    res.status(500).json({ error: msg });
  }
});

// POST /api/sftp/:entryId/disconnect
router.post('/:entryId/disconnect', async (req, res) => {
  try {
    const user = requireUser(req, res);
    if (!user) return;
    await verifyEntryAccess(req.params.entryId, user.id);
    await sftpService.disconnect(req.params.entryId);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Disconnect error';
    res.status(500).json({ error: msg });
  }
});

export { router as sftpRouter };
