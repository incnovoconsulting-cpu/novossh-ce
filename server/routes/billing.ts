import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import { authMiddleware } from '../middleware/auth.js';
import { SubscriptionService } from '../services/SubscriptionService.js';
import { StripeService } from '../services/StripeService.js';
import { UsageMeterService } from '../services/UsageMeterService.js';
import { UsageAggregationService } from '../services/UsageAggregationService.js';
import { TrialNotificationService } from '../services/TrialNotificationService.js';
import { getDb } from '../db/connection.js';

const router = express.Router();
const subscriptionService = new SubscriptionService();
export const stripeService = new StripeService();
const meterService = new UsageMeterService();
const aggregationService = new UsageAggregationService();
const trialService = new TrialNotificationService();

const APPLE_BUNDLE_ID = 'app.novossh.ios';

/**
 * Verifies an Apple-signed JWS (StoreKit 2 transaction, or an App Store Server
 * Notification / its signed transaction & renewal info). All are ES256-signed with an
 * x5c certificate chain (leaf → intermediate → Apple Root CA - G3) — NOT the RS256 /
 * Sign in with Apple JWKS. Verifies the chain anchors to Apple and the ES256 signature,
 * then returns the decoded payload. Throws on any verification failure.
 */
function verifyAppleSignedJWS(jws: string): any {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWS format');

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as {
    alg?: string; x5c?: string[];
  };
  if (header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length < 2) {
    throw new Error('Invalid JWS header');
  }

  const chain = header.x5c.map((b64) => new crypto.X509Certificate(Buffer.from(b64, 'base64')));
  for (let i = 0; i < chain.length - 1; i++) {
    if (!chain[i].verify(chain[i + 1].publicKey)) throw new Error('Invalid certificate chain');
  }
  const root = chain[chain.length - 1];
  if (!/Apple/i.test(root.issuer) || !root.verify(root.publicKey)) {
    throw new Error('Certificate chain not anchored to Apple');
  }

  // JWS ES256 signatures are raw r||s (IEEE P1363).
  const signature = Buffer.from(parts[2], 'base64url');
  const ok = crypto.createVerify('SHA256')
    .update(parts[0] + '.' + parts[1])
    .verify({ key: chain[0].publicKey, dsaEncoding: 'ieee-p1363' }, signature);
  if (!ok) throw new Error('Invalid JWS signature');

  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

/** Maps a StoreKit product id (com.novossh.<plan>.<cycle>) to a plan tier. */
function planForProduct(productId: string): 'pro' | 'starter' | null {
  if (productId.includes('.pro.')) return 'pro';
  if (productId.includes('.starter.')) return 'starter';
  return null;
}

/**
 * GET /api/billing/subscription
 * Get current subscription and usage
 */
router.get('/subscription', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sub = await subscriptionService.getSubscription(userId);

    const usage: Record<string, number> = {};
    for (const resource of ['hosts', 'snippets', 'vaults', 'keys', 'tabs']) {
      usage[resource] = Number(await subscriptionService.getUsage(userId, resource as any));
    }

    // Include trial fields from the same source the trial banner uses, so the
    // "Trial: N days left" badge can't disagree with "Trial Expires in N Days".
    const trial = await trialService.getTrialStatus(userId);

    res.json({
      plan: sub?.plan ?? 'free',
      status: sub?.status ?? 'active',
      usage,
      trialEnd: trial.trialEnd,
      trialDaysLeft: trial.daysRemaining,
    });
  } catch (error) {
    console.error('[billing] Failed to get subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

/**
 * GET /api/billing/usage/current
 * Get current usage for all resources
 */
router.get('/usage/current', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const statuses = await meterService.getAllQuotaStatuses(userId);

    res.json({
      timestamp: new Date(),
      statuses: statuses.map((s) => ({
        resourceType: s.resourceType,
        currentUsage: s.currentUsage,
        hardLimit: s.hardLimit,
        softLimitWarning: s.softLimitWarning,
        softLimitCritical: s.softLimitCritical,
        usagePercent: s.usagePercent,
        exceeded: s.exceeded,
        status: s.status,
        periodStart: s.periodStart,
        periodEnd: s.periodEnd,
      })),
    });
  } catch (error) {
    console.error('[billing] Failed to get current usage:', error);
    res.status(500).json({ error: 'Failed to get current usage' });
  }
});

/**
 * GET /api/billing/usage/forecast
 * Get usage forecast for all resources
 */
router.get('/usage/forecast', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const forecasts = await meterService.getAllForecasts(userId);

    res.json({
      timestamp: new Date(),
      forecasts: forecasts.map((f) => ({
        resourceType: f.resourceType,
        currentUsage: f.currentUsage,
        dailyAverage: f.dailyAverage,
        projectedEndOfMonth: f.projectedEndOfMonth,
        confidenceLow: f.confidenceLow,
        confidenceHigh: f.confidenceHigh,
        currentDay: f.currentDay,
        totalDays: f.totalDays,
        usagePercent: f.usagePercent,
        exceedanceRisk: f.exceedanceRisk,
      })),
    });
  } catch (error) {
    console.error('[billing] Failed to get forecast:', error);
    res.status(500).json({ error: 'Failed to get forecast' });
  }
});

/**
 * GET /api/billing/usage/history
 * Get historical usage data (hourly, daily, or monthly)
 */
router.get('/usage/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const resource = (req.query.resource as string) || 'api_calls';
    const period = (req.query.period as string) || 'daily'; // 'hourly' (24), 'daily' (30), 'monthly' (12)

    let history;
    if (period === 'hourly') {
      history = await meterService.getHourlyUsage(userId, resource as any, 24);
    } else if (period === 'monthly') {
      // For monthly, we'd need a different method - use daily for now
      history = await meterService.getDailyUsage(userId, resource as any, 30);
    } else {
      history = await meterService.getDailyUsage(userId, resource as any, 30);
    }

    res.json({
      resource,
      period,
      timestamp: new Date(),
      data: history.map((h) => ({
        timestamp: 'dayStart' in h ? h.dayStart : h.hourStart,
        usage: h.usage,
      })),
    });
  } catch (error) {
    console.error('[billing] Failed to get usage history:', error);
    res.status(500).json({ error: 'Failed to get usage history' });
  }
});

/**
 * GET /api/billing/usage/alerts
 * Get unacknowledged quota alerts
 */
router.get('/usage/alerts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const alerts = await meterService.getUnacknowledgedAlerts(userId);

    res.json({
      timestamp: new Date(),
      alerts: alerts.map((a) => ({
        id: a.id,
        resourceType: a.resourceType,
        alertType: a.alertType,
        thresholdPercent: a.thresholdPercent,
        currentUsage: a.currentUsage,
        limitValue: a.limitValue,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('[billing] Failed to get alerts:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * POST /api/billing/usage/alerts/:alertId/acknowledge
 * Acknowledge a quota alert
 */
router.post('/usage/alerts/:alertId/acknowledge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { alertId } = req.params;

    await meterService.acknowledgeAlert(alertId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('[billing] Failed to acknowledge alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

/**
 * GET /api/billing/usage/quotas
 * Get quota configuration for current plan
 */
router.get('/usage/quotas', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sub = await subscriptionService.getSubscription(userId);
    const plan = sub?.plan || 'free';

    const db = getDb();
    const quotas = await db`
      SELECT plan, resource_type, hard_limit, soft_limit_warning, soft_limit_critical, period
      FROM resource_quotas
      WHERE plan = ${plan}
      ORDER BY resource_type
    `;

    res.json({
      plan,
      quotas: quotas.map((q) => ({
        resource: q.resource_type,
        hardLimit: q.hard_limit,
        softLimitWarning: q.soft_limit_warning,
        softLimitCritical: q.soft_limit_critical,
        period: q.period,
      })),
    });
  } catch (error) {
    console.error('[billing] Failed to get quotas:', error);
    res.status(500).json({ error: 'Failed to get quotas' });
  }
});

/**
 * POST /api/billing/usage/metering/events
 * Record custom metering event (for testing)
 */
router.post('/usage/metering/events', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { resourceType, quantity, metadata } = req.body;

    if (!resourceType || quantity === undefined) {
      res.status(400).json({ error: 'Missing resourceType or quantity' });
      return;
    }

    await meterService.recordUsageEvent({
      userId,
      eventType: resourceType,
      resourceType: resourceType as any,
      quantity: parseInt(quantity, 10),
      unit: ['storage_bytes', 'sftp_bytes'].includes(resourceType)
        ? 'bytes'
        : resourceType === 'session_minutes'
        ? 'minutes'
        : 'calls',
      metadata,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[billing] Failed to record metering event:', error);
    res.status(500).json({ error: 'Failed to record metering event' });
  }
});

/**
 * GET /api/billing/usage/aggregation-status
 * Get status of background aggregation jobs
 */
router.get('/usage/aggregation-status', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const jobStatus = await aggregationService.getJobStatus();

    res.json({
      timestamp: new Date(),
      jobs: jobStatus,
    });
  } catch (error) {
    console.error('[billing] Failed to get aggregation status:', error);
    res.status(500).json({ error: 'Failed to get aggregation status' });
  }
});

// ─── Mobile IAP receipt verification ───────────────────────────────────────

/**
 * POST /api/billing/apple/verify
 * Verify a StoreKit 2 signed transaction (JWS) and upgrade the user's plan.
 * Body: { transactionJWS: string }
 */
router.post('/apple/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { transactionJWS } = req.body as { transactionJWS?: string };
    if (!transactionJWS) {
      return res.status(400).json({ error: 'transactionJWS is required' });
    }

    let payload: { productId?: string; bundleId?: string; expiresDate?: number; originalTransactionId?: string };
    try {
      payload = verifyAppleSignedJWS(transactionJWS);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }

    if (payload.bundleId && payload.bundleId !== APPLE_BUNDLE_ID) {
      return res.status(400).json({ error: 'Invalid bundle id' });
    }
    // Auto-renewable subscription: expiresDate is milliseconds since epoch.
    if (payload.expiresDate && payload.expiresDate < Date.now()) {
      return res.status(400).json({ error: 'Transaction expired' });
    }

    const productId = payload.productId ?? '';
    const plan = planForProduct(productId);
    if (!plan) {
      return res.status(400).json({ error: `Unknown product: ${productId}` });
    }

    const userId = (req as any).user?.id;
    await subscriptionService.updateSubscription(userId, plan as any, 'active');
    // Persist the original transaction id so App Store Server Notifications
    // (renew / cancel / expire / refund) can be mapped back to this user.
    if (payload.originalTransactionId) {
      await getDb()`
        UPDATE subscriptions SET apple_original_transaction_id = ${payload.originalTransactionId}
        WHERE user_id = ${userId}
      `;
    }

    return res.json({ ok: true, plan });
  } catch (error) {
    console.error('[billing] apple/verify failed:', error);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/billing/apple/notifications
 * App Store Server Notifications V2 webhook. Apple POSTs { signedPayload } (a JWS) for
 * the full subscription lifecycle — renew, cancel, expire, refund, billing retry, grace
 * period, etc. Unauthenticated (Apple can't send a Bearer/CSRF token); trust is
 * established by verifying the Apple-signed JWS. Always answer 200 so Apple doesn't
 * retry-storm — failures are logged, not surfaced.
 *
 * Configure the URL in App Store Connect → your app → App Information → App Store Server
 * Notifications (Production + Sandbox): https://ssh.novossh.com:8787/api/billing/apple/notifications
 */
router.post('/apple/notifications', async (req: Request, res: Response) => {
  try {
    const { signedPayload } = req.body as { signedPayload?: string };
    if (!signedPayload) {
      return res.status(400).json({ error: 'signedPayload is required' });
    }

    // Verify + decode the outer notification.
    const notification = verifyAppleSignedJWS(signedPayload) as {
      notificationType?: string;
      subtype?: string;
      data?: { bundleId?: string; environment?: string; signedTransactionInfo?: string };
    };
    const notificationType = notification.notificationType ?? '';
    const subtype = notification.subtype ?? '';

    if (notification.data?.bundleId && notification.data.bundleId !== APPLE_BUNDLE_ID) {
      return res.status(200).json({ ok: true }); // not ours — acknowledge & ignore
    }

    const txnJWS = notification.data?.signedTransactionInfo;
    if (!txnJWS) {
      return res.status(200).json({ ok: true }); // nothing transaction-related to apply
    }
    const txn = verifyAppleSignedJWS(txnJWS) as {
      originalTransactionId?: string; productId?: string; expiresDate?: number;
    };

    const otid = txn.originalTransactionId;
    if (!otid) return res.status(200).json({ ok: true });

    // Map the transaction back to a user via the stored original transaction id.
    const rows = await getDb()`
      SELECT user_id FROM subscriptions WHERE apple_original_transaction_id = ${otid} LIMIT 1
    `;
    if (!rows[0]) {
      console.warn(`[apple-notif] ${notificationType}/${subtype}: no user for originalTransactionId ${otid}`);
      return res.status(200).json({ ok: true });
    }
    const userId = rows[0].user_id as string;
    const paidPlan = planForProduct(txn.productId ?? '') ?? 'free';

    // Decide the resulting plan + status from the notification type.
    let plan: 'free' | 'starter' | 'pro' = paidPlan;
    let status: 'active' | 'past_due' | 'canceled' = 'active';
    switch (notificationType) {
      case 'SUBSCRIBED':
      case 'DID_RENEW':
      case 'OFFER_REDEEMED':
      case 'DID_CHANGE_RENEWAL_PREF': // plan up/downgrade at next period; keep entitled now
        status = 'active';
        break;
      case 'DID_CHANGE_RENEWAL_STATUS':
        // Auto-renew toggled on/off. Still entitled until it actually expires.
        status = 'active';
        break;
      case 'DID_FAIL_TO_RENEW':
        // In a billing-retry/grace period the user keeps access; otherwise it's lapsing.
        status = subtype === 'GRACE_PERIOD' ? 'active' : 'past_due';
        break;
      case 'GRACE_PERIOD_EXPIRED':
      case 'EXPIRED':
      case 'REVOKE':
      case 'REFUND':
        plan = 'free';
        status = 'canceled';
        break;
      default:
        return res.status(200).json({ ok: true }); // unhandled type — acknowledge, no change
    }

    await subscriptionService.updateSubscription(userId, plan, status);
    console.log(`[apple-notif] ${notificationType}/${subtype} → user ${userId} set ${plan}/${status}`);
    return res.status(200).json({ ok: true });
  } catch (error) {
    // Acknowledge so Apple doesn't retry endlessly; log for investigation.
    console.error('[billing] apple/notifications failed:', (error as Error).message);
    return res.status(200).json({ ok: true });
  }
});

/**
 * POST /api/billing/google/verify
 * Verify a Google Play subscription purchase and upgrade the user's plan.
 * Body: { purchaseToken: string, productId: string }
 *
 * For production: set env vars GOOGLE_PLAY_SERVICE_ACCOUNT_JSON with service account credentials
 * to enable server-side verification via the Play Developer API.
 */
router.post('/google/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { purchaseToken, productId } = req.body as {
      purchaseToken?: string;
      productId?: string;
    };
    if (!purchaseToken || !productId) {
      return res.status(400).json({ error: 'purchaseToken and productId are required' });
    }

    // Match product IDs using dot notation (com.novossh.pro.monthly, etc.)
    // Previously used underscores which never matched real Google product IDs.
    const plan = productId.includes('.pro.') ? 'pro'
               : productId.includes('.starter.') ? 'starter'
               : null;

    if (!plan) {
      return res.status(400).json({ error: `Unknown product: ${productId}` });
    }

    // Verify purchaseToken via Google Play Developer API
    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      console.error('[billing] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not configured');
      return res.status(500).json({ error: 'Server verification not configured' });
    }

    const { google } = await import('googleapis');
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const androidpublisher = google.androidpublisher({ version: 'v3', auth });

    const packageName = 'com.novossh.app';
    try {
      const result = await androidpublisher.purchases.subscriptions.get({
        packageName,
        subscriptionId: productId,
        token: purchaseToken,
      });

      const subscription = result.data;
      const isCanceled = subscription.cancelReason !== undefined && subscription.cancelReason !== null;
      const expiryTimeMs = parseInt(subscription.expiryTimeMillis || '0', 10);
      const isExpired = expiryTimeMs < Date.now();

      if (isCanceled && isExpired) {
        return res.status(400).json({ error: 'Subscription is expired and canceled' });
      }

      if (isExpired) {
        return res.status(400).json({ error: 'Subscription has expired' });
      }

      // paymentState: 1=received (paid), 2=free trial, 3=free trial intro
      // Reject if payment wasn't received and isn't a trial
      if (subscription.paymentState !== undefined &&
          subscription.paymentState !== 1 &&
          subscription.paymentState !== 2 &&
          subscription.paymentState !== 3) {
        return res.status(400).json({ error: 'Payment not confirmed' });
      }
    } catch (apiError: any) {
      console.error('[billing] Google Play API verification failed:', apiError.message);
      return res.status(400).json({ error: 'Subscription verification failed' });
    }

    const userId = (req as any).user?.id;
    await subscriptionService.updateSubscription(userId, plan as any, 'active');

    return res.json({ ok: true, plan });
  } catch (error) {
    console.error('[billing] google/verify failed:', error);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/billing/create-checkout-session
 * Create a Stripe Checkout session for upgrading to a paid plan
 */
router.post('/create-checkout-session', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const email = (req.user as any).email;
    const { plan, billing } = req.body;

    if (!['starter', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    if (!['monthly', 'annual'].includes(billing)) {
      return res.status(400).json({ error: 'Invalid billing cycle' });
    }

    // Look up email if not in token
    let userEmail = email;
    if (!userEmail) {
      const db = getDb();
      const [user] = await db`SELECT email FROM users WHERE id = ${userId}`;
      userEmail = user?.email;
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'User email not found' });
    }

    const url = await stripeService.createCheckoutSession(userId, userEmail, plan, billing);
    res.json({ url });
  } catch (error: any) {
    console.error('[billing] create-checkout-session error:', error.message);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/billing/create-portal-session
 * Create a Stripe Customer Portal session for managing billing
 */
router.post('/create-portal-session', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const db = getDb();

    const [sub] = await db`SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId} LIMIT 1`;

    if (!sub?.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe subscription found. Apple/Google IAP subscriptions are managed through the App Store / Play Store.' });
    }

    const url = await stripeService.createPortalSession(sub.stripe_customer_id);
    res.json({ url });
  } catch (error: any) {
    console.error('[billing] create-portal-session error:', error.message);
    if (error.message?.includes('Invalid API Key') || error.type === 'StripeAuthenticationError') {
      return res.status(503).json({ error: 'Stripe is not configured. Contact support to manage your subscription.' });
    }
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

export { router as billingRouter };
