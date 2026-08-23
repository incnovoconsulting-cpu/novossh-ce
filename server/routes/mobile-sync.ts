import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db/connection.js';
import { SubscriptionService, PLAN_LIMITS } from '../services/SubscriptionService.js';

const router = express.Router();
const subscriptionService = new SubscriptionService();

// GET /api/sync/preflight — return plan limits and current server-side counts
router.get('/preflight', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const db = getDb();

    const sub = await subscriptionService.getSubscription(userId);
    const plan = sub?.plan ?? 'free';
    const limits = PLAN_LIMITS[plan];

    const [hostCount, keyCount, snippetCount] = await Promise.all([
      db`SELECT COUNT(*)::int AS count FROM ssh_hosts WHERE user_id = ${userId}`,
      db`SELECT COUNT(*)::int AS count FROM ssh_keys WHERE user_id = ${userId}`,
      db`SELECT COUNT(*)::int AS count FROM user_snippets WHERE user_id = ${userId}`,
    ]);

    res.json({
      plan,
      limits: { hosts: limits.hosts, keys: limits.keys, snippets: limits.snippets },
      usage: {
        hosts: Number(hostCount[0].count),
        keys: Number(keyCount[0].count),
        snippets: Number(snippetCount[0].count),
      },
    });
  } catch (error) {
    console.error('[mobile-sync] preflight failed:', error);
    res.status(500).json({ error: 'Preflight failed' });
  }
});

// GET /api/sync/pull — return all user's hosts, keys, and snippets
router.get('/pull', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const db = getDb();

    const sub = await subscriptionService.getSubscription(userId);
    const plan = sub?.plan ?? 'free';
    const limits = PLAN_LIMITS[plan];

    const [hosts, keys, snippets] = await Promise.all([
      db`SELECT id, label, address, port, username, auth_method, tags, color_hex, notes,
               last_connected_at, updated_at
          FROM ssh_hosts WHERE user_id = ${userId}
          ORDER BY updated_at DESC LIMIT ${limits.hosts}`,
      db`SELECT id, label, public_key, has_passphrase, created_at
          FROM ssh_keys WHERE user_id = ${userId}
          ORDER BY created_at DESC LIMIT ${limits.keys}`,
      db`SELECT id, label, command, description, tags, created_at
          FROM user_snippets WHERE user_id = ${userId}
          ORDER BY created_at DESC LIMIT ${limits.snippets}`,
    ]);

    res.json({
      plan,
      planLimits: { hosts: limits.hosts, keys: limits.keys, snippets: limits.snippets },
      hosts: hosts.map(h => ({
        id: h.id,
        label: h.label,
        address: h.address,
        port: Number(h.port),
        username: h.username,
        authMethod: h.auth_method,
        tags: typeof h.tags === 'string' ? JSON.parse(h.tags) : (h.tags ?? []),
        colorHex: h.color_hex ?? null,
        notes: h.notes ?? null,
        lastConnectedAt: h.last_connected_at ? new Date(h.last_connected_at).toISOString() : null,
        updatedAt: new Date(h.updated_at).toISOString(),
      })),
      keys: keys.map(k => ({
        id: k.id,
        label: k.label,
        publicKey: k.public_key ?? null,
        hasPassphrase: Boolean(k.has_passphrase),
        createdAt: new Date(k.created_at).toISOString(),
      })),
      snippets: snippets.map(s => ({
        id: s.id,
        label: s.label,
        command: s.command,
        description: s.description ?? null,
        tags: typeof s.tags === 'string' ? JSON.parse(s.tags) : (s.tags ?? []),
        createdAt: new Date(s.created_at).toISOString(),
      })),
    });
  } catch (error) {
    console.error('[mobile-sync] pull failed:', error);
    res.status(500).json({ error: 'Sync pull failed' });
  }
});

// POST /api/sync/push — upsert hosts, keys, and snippets (last-write-wins, capped by plan)
router.post('/push', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.id;
    const db = getDb();
    let { hosts = [], keys = [], snippets = [] } = req.body;

    const sub = await subscriptionService.getSubscription(userId);
    const plan = sub?.plan ?? 'free';
    const limits = PLAN_LIMITS[plan];

    // Sort by updatedAt desc so newest entries are kept when over the limit
    hosts = (hosts as any[])
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limits.hosts);
    keys = (keys as any[]).slice(0, limits.keys);
    snippets = (snippets as any[]).slice(0, limits.snippets);

    await db.begin(async sql => {
      for (const h of hosts) {
        await sql`
          INSERT INTO ssh_hosts (id, user_id, label, address, port, username, auth_method, tags,
                                 color_hex, notes, last_connected_at, updated_at)
          VALUES (${h.id}::uuid, ${userId}::uuid, ${h.label}, ${h.address}, ${h.port},
                  ${h.username}, ${h.authMethod}, ${JSON.stringify(h.tags ?? [])}::jsonb,
                  ${h.colorHex ?? null}, ${h.notes ?? null},
                  ${h.lastConnectedAt ? new Date(h.lastConnectedAt) : null},
                  ${new Date(h.updatedAt)})
          ON CONFLICT (user_id, address, port, username) DO UPDATE SET
            id = CASE WHEN EXCLUDED.updated_at > ssh_hosts.updated_at THEN EXCLUDED.id ELSE ssh_hosts.id END,
            label = CASE WHEN EXCLUDED.updated_at > ssh_hosts.updated_at THEN EXCLUDED.label ELSE ssh_hosts.label END,
            auth_method = CASE WHEN EXCLUDED.updated_at > ssh_hosts.updated_at THEN EXCLUDED.auth_method ELSE ssh_hosts.auth_method END,
            tags = CASE WHEN EXCLUDED.updated_at > ssh_hosts.updated_at THEN EXCLUDED.tags ELSE ssh_hosts.tags END,
            color_hex = CASE WHEN EXCLUDED.updated_at > ssh_hosts.updated_at THEN EXCLUDED.color_hex ELSE ssh_hosts.color_hex END,
            notes = CASE WHEN EXCLUDED.updated_at > ssh_hosts.updated_at THEN EXCLUDED.notes ELSE ssh_hosts.notes END,
            last_connected_at = CASE WHEN EXCLUDED.updated_at > ssh_hosts.updated_at THEN EXCLUDED.last_connected_at ELSE ssh_hosts.last_connected_at END,
            updated_at = GREATEST(ssh_hosts.updated_at, EXCLUDED.updated_at)
        `;
      }

      for (const k of keys) {
        await sql`
          INSERT INTO ssh_keys (id, user_id, label, public_key, has_passphrase, created_at)
          VALUES (${k.id}::uuid, ${userId}::uuid, ${k.label}, ${k.publicKey ?? null},
                  ${k.hasPassphrase ?? false}, ${new Date(k.createdAt)})
          ON CONFLICT (id) DO UPDATE SET
            label = EXCLUDED.label,
            public_key = EXCLUDED.public_key,
            has_passphrase = EXCLUDED.has_passphrase
          WHERE ssh_keys.user_id = ${userId}::uuid
        `;
      }

      for (const s of snippets) {
        await sql`
          INSERT INTO user_snippets (id, user_id, label, command, description, tags, created_at)
          VALUES (${s.id}::uuid, ${userId}::uuid, ${s.label}, ${s.command},
                  ${s.description ?? null}, ${JSON.stringify(s.tags ?? [])}::jsonb,
                  ${new Date(s.createdAt)})
          ON CONFLICT (id) DO UPDATE SET
            label = EXCLUDED.label,
            command = EXCLUDED.command,
            description = EXCLUDED.description,
            tags = EXCLUDED.tags
          WHERE user_snippets.user_id = ${userId}::uuid
        `;
      }
    });

    // Update usage counts based on actual stored records
    const [hostCount] = await db`SELECT COUNT(*)::int as count FROM ssh_hosts WHERE user_id = ${userId}`;
    const [snippetCount] = await db`SELECT COUNT(*)::int as count FROM user_snippets WHERE user_id = ${userId}`;
    const [keyCount] = await db`SELECT COUNT(*)::int as count FROM encryption_keys WHERE user_id = ${userId}`;

    if (hostCount) await db`INSERT INTO usage_counts (user_id, resource_type, count) VALUES (${userId}, 'hosts', ${hostCount.count}) ON CONFLICT (user_id, resource_type) DO UPDATE SET count = ${hostCount.count}, updated_at = NOW()`;
    if (snippetCount) await db`INSERT INTO usage_counts (user_id, resource_type, count) VALUES (${userId}, 'snippets', ${snippetCount.count}) ON CONFLICT (user_id, resource_type) DO UPDATE SET count = ${snippetCount.count}, updated_at = NOW()`;
    if (keyCount) await db`INSERT INTO usage_counts (user_id, resource_type, count) VALUES (${userId}, 'keys', ${keyCount.count}) ON CONFLICT (user_id, resource_type) DO UPDATE SET count = ${keyCount.count}, updated_at = NOW()`;

    res.json({ ok: true, accepted: { hosts: hosts.length, keys: keys.length, snippets: snippets.length } });
  } catch (error) {
    console.error('[mobile-sync] push failed:', error);
    res.status(500).json({ error: 'Sync push failed' });
  }
});

export { router as mobileSyncRouter };
