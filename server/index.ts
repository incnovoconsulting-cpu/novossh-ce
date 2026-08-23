import express from 'express';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { version } = require('../package.json');
import { WebSocketServer } from 'ws';
import { handleSshConnection } from './ssh.js';
import { attachConnectionMetadata } from './connectionRouter.js';
import { vaultRouter } from './routes/vaults.js';
import { entriesRouter } from './routes/entries.js';
import { vaultKeysRouter } from './routes/vaultKeys.js';
import { syncRouter } from './routes/sync.js';
import { sharingRouter } from './routes/sharing.js';
import { teamRouter } from './routes/teams.js';
import { sessionRouter } from './routes/sessions.js';
import auditRouter from './routes/audit.js';
import { p2pRouter } from './routes/p2p.js';
import { authRouter } from './routes/auth.js';
import { emailVerificationRouter } from './routes/emailVerification.js';
import { billingRouter, stripeService } from './routes/billing.js';
import { trialRouter } from './routes/trial.js';
import { monitoringRouter } from './routes/monitoring.js';
import { samlRouter } from './routes/saml.js';
import { webauthnRouter } from './routes/webauthn.js';
import analyticsRouter from './routes/analytics.js';
import notificationsRouter from './routes/notifications.js';
import { portalRouter } from './routes/portal.js';
import { connectionsRouter } from './routes/connections.js';
import { tailscaleRouter } from './routes/tailscale.js';
import { sftpRouter } from './routes/sftp.js';
import { mobileSyncRouter } from './routes/mobile-sync.js';
import organizationsRouter from './routes/organizations.js';
import invitationsRouter from './routes/invitations.js';
import { optionalAuthMiddleware, authMiddleware } from './middleware/auth.js';
import { requireOwner } from './middleware/admin.js';
import { adminRouter } from './routes/admin.js';
import { verifyToken } from './auth.js';
import { destroyRateLimitStore, authRateLimit, billingRateLimit, apiReadRateLimit, apiWriteRateLimit, connectionRateLimit, sftpRateLimit, p2pRateLimit, notificationRateLimit, analyticsRateLimit, teamRateLimit, createRateLimitMiddleware } from './middleware/rateLimit.js';
import { csrfProtection } from './middleware/csrf.js';
import { runMigrations } from './db/connection.js';
import { loadRevokedTokens } from './auth.js';
import { createMonitoringMiddleware, initMonitoring, destroyMonitoring } from './middleware/monitoring.js';
import { requireLicense } from './middleware/license.js';
import { requirePlan } from './middleware/planGate.js';
import { TrialNotificationService } from './services/TrialNotificationService.js';
import { NotificationScheduler } from './services/NotificationScheduler.js';
import { connectionCleanupService } from './services/ConnectionCleanupService.js';

// Initialize monitoring
initMonitoring();

const app = express();

// CORS
const isProduction = process.env.NODE_ENV === 'production';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .filter(Boolean)
  .concat([
    // Localhost origins only in non-production
    ...(isProduction ? [] : ['http://localhost:5173', 'http://localhost:8787']),
    'https://novossh-github.pages.dev',
    'https://novossh.com',
  ]);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin!);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Request-Id, X-CSRF-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for now — needs per-route CSP tuning
  crossOriginEmbedderPolicy: false, // Disabled for WebSocket compatibility
}));

// Stripe webhook — must be BEFORE express.json() to get raw body for signature verification
// Rate-limited to prevent CPU-flooding via invalid HMAC verification
const webhookRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: 'Webhook rate limit exceeded.',
});
app.post('/api/billing/webhook', webhookRateLimit, express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }
  try {
    await stripeService.handleWebhook(req.body as Buffer, signature);
    res.json({ received: true });
  } catch (error: any) {
    console.error('[billing] Webhook error:', error.message);
    res.status(400).json({ error: 'Webhook verification failed' });
  }
});

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// CSRF protection for state-changing requests (double-submit cookie pattern)
app.use(csrfProtection);

// Monitoring middleware - track all requests
app.use(createMonitoringMiddleware());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'novossh', version });
});

// License check for production (after health, before API routes)
app.use('/api', requireLicense);

// Auth routes (no auth required, but rate limited)
app.use('/api/auth', authRateLimit, authRouter);

// Email verification routes (require auth)
app.use('/api/auth', emailVerificationRouter);

// Billing API routes (Stripe integration)
app.use('/api/billing', billingRateLimit, billingRouter);

// Trial and downgrade routes
app.use('/api/billing', billingRateLimit, trialRouter);

// Optional auth middleware for all subsequent routes
// This allows routes to work with or without JWT, falling back to header-based auth
app.use(optionalAuthMiddleware);

// Owner-only admin routes
app.use('/api/admin', authMiddleware, requireOwner, adminRouter);

app.use('/api/sync', mobileSyncRouter);
// Free tier is documented (BillingView.swift etc.) to include 1 vault, so basic
// vault CRUD, entries, and key registration must stay reachable below starter —
// vaults.ts itself caps creation at PLAN_LIMITS[plan].vaults per request. Only
// the genuinely premium add-ons (cross-device sync, sharing) are starter+ gated.
app.use('/api/vaults', apiWriteRateLimit, vaultRouter);
app.use('/api/vaults', apiWriteRateLimit, entriesRouter);
app.use('/api/vaults', requirePlan('starter'), syncRouter);
app.use('/api/vaults', requirePlan('starter'), sharingRouter);
app.use('/api/vault-keys', apiWriteRateLimit, vaultKeysRouter);

app.use('/api/teams', requirePlan('pro'), teamRateLimit, teamRouter);
app.use('/api/organizations', requirePlan('pro'), teamRateLimit, organizationsRouter);
app.use('/api', requirePlan('pro'), teamRateLimit, invitationsRouter);
app.use('/api/invitations', requirePlan('pro'), teamRateLimit, invitationsRouter);
app.use('/api/sessions', requirePlan('pro'), sessionRouter);
app.use('/api/audit', requirePlan('pro'), apiReadRateLimit, auditRouter);
app.use('/api/p2p', requirePlan('pro'), p2pRateLimit, p2pRouter);
app.use('/api/monitoring', requirePlan('pro'), apiReadRateLimit, monitoringRouter);
app.use('/api/notifications', notificationRateLimit, notificationsRouter);
app.use('/api/saml', requirePlan('pro'), teamRateLimit, samlRouter);
app.use('/api/webauthn', requirePlan('starter'), teamRateLimit, webauthnRouter);
// analytics is a starter+ feature per PLAN_LIMITS.starter.analytics (and iOS's
// PaywallService, which requires only .starter) — this was mounted at 'pro',
// wrongly blocking starter subscribers from a feature their plan includes.
app.use('/api/analytics', requirePlan('starter'), analyticsRateLimit, analyticsRouter);
app.use('/api/portal', billingRateLimit, portalRouter);
app.use('/api/connections', connectionRateLimit, connectionsRouter);
app.use('/api/tailscale', apiReadRateLimit, tailscaleRouter);
app.use('/api/sftp', requirePlan('starter'), sftpRateLimit, sftpRouter);

// Global error handler — catches unhandled errors in async route handlers
// and prevents process crashes or stack trace leaks to clients
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled error:', err?.message || err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

// Start background schedulers
const trialNotificationService = new TrialNotificationService();
const notificationScheduler = new NotificationScheduler();

// Start connection attempt cleanup (deletes attempts older than 90 days)
connectionCleanupService.startPeriodicCleanup();

// Reconcile subscriptions against Stripe every 15 minutes — safety net for
// missed/failed webhook deliveries (e.g. the endpoint being misconfigured).
setInterval(async () => {
  try {
    await stripeService.reconcileSubscriptions();
  } catch (err) {
    console.error('Subscription reconciliation failed:', err);
  }
}, 15 * 60 * 1000);
stripeService.reconcileSubscriptions().catch((err) => {
  console.error('Initial subscription reconciliation failed:', err);
});

// Run trial notifications every 6 hours
setInterval(async () => {
  try {
    await trialNotificationService.sendTrialExpiringNotifications();
  } catch (err) {
    // Notification scheduler error
  }
}, 6 * 60 * 60 * 1000);

// Run notification processor every hour
setInterval(async () => {
  try {
    await notificationScheduler.processDueNotifications();
  } catch (err) {
    console.error('[notificationScheduler] processDueNotifications failed:', err);
  }
}, 60 * 60 * 1000);

// Initial run on startup
setTimeout(async () => {
  try {
    await trialNotificationService.sendTrialExpiringNotifications();
  } catch (err) {
    console.error('[trialNotificationService] Initial run failed:', err);
  }
}, 10_000);

// Create server with HTTPS if certs available, otherwise HTTP
const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';

let server: http.Server | https.Server;

const certPath = process.env.SSL_CERT_PATH || '/tmp/server.crt';
const keyPath = process.env.SSL_KEY_PATH || '/tmp/server.key';

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const cert = fs.readFileSync(certPath);
  const key = fs.readFileSync(keyPath);
  server = https.createServer({ cert, key }, app);
} else {
  server = http.createServer(app);
}

const wss = new WebSocketServer({
  server,
  path: '/ws/ssh',
  verifyClient: (info, callback) => {
    const origin = info.origin;
    if (origin && !isAllowedOrigin(origin)) {
      callback(false, 403, 'Origin not allowed');
      return;
    }
    callback(true);
  },
});

wss.on('connection', (ws, req) => {
  // Verify JWT from authorization header only (query string auth is removed —
  // JWTs in URLs leak to logs, proxy history, and browser referrer headers)
  const headerToken = req.headers.authorization?.replace('Bearer ', '');

  if (!headerToken) {
    ws.close(4001, 'Authentication required');
    return;
  }

  const decoded = verifyToken(headerToken);
  if (!decoded || decoded.type !== 'access') {
    ws.close(4001, 'Invalid or expired token');
    return;
  }
  (ws as any).userId = decoded.userId;
  (ws as any).organizationId = decoded.organizationId;

  const getConnectionMetadata = attachConnectionMetadata(ws, req);
  handleSshConnection(ws, getConnectionMetadata, decoded.userId);
});

// Run migrations before starting server
runMigrations().then(() => loadRevokedTokens()).catch((err) => {
  console.error('[migrations] Failed:', err.message);
});

server.listen(PORT, HOST, () => {
  // Server started
});

// Graceful shutdown - cleanup resources
process.on('SIGTERM', () => {
  destroyRateLimitStore();
  destroyMonitoring();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  destroyRateLimitStore();
  destroyMonitoring();
  server.close(() => {
    process.exit(0);
  });
});
