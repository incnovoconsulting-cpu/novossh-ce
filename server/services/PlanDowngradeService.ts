import { getDb } from '../db/connection.js';
import { Plan, PLAN_LIMITS, ResourceType } from './SubscriptionService.js';
import { EmailService } from './EmailService.js';
import { NotificationDispatcher } from './NotificationDispatcher.js';

export interface ResourceCounts {
  hosts: number;
  snippets: number;
  vaults: number;
  keys: number;
  tabs: number;
}

export interface ExceededResource {
  resource: string;
  current: number;
  limit: number;
}

export interface DowngradedResources {
  plan: Plan;
  previousPlan: Plan;
  exceeded: ExceededResource[];
  requiresAction: boolean;
}

export interface DowngradeAction {
  resourceType: string;
  resourceId: string;
  action: 'read_only' | 'archived' | 'pending_delete';
  gracePeriodEndsAt: Date;
}

const GRACE_PERIOD_DAYS = 30;

export class PlanDowngradeService {
  private db = getDb();
  private emailService = new EmailService();
  private dispatcher = new NotificationDispatcher();

  async getResourceCounts(userId: string): Promise<ResourceCounts> {
    try {
      const resources: ResourceType[] = ['hosts', 'snippets', 'vaults', 'keys', 'tabs'];
      const counts: ResourceCounts = { hosts: 0, snippets: 0, vaults: 0, keys: 0, tabs: 0 };

      for (const resource of resources) {
        const rows = await this.db`
          SELECT count FROM usage_counts
          WHERE user_id = ${userId} AND resource_type = ${resource}
        `;
        counts[resource as keyof ResourceCounts] = rows[0]?.count ?? 0;
      }

      return counts;
    } catch (error) {
      console.error('[PlanDowngradeService] Failed to get resource counts:', error);
      throw error;
    }
  }

  async checkDowngrade(
    userId: string,
    previousPlan: Plan,
    newPlan: Plan
  ): Promise<DowngradedResources | null> {
    try {
      const planOrder: Record<Plan, number> = { free: 0, starter: 1, pro: 2 };
      if (planOrder[newPlan] >= planOrder[previousPlan]) {
        return null;
      }

      const counts = await this.getResourceCounts(userId);
      const newLimits = PLAN_LIMITS[newPlan];
      const exceeded: ExceededResource[] = [];

      if (counts.hosts > newLimits.hosts) {
        exceeded.push({ resource: 'hosts', current: counts.hosts, limit: newLimits.hosts });
      }
      if (counts.snippets > newLimits.snippets) {
        exceeded.push({ resource: 'snippets', current: counts.snippets, limit: newLimits.snippets });
      }
      if (counts.vaults > newLimits.vaults) {
        exceeded.push({ resource: 'vaults', current: counts.vaults, limit: newLimits.vaults });
      }
      if (counts.keys > newLimits.keys) {
        exceeded.push({ resource: 'keys', current: counts.keys, limit: newLimits.keys });
      }
      if (counts.tabs > newLimits.tabs) {
        exceeded.push({ resource: 'tabs', current: counts.tabs, limit: newLimits.tabs });
      }

      if (exceeded.length === 0) {
        return null;
      }

      return {
        plan: newPlan,
        previousPlan,
        exceeded,
        requiresAction: true,
      };
    } catch (error) {
      console.error('[PlanDowngradeService] Failed to check downgrade:', error);
      throw error;
    }
  }

  async handleDowngrade(
    userId: string,
    email: string,
    previousPlan: Plan,
    newPlan: Plan
  ): Promise<{ actions: DowngradeAction[] }> {
    try {
      const downgrade = await this.checkDowngrade(userId, previousPlan, newPlan);
      const actions: DowngradeAction[] = [];

      if (downgrade) {
        // Enforce limits on each exceeded resource
        for (const item of downgrade.exceeded) {
          const resourceActions = await this.enforceResourceLimit(
            userId,
            item.resource as ResourceType,
            item.limit
          );
          actions.push(...resourceActions);
        }

        // Send notification
        await this.sendDowngradeNotification(userId, email, previousPlan, newPlan, downgrade.exceeded);

        // Send email if configured
        if (this.emailService.isEnabled()) {
          await this.emailService.sendPlanDowngradeEmail(email, previousPlan, newPlan, downgrade.exceeded);
        }
      }

      // Log the downgrade event
      await this.logDowngrade(userId, previousPlan, newPlan);

      return { actions };
    } catch (error) {
      console.error('[PlanDowngradeService] Failed to handle downgrade:', error);
      throw error;
    }
  }

  async confirmDowngrade(userId: string): Promise<{ success: boolean; actions: DowngradeAction[] }> {
    try {
      const pendingActions = await this.db`
        SELECT id, user_id, resource_type, resource_id, action, grace_period_ends_at
        FROM plan_downgrade_resources
        WHERE user_id = ${userId} AND resolved_at IS NULL
      `;

      const actions: DowngradeAction[] = [];
      for (const row of pendingActions) {
        const action: DowngradeAction = {
          resourceType: row.resource_type as string,
          resourceId: row.resource_id as string,
          action: row.action as DowngradeAction['action'],
          gracePeriodEndsAt: new Date(row.grace_period_ends_at as string),
        };
        actions.push(action);
      }

      return { success: true, actions };
    } catch (error) {
      console.error('[PlanDowngradeService] Failed to confirm downgrade:', error);
      return { success: false, actions: [] };
    }
  }

  async processExpiredGracePeriods(): Promise<number> {
    try {
      const expired = await this.db`
        SELECT id, user_id, resource_type, resource_id, action
        FROM plan_downgrade_resources
        WHERE resolved_at IS NULL
          AND grace_period_ends_at <= NOW()
      `;

      let processed = 0;
      for (const row of expired) {
        if (row.action === 'pending_delete') {
          // Archive the resource
          await this.archiveResource(row.resource_type as string, row.resource_id as string);
        }
        // Mark as resolved
        await this.db`
          UPDATE plan_downgrade_resources
          SET resolved_at = NOW()
          WHERE id = ${row.id}
        `;
        processed++;
      }

      return processed;
    } catch (error) {
      console.error('[PlanDowngradeService] Failed to process expired grace periods:', error);
      return 0;
    }
  }

  private async enforceResourceLimit(
    userId: string,
    resourceType: ResourceType,
    limit: number
  ): Promise<DowngradeAction[]> {
    const actions: DowngradeAction[] = [];
    const gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Get excess resources (newest first for deletion, oldest first for read-only)
    const excessResources = await this.getExcessResources(userId, resourceType, limit);

    for (let i = 0; i < excessResources.length; i++) {
      const resourceId = excessResources[i];
      let action: DowngradeAction['action'];

      if (resourceType === 'hosts') {
        // Hosts: mark as read-only
        action = 'read_only';
        await this.markHostReadOnly(resourceId);
      } else if (resourceType === 'vaults' || resourceType === 'snippets') {
        // Vaults and snippets: archive excess
        action = 'archived';
        await this.archiveResource(resourceType, resourceId);
      } else {
        // Keys, tabs: pending delete after grace period
        action = 'pending_delete';
      }

      // Track the action
      await this.db`
        INSERT INTO plan_downgrade_resources (user_id, resource_type, resource_id, action, grace_period_ends_at)
        VALUES (${userId}, ${resourceType}, ${resourceId}, ${action}, ${gracePeriodEndsAt})
      `;

      actions.push({
        resourceType,
        resourceId,
        action,
        gracePeriodEndsAt,
      });
    }

    return actions;
  }

  private async getExcessResources(userId: string, resourceType: ResourceType, limit: number): Promise<string[]> {
    let query;

    switch (resourceType) {
      case 'hosts':
        query = this.db`
          SELECT id FROM hosts
          WHERE user_id = ${userId}
          ORDER BY last_connected_at DESC NULLS LAST, created_at DESC
          OFFSET ${limit}
        `;
        break;
      case 'snippets':
        query = this.db`
          SELECT id FROM snippets
          WHERE user_id = ${userId}
          ORDER BY updated_at DESC
          OFFSET ${limit}
        `;
        break;
      case 'vaults':
        query = this.db`
          SELECT id FROM vaults
          WHERE user_id = ${userId}
          ORDER BY updated_at DESC
          OFFSET ${limit}
        `;
        break;
      case 'keys':
        query = this.db`
          SELECT id FROM identity_keys
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          OFFSET ${limit}
        `;
        break;
      case 'tabs':
        query = this.db`
          SELECT id FROM terminal_tabs
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          OFFSET ${limit}
        `;
        break;
      default:
        return [];
    }

    const rows = await query;
    return rows.map((r) => r.id as string);
  }

  private async markHostReadOnly(hostId: string): Promise<void> {
    await this.db`
      UPDATE hosts
      SET is_read_only = true, updated_at = NOW()
      WHERE id = ${hostId}
    `;
  }

  private async archiveResource(resourceType: string, resourceId: string): Promise<void> {
    const tableMap: Record<string, string> = {
      hosts: 'hosts',
      snippets: 'snippets',
      vaults: 'vaults',
      keys: 'identity_keys',
      tabs: 'terminal_tabs',
    };
    const tableName = tableMap[resourceType];
    if (!tableName) return;

    // Use parameterized query — table name is validated against allowlist above
    await this.db.unsafe(
      `UPDATE ${tableName} SET is_archived = true, updated_at = NOW() WHERE id = $1`,
      [resourceId]
    );
  }

  private async sendDowngradeNotification(
    userId: string,
    email: string,
    previousPlan: Plan,
    newPlan: Plan,
    exceeded: ExceededResource[]
  ): Promise<void> {
    const message = exceeded.length > 0
      ? `Your plan has been downgraded from ${previousPlan} to ${newPlan}. Resources exceeding new limits have been restricted with a 30-day grace period.`
      : `Your plan has been downgraded from ${previousPlan} to ${newPlan}.`;

    await this.dispatcher.sendNotification({
      userId,
      type: 'trial_notification',
      priority: 'high',
      title: 'Plan Downgraded',
      message,
      actionUrl: '/settings',
      actionLabel: 'View Plan',
    });
  }

  private async logDowngrade(userId: string, previousPlan: Plan, newPlan: Plan): Promise<void> {
    try {
      const userExists = await this.db<{ id: string }[]>`SELECT id FROM users WHERE id = ${userId} LIMIT 1`;
      if (userExists.length === 0) {
        console.warn(`[PlanDowngradeService] Skipping downgrade log — user ${userId} not found`);
        return;
      }
      await this.db`
        INSERT INTO plan_downgrades (user_id, previous_plan, new_plan, downgraded_at)
        VALUES (${userId}, ${previousPlan}, ${newPlan}, NOW())
      `;
    } catch (error) {
      console.error('[PlanDowngradeService] Failed to log downgrade:', error);
    }
  }
}
