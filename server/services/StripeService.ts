import Stripe from 'stripe';
import { Plan, SubscriptionService } from './SubscriptionService.js';
import { PlanDowngradeService } from './PlanDowngradeService.js';
import { getDb } from '../db/connection.js';

export class StripeService {
  private stripe: Stripe | null = null;
  private subscriptionService: SubscriptionService;
  private planDowngradeService: PlanDowngradeService;
  private processedEvents: Set<string> = new Set();

  constructor() {
    this.subscriptionService = new SubscriptionService();
    this.planDowngradeService = new PlanDowngradeService();
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
      this.stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' });
    }
    return this.stripe;
  }

  async createCheckoutSession(userId: string, email: string, plan: Plan, billing: 'monthly' | 'annual' = 'monthly'): Promise<string> {
    const stripe = this.getStripe();
    let priceId: string;
    if (plan === 'starter') {
      priceId = billing === 'annual'
        ? process.env.STRIPE_STARTER_ANNUAL_PRICE_ID!
        : process.env.STRIPE_STARTER_MONTHLY_PRICE_ID!;
    } else {
      priceId = billing === 'annual'
        ? process.env.STRIPE_PRO_ANNUAL_PRICE_ID!
        : process.env.STRIPE_PRO_MONTHLY_PRICE_ID!;
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 7,
        metadata: { userId, plan },
      },
      success_url: `${process.env.FRONTEND_URL}/settings?billing=success`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?billing=canceled`,
      metadata: { userId, plan },
    });

    if (!session.url) {
      throw new Error('Stripe checkout session URL was not generated');
    }
    return session.url;
  }

  async createPortalSession(stripeCustomerId: string): Promise<string> {
    const stripe = this.getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/settings`,
    });

    return session.url;
  }

  async getUserEmail(userId: string): Promise<string | null> {
    const db = getDb();
    const rows = await db`
      SELECT email FROM users WHERE id = ${userId} LIMIT 1
    `;
    return rows[0]?.email ?? null;
  }

  async handleWebhook(body: Buffer, signature: string): Promise<void> {
    const stripe = this.getStripe();
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // Idempotency: skip already-processed events
    if (this.processedEvents.has(event.id)) {
      return;
    }
    this.processedEvents.add(event.id);

    // Prevent memory leak: cap the set at 10k entries
    if (this.processedEvents.size > 10000) {
      const first = this.processedEvents.values().next().value!;
      this.processedEvents.delete(first);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata!.userId;
        const plan = session.metadata!.plan as Plan;
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const status = subscription.status === 'trialing' ? 'trialing' : 'active';
        await this.subscriptionService.updateSubscription(userId, plan, status, {
          customerId: session.customer as string,
          subscriptionId: subscription.id,
          trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
          trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;
        if (!userId) break;
        const plan = subscription.metadata.plan as Plan;
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          await this.subscriptionService.updateSubscription(userId, plan, subscription.status, {
            trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
          });
        } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
          const previousPlan = plan;
          await this.subscriptionService.updateSubscription(userId, 'free', 'active');
          await this.planDowngradeService.handleDowngrade(userId, '', previousPlan, 'free');
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice.parent?.subscription_details?.subscription ?? (invoice as any).subscription) as string | null;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata.userId;
        await this.subscriptionService.updateSubscription(userId, subscription.metadata.plan as Plan, 'active');
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice.parent?.subscription_details?.subscription ?? (invoice as any).subscription) as string | null;
        if (!subscriptionId) break;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata.userId;
        await this.subscriptionService.updateSubscription(userId, subscription.metadata.plan as Plan, 'past_due');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata.userId;
        const previousPlan = (subscription.metadata.plan as Plan) || 'free';
        await this.subscriptionService.updateSubscription(userId, 'free', 'active');
        await this.planDowngradeService.handleDowngrade(userId, '', previousPlan, 'free');
        break;
      }
    }
  }

  /**
   * Safety net for missed/failed webhook deliveries (e.g. the endpoint being
   * misconfigured or briefly disabled). Walks every Stripe subscription with
   * userId/plan metadata and makes our DB match Stripe's view of the world.
   * Idempotent — safe to run repeatedly on a schedule.
   */
  async reconcileSubscriptions(): Promise<{ checked: number; corrected: number }> {
    const stripe = this.getStripe();
    let checked = 0;
    let corrected = 0;

    for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
      const userId = subscription.metadata.userId;
      const plan = subscription.metadata.plan as Plan | undefined;
      if (!userId || !plan) continue;
      checked++;

      const current = await this.subscriptionService.getSubscription(userId);

      if (subscription.status === 'active' || subscription.status === 'trialing') {
        if (current?.plan !== plan || current?.status !== subscription.status) {
          await this.subscriptionService.updateSubscription(userId, plan, subscription.status, {
            customerId: subscription.customer as string,
            subscriptionId: subscription.id,
            trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
          });
          corrected++;
        }
      } else if (subscription.status === 'past_due') {
        if (current?.status !== 'past_due') {
          await this.subscriptionService.updateSubscription(userId, plan, 'past_due');
          corrected++;
        }
      } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        if (current?.plan !== 'free') {
          await this.subscriptionService.updateSubscription(userId, 'free', 'active');
          await this.planDowngradeService.handleDowngrade(userId, '', plan, 'free');
          corrected++;
        }
      }
    }

    if (corrected > 0) {
      console.log(`StripeService: reconciliation checked ${checked} subscriptions, corrected ${corrected}`);
    }
    return { checked, corrected };
  }
}
