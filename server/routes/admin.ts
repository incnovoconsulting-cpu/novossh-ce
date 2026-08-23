import express from 'express';
import { getDb } from '../db/connection.js';

export const adminRouter = express.Router();

// GET /api/admin/me — check if current user is owner
adminRouter.get('/me', async (req, res) => {
  const ownerEmail = process.env.OWNER_EMAIL;
  const userEmail = (req as any).token?.email || (req.user as any)?.id;
  res.json({
    isOwner: !!ownerEmail && !!userEmail && userEmail === ownerEmail,
    email: userEmail || null,
  });
});

// GET /api/admin/stats — dashboard overview
adminRouter.get('/stats', async (_req, res) => {
  try {
    const db = getDb();

    const [totalUsers, planCounts, trialUsers, activeSubs] = await Promise.all([
      db`SELECT COUNT(*)::int as count FROM users`,
      db`SELECT
        COALESCE(s.plan, 'free') as plan,
        COUNT(*)::int as count
      FROM users u LEFT JOIN subscriptions s ON u.id = s.user_id
      GROUP BY COALESCE(s.plan, 'free')`,
      db`SELECT COUNT(*)::int as count FROM subscriptions WHERE status = 'trialing'`,
      db`SELECT COUNT(*)::int as count FROM subscriptions WHERE status = 'active'`,
    ]);

    const plans: Record<string, number> = { free: 0, starter: 0, pro: 0 };
    for (const row of planCounts) {
      plans[row.plan] = row.count;
    }

    res.json({
      totalUsers: totalUsers[0].count,
      plans,
      trialUsers: trialUsers[0].count,
      activeSubscriptions: activeSubs[0].count,
    });
  } catch (error: any) {
    console.error('[admin] Stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users — paginated user list
adminRouter.get('/users', async (req, res) => {
  try {
    const db = getDb();
    const search = (req.query.search as string) || '';
    const planFilter = (req.query.plan as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    let users;
    if (search) {
      users = await db`
        SELECT u.id, u.email, u.created_at, u.email_verified,
          COALESCE(s.plan, 'free') as plan, COALESCE(s.status, 'free') as status
        FROM users u LEFT JOIN subscriptions s ON u.id = s.user_id
        WHERE u.email ILIKE ${'%' + search + '%'}
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (planFilter) {
      users = await db`
        SELECT u.id, u.email, u.created_at, u.email_verified,
          COALESCE(s.plan, 'free') as plan, COALESCE(s.status, 'free') as status
        FROM users u LEFT JOIN subscriptions s ON u.id = s.user_id
        WHERE COALESCE(s.plan, 'free') = ${planFilter}
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      users = await db`
        SELECT u.id, u.email, u.created_at, u.email_verified,
          COALESCE(s.plan, 'free') as plan, COALESCE(s.status, 'free') as status
        FROM users u LEFT JOIN subscriptions s ON u.id = s.user_id
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const [{ count: total }] = await db`SELECT COUNT(*)::int as count FROM users`;

    res.json({ users, total, page, limit });
  } catch (error: any) {
    console.error('[admin] Users error:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/user/:id — single user detail
adminRouter.get('/user/:id', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const [user] = await db`
      SELECT u.id, u.email, u.created_at, u.email_verified,
        COALESCE(s.plan, 'free') as plan, COALESCE(s.status, 'free') as status,
        s.stripe_subscription_id, s.current_period_end
      FROM users u LEFT JOIN subscriptions s ON u.id = s.user_id
      WHERE u.id = ${id}
    `;

    if (!user) return res.status(404).json({ error: 'User not found' });

    const usage = await db`
      SELECT * FROM usage_counts WHERE user_id = ${id}
    `.catch(() => []);

    res.json({ ...user, usage: usage[0] || null });
  } catch (error: any) {
    console.error('[admin] User detail error:', error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/admin/user/:id/plan — override user plan
adminRouter.put('/user/:id/plan', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { plan } = req.body;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    if (!['free', 'starter', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const [existing] = await db`SELECT id FROM subscriptions WHERE user_id = ${id}`;

    if (existing) {
      await db`UPDATE subscriptions SET plan = ${plan}, updated_at = NOW() WHERE user_id = ${id}`;
    } else {
      await db`INSERT INTO subscriptions (user_id, plan, status) VALUES (${id}, ${plan}, 'active')`;
    }

    res.json({ ok: true, plan });
  } catch (error: any) {
    console.error('[admin] Plan override error:', error.message);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// GET /api/admin/db/tables — list tables with row counts
adminRouter.get('/db/tables', async (_req, res) => {
  try {
    const db = getDb();

    const tables = await db`
      SELECT
        schemaname,
        relname as tablename,
        n_live_tup as row_count,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
    `;

    res.json({ tables });
  } catch (error: any) {
    console.error('[admin] DB tables error:', error.message);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// GET /api/admin/db/table/:name — preview rows from a table
adminRouter.get('/db/table/:name', async (req, res) => {
  try {
    const db = getDb();
    const { name } = req.params;
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = Math.min(50, parseInt(req.query.limit as string) || 50);

    // Validate table name (alphanumeric + underscores only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    // Get column info
    const columns = await db`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = ${name} AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    // Get rows — use safe identifier interpolation
    const rows = await db.unsafe(
      `SELECT * FROM "${name}" ORDER BY 1 LIMIT ${limit} OFFSET ${offset}`
    );

    const [{ count: total }] = await db.unsafe(
      `SELECT COUNT(*)::int as count FROM "${name}"`
    );

    res.json({ columns, rows, total, offset, limit });
  } catch (error: any) {
    console.error('[admin] Table preview error:', error.message);
    res.status(500).json({ error: 'Failed to preview table' });
  }
});

// GET /api/admin/features — list all feature flags
adminRouter.get('/features', async (_req, res) => {
  try {
    const db = getDb();
    const flags = await db`SELECT * FROM feature_flags ORDER BY key`;
    res.json({ flags });
  } catch (error: any) {
    console.error('[admin] Features error:', error.message);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

// PUT /api/admin/features/:key — toggle a feature flag
adminRouter.put('/features/:key', async (req, res) => {
  try {
    const db = getDb();
    const { key } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }

    await db`
      UPDATE feature_flags
      SET enabled = ${enabled}, updated_at = NOW(), updated_by = ${(req.user as any)?.email || 'unknown'}
      WHERE key = ${key}
    `;

    res.json({ ok: true, key, enabled });
  } catch (error: any) {
    console.error('[admin] Feature toggle error:', error.message);
    res.status(500).json({ error: 'Failed to toggle feature' });
  }
});

// GET /api/admin/health — full system health
adminRouter.get('/health', async (_req, res) => {
  try {
    const db = getDb();
    const start = Date.now();

    await db`SELECT 1`;
    const dbLatency = Date.now() - start;

    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const externalMB = Math.round(mem.external / 1024 / 1024);
    const uptimeSeconds = Math.round(process.uptime());

    let dbPool: any = null;
    try {
      const [pool] = await db`
        SELECT count(*)::int as total FROM pg_stat_activity WHERE datname = current_database()
      `;
      dbPool = { active: pool.total };
    } catch {
      dbPool = { active: -1 };
    }

    res.json({
      status: dbLatency < 100 ? 'healthy' : dbLatency < 500 ? 'degraded' : 'critical',
      database: { latency_ms: dbLatency, pool: dbPool },
      memory: { heap_used_mb: heapUsedMB, heap_total_mb: heapTotalMB, external_mb: externalMB },
      uptime: uptimeSeconds,
      node_version: process.version,
    });
  } catch (error: any) {
    console.error('[admin] Health error:', error.message);
    res.status(500).json({ status: 'critical', error: error.message });
  }
});

// GET /api/admin/releases — recent GitHub releases
adminRouter.get('/releases', async (_req, res) => {
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const response = await fetch(
      'https://api.github.com/repos/incnovoconsulting-cpu/NovoSSH/releases?per_page=10',
      { headers }
    );
    const releases = await response.json();

    if (!Array.isArray(releases)) {
      return res.json({ releases: [], error: 'Failed to fetch releases' });
    }

    const mapped = releases.map((r: any) => ({
      tag: r.tag_name,
      name: r.name,
      body: r.body?.substring(0, 200),
      published: r.published_at,
      url: r.html_url,
      prerelease: r.prerelease,
    }));

    res.json({ releases: mapped });
  } catch (error: any) {
    console.error('[admin] Releases error:', error.message);
    res.json({ releases: [], error: error.message });
  }
});

// GET /api/admin/security — security overview
adminRouter.get('/security', async (_req, res) => {
  try {
    const db = getDb();

    const [authFailures] = await db`
      SELECT COUNT(*)::int as count FROM audit_logs
      WHERE event_type = 'auth_failure'
        AND created_at > NOW() - INTERVAL '24 hours'
    `.catch(() => [{ count: 0 }]);

    const recentFailures = await db`
      SELECT user_id, ip_address, event_type, details, created_at
      FROM audit_logs
      WHERE event_type IN ('auth_failure', 'rate_limit_violation')
      ORDER BY created_at DESC
      LIMIT 20
    `.catch(() => []);

    const [totalUsers] = await db`SELECT COUNT(*)::int as count FROM users`;
    const [verifiedUsers] = await db`SELECT COUNT(*)::int as count FROM users WHERE email_verified = true`;

    res.json({
      authFailures24h: authFailures.count,
      recentEvents: recentFailures,
      totalUsers: totalUsers.count,
      verifiedUsers: verifiedUsers.count,
    });
  } catch (error: any) {
    console.error('[admin] Security error:', error.message);
    res.status(500).json({ error: 'Failed to fetch security data' });
  }
});

// GET /api/admin/audit — all users' audit logs, bypasses org/plan restrictions
adminRouter.get('/audit', async (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const userId = req.query.userId as string | undefined;
    const action = req.query.action as string | undefined;

    let sql = 'SELECT * FROM team_audit_logs WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      sql += ` AND user_id = $${params.length + 1}`;
      params.push(userId);
    }
    if (action) {
      sql += ` AND action = $${params.length + 1}`;
      params.push(action);
    }
    sql += ' ORDER BY created_at DESC';
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const events = await db.unsafe(sql, params);

    const [{ count: total }] = await db`SELECT COUNT(*)::int as count FROM team_audit_logs`;

    res.json({ events, total, limit, offset });
  } catch (error: any) {
    console.error('[admin] Audit error:', error.message);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});
