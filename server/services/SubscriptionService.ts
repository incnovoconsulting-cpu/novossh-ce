import { getDb } from '../db/connection.js';

export type Plan = 'free' | 'starter' | 'pro';
export type SubscriptionStatus = 'active' | 'past_due' | 'trialing' | 'canceled';
export type ResourceType = 'hosts' | 'snippets' | 'vaults' | 'keys' | 'tabs';

export interface PlanLimits {
  hosts: number;
  snippets: number;
  vaults: number;
  keys: number;
  tabs: number;
  portForwarding: boolean;
  sftpBrowser: boolean;
  commandPalette: boolean;
  mfa: boolean;
  analytics: boolean;
  p2pSync: boolean;
  sessionRecording: boolean;
  auditLogs: boolean;
  teams: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    hosts: 3,
    snippets: 10,
    vaults: 1,
    keys: 2,
    tabs: 2,
    portForwarding: false,
    sftpBrowser: false,
    commandPalette: false,
    mfa: false,
    analytics: false,
    p2pSync: false,
    sessionRecording: false,
    auditLogs: false,
    teams: false,
  },
  starter: {
    hosts: 25,
    snippets: 999999,
    vaults: 999999,
    keys: 999999,
    tabs: 10,
    portForwarding: true,
    sftpBrowser: true,
    commandPalette: true,
    mfa: true,
    analytics: true,
    p2pSync: false,
    sessionRecording: false,
    auditLogs: false,
    teams: false,
  },
  pro: {
    hosts: 999999,
    snippets: 999999,
    vaults: 999999,
    keys: 999999,
    tabs: 999999,
    portForwarding: true,
    sftpBrowser: true,
    commandPalette: true,
    mfa: true,
    analytics: true,
    p2pSync: true,
    sessionRecording: true,
    auditLogs: true,
    teams: true,
  },
};

const PLAN_ORDER: Plan[] = ['free', 'starter', 'pro'];

export class SubscriptionService {
  private db = getDb();

  async getSubscription(userId: string): Promise<{ plan: Plan; status: SubscriptionStatus } | null> {
    try {
      const rows = await this.db`
        SELECT plan, status FROM subscriptions WHERE user_id = ${userId} LIMIT 1
      `;
      return rows[0] ? { plan: rows[0].plan as Plan, status: rows[0].status as SubscriptionStatus } : null;
    } catch (error) {
      console.error('[SubscriptionService] getSubscription failed:', error);
      throw error;
    }
  }

  async createFreeSubscription(userId: string): Promise<void> {
    try {
      await this.db.begin(async (sql) => {
        await sql`
          INSERT INTO subscriptions (user_id, plan, status)
          VALUES (${userId}, 'free', 'active')
          ON CONFLICT (user_id) DO NOTHING
        `;
        const resources: ResourceType[] = ['hosts', 'snippets', 'vaults', 'keys', 'tabs'];
        for (const resource of resources) {
          await sql`
            INSERT INTO usage_counts (user_id, resource_type, count)
            VALUES (${userId}, ${resource}, 0)
            ON CONFLICT (user_id, resource_type) DO NOTHING
          `;
        }
      });
    } catch (error) {
      console.error('[SubscriptionService] createFreeSubscription failed:', error);
      throw error;
    }
  }

  async updateSubscription(
    userId: string,
    plan: Plan,
    status: SubscriptionStatus,
    stripeData?: {
      customerId?: string;
      subscriptionId?: string;
      trialStart?: Date;
      trialEnd?: Date;
    }
  ): Promise<void> {
    try {
      await this.db`
        UPDATE subscriptions
        SET plan = ${plan}, status = ${status},
            stripe_customer_id = COALESCE(${stripeData?.customerId ?? null}, stripe_customer_id),
            stripe_subscription_id = COALESCE(${stripeData?.subscriptionId ?? null}, stripe_subscription_id),
            trial_start = COALESCE(${stripeData?.trialStart ?? null}, trial_start),
            trial_end = COALESCE(${stripeData?.trialEnd ?? null}, trial_end),
            updated_at = NOW()
        WHERE user_id = ${userId}
      `;
    } catch (error) {
      console.error('[SubscriptionService] updateSubscription failed:', error);
      throw error;
    }
  }

  async getUsage(userId: string, resourceType: ResourceType): Promise<number> {
    try {
      const rows = await this.db`
        SELECT count FROM usage_counts WHERE user_id = ${userId} AND resource_type = ${resourceType}
      `;
      return rows[0]?.count ?? 0;
    } catch (error) {
      console.error('[SubscriptionService] getUsage failed:', error);
      throw error;
    }
  }

  async incrementUsage(userId: string, resourceType: ResourceType): Promise<number> {
    try {
      const rows = await this.db`
        INSERT INTO usage_counts (user_id, resource_type, count)
        VALUES (${userId}, ${resourceType}, 1)
        ON CONFLICT (user_id, resource_type) DO UPDATE SET count = usage_counts.count + 1, updated_at = NOW()
        RETURNING count
      `;
      return rows[0].count;
    } catch (error) {
      console.error('[SubscriptionService] incrementUsage failed:', error);
      throw error;
    }
  }

  async decrementUsage(userId: string, resourceType: ResourceType): Promise<number> {
    try {
      const rows = await this.db`
        UPDATE usage_counts SET count = GREATEST(count - 1, 0), updated_at = NOW()
        WHERE user_id = ${userId} AND resource_type = ${resourceType}
        RETURNING count
      `;
      return rows[0]?.count ?? 0;
    } catch (error) {
      console.error('[SubscriptionService] decrementUsage failed:', error);
      throw error;
    }
  }

  async checkLimit(
    userId: string,
    resourceType: ResourceType
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    try {
      const rows = await this.db`
        SELECT
          COALESCE(s.plan, 'free') as plan,
          COALESCE(u.count, 0) as current_count
        FROM (SELECT ${userId}::uuid as user_id) target
        LEFT JOIN subscriptions s ON s.user_id = target.user_id
        LEFT JOIN usage_counts u ON u.user_id = target.user_id AND u.resource_type = ${resourceType}
      `;
      const plan = (rows[0]?.plan ?? 'free') as Plan;
      const current = rows[0]?.current_count ?? 0;
      const limit = PLAN_LIMITS[plan][resourceType];
      return { allowed: current < limit, current, limit };
    } catch (error) {
      console.error('[SubscriptionService] checkLimit failed:', error);
      throw error;
    }
  }

  /**
   * Atomically check limit and increment if allowed.
   * Prevents TOCTOU race condition where concurrent requests exceed the limit.
   * Returns null if the limit would be exceeded (does NOT increment).
   */
  async incrementIfAllowed(
    userId: string,
    resourceType: ResourceType
  ): Promise<{ current: number; limit: number } | null> {
    try {
      return await this.db.begin(async (sql) => {
        const rows = await sql`
          SELECT
            COALESCE(s.plan, 'free') as plan,
            COALESCE(u.count, 0) as current_count
          FROM (SELECT ${userId}::uuid as user_id) target
          LEFT JOIN subscriptions s ON s.user_id = target.user_id
          LEFT JOIN usage_counts u ON u.user_id = target.user_id AND u.resource_type = ${resourceType}
          FOR UPDATE OF u
        `;
        const plan = (rows[0]?.plan ?? 'free') as Plan;
        const current = rows[0]?.current_count ?? 0;
        const limit = PLAN_LIMITS[plan][resourceType];

        if (current >= limit) {
          return null; // Limit reached, do not increment
        }

        await sql`
          INSERT INTO usage_counts (user_id, resource_type, count)
          VALUES (${userId}, ${resourceType}, 1)
          ON CONFLICT (user_id, resource_type) DO UPDATE SET count = usage_counts.count + 1, updated_at = NOW()
        `;

        return { current: current + 1, limit };
      });
    } catch (error) {
      console.error('[SubscriptionService] incrementIfAllowed failed:', error);
      throw error;
    }
  }

  planHasFeature(plan: Plan, feature: keyof PlanLimits): boolean {
    return !!PLAN_LIMITS[plan][feature];
  }

  planMeetsRequired(currentPlan: Plan, requiredPlan: Plan): boolean {
    return PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(requiredPlan);
  }
}
