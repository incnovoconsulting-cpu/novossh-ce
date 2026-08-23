import { getDb } from '../db/connection.js';

export interface AuditEvent {
  id: string;
  organization_id: string;
  team_id?: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface DetailedAuditEvent extends AuditEvent {
  severity?: 'low' | 'medium' | 'high' | 'critical';
  requestId?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  changes?: Record<string, { before: unknown; after: unknown }>;
}

export interface AuditFilter {
  teamId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ComplianceReport {
  organization_id: string;
  report_type: string;
  generated_at: Date;
  events_count: number;
  users_count: number;
  actions: string[];
  retention_days: number;
  last_purge_date?: Date;
}

export interface RetentionPolicy {
  id: string;
  organization_id: string;
  team_audit_retention_days: number;
  session_recording_retention_days: number;
  last_purged_at?: Date;
  updated_at: Date;
}

export class AuditService {
  private db = getDb();

  async logEvent(
    organizationId: string,
    teamId: string | undefined,
    userId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditEvent> {
    const result = await this.db`
      INSERT INTO team_audit_logs (
        organization_id, team_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent
      )
      VALUES (
        ${organizationId}, ${teamId || null}, ${userId}, ${action}, ${resourceType},
        ${resourceId || null}, ${details ? JSON.stringify(details) : null}, ${ipAddress || null}, ${userAgent || null}
      )
      RETURNING *
    `;

    return this.mapAuditEvent(result[0]);
  }

  async getAuditLog(organizationId: string, filters?: AuditFilter): Promise<AuditEvent[]> {
    let query = this.db`SELECT * FROM team_audit_logs WHERE organization_id = ${organizationId}`;

    if (filters?.teamId) {
      query = this.db`${query} AND team_id = ${filters.teamId}`;
    }
    if (filters?.userId) {
      query = this.db`${query} AND user_id = ${filters.userId}`;
    }
    if (filters?.action) {
      query = this.db`${query} AND action = ${filters.action}`;
    }
    if (filters?.resourceType) {
      query = this.db`${query} AND resource_type = ${filters.resourceType}`;
    }
    if (filters?.startDate) {
      query = this.db`${query} AND created_at >= ${filters.startDate}`;
    }
    if (filters?.endDate) {
      query = this.db`${query} AND created_at <= ${filters.endDate}`;
    }

    query = this.db`${query} ORDER BY created_at DESC`;

    if (filters?.limit) {
      query = this.db`${query} LIMIT ${filters.limit}`;
    }
    if (filters?.offset) {
      query = this.db`${query} OFFSET ${filters.offset}`;
    }

    const result = await query;
    return (result as unknown[]).map((event) => this.mapAuditEvent(event));
  }

  async getEventCount(organizationId: string, filters?: AuditFilter): Promise<number> {
    let query = this.db`SELECT COUNT(*) as count FROM team_audit_logs WHERE organization_id = ${organizationId}`;

    if (filters?.teamId) {
      query = this.db`${query} AND team_id = ${filters.teamId}`;
    }
    if (filters?.userId) {
      query = this.db`${query} AND user_id = ${filters.userId}`;
    }
    if (filters?.action) {
      query = this.db`${query} AND action = ${filters.action}`;
    }
    if (filters?.startDate) {
      query = this.db`${query} AND created_at >= ${filters.startDate}`;
    }
    if (filters?.endDate) {
      query = this.db`${query} AND created_at <= ${filters.endDate}`;
    }

    const result = await query;
    return (result[0] as { count: number }).count;
  }

  async getUniqueUsers(organizationId: string, filters?: AuditFilter): Promise<string[]> {
    let query = this.db`SELECT DISTINCT user_id FROM team_audit_logs WHERE organization_id = ${organizationId}`;

    if (filters?.teamId) {
      query = this.db`${query} AND team_id = ${filters.teamId}`;
    }
    if (filters?.startDate) {
      query = this.db`${query} AND created_at >= ${filters.startDate}`;
    }
    if (filters?.endDate) {
      query = this.db`${query} AND created_at <= ${filters.endDate}`;
    }

    const result = await query as any[];
    return result.map((r: any) => r.user_id);
  }

  async getUniqueActions(organizationId: string): Promise<string[]> {
    const result = await this.db`
      SELECT DISTINCT action FROM team_audit_logs
      WHERE organization_id = ${organizationId}
      ORDER BY action
    ` as any[];
    return result.map((r: any) => r.action);
  }

  async exportAuditLog(organizationId: string, format: 'csv' | 'json', filters?: AuditFilter): Promise<string> {
    const events = await this.getAuditLog(organizationId, { ...filters, limit: 10000 });

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    } else if (format === 'csv') {
      return this.convertToCsv(events);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  async generateComplianceReport(organizationId: string, filters?: AuditFilter): Promise<ComplianceReport> {
    const eventCount = await this.getEventCount(organizationId, filters);
    const users = await this.getUniqueUsers(organizationId, filters);
    const actions = await this.getUniqueActions(organizationId);

    const policy = await this.getRetentionPolicy(organizationId);

    return {
      organization_id: organizationId,
      report_type: 'compliance',
      generated_at: new Date(),
      events_count: eventCount,
      users_count: users.length,
      actions,
      retention_days: policy?.team_audit_retention_days || 90,
      last_purge_date: policy?.last_purged_at,
    };
  }

  async setRetentionPolicy(
    organizationId: string,
    teamAuditRetentionDays: number,
    sessionRecordingRetentionDays: number
  ): Promise<RetentionPolicy> {
    const result = await this.db`
      INSERT INTO audit_retention (organization_id, team_audit_retention_days, session_recording_retention_days, updated_at)
      VALUES (${organizationId}, ${teamAuditRetentionDays}, ${sessionRecordingRetentionDays}, NOW())
      ON CONFLICT (organization_id) DO UPDATE
      SET team_audit_retention_days = ${teamAuditRetentionDays},
          session_recording_retention_days = ${sessionRecordingRetentionDays},
          updated_at = NOW()
      RETURNING *
    `;

    return this.mapRetentionPolicy(result[0]);
  }

  async getRetentionPolicy(organizationId: string): Promise<RetentionPolicy | null> {
    const result = await this.db`
      SELECT * FROM audit_retention WHERE organization_id = ${organizationId}
    `;

    return result.length > 0 ? this.mapRetentionPolicy(result[0]) : null;
  }

  async purgeOldLogs(organizationId: string): Promise<number> {
    const policy = await this.getRetentionPolicy(organizationId);
    if (!policy) {
      // Default to 90 days if no policy is set
      await this.setRetentionPolicy(organizationId, 90, 30);
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.team_audit_retention_days);

    const result = await this.db`
      DELETE FROM team_audit_logs
      WHERE organization_id = ${organizationId} AND created_at < ${cutoffDate}
      RETURNING id
    `;

    await this.db`
      UPDATE audit_retention
      SET last_purged_at = NOW()
      WHERE organization_id = ${organizationId}
    `;

    return result.length;
  }

  async purgeOldRecordings(organizationId: string): Promise<number> {
    const policy = await this.getRetentionPolicy(organizationId);
    if (!policy) {
      return 0;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.session_recording_retention_days);

    const recordings = await this.db`
      SELECT r.id FROM recordings r
      JOIN sessions s ON r.session_id = s.id
      JOIN teams t ON s.team_id = t.id
      WHERE t.organization_id = ${organizationId} AND r.created_at < ${cutoffDate}
    `;

    // Delete recording keys first (foreign key constraint)
    for (const rec of recordings as unknown as { id: string }[]) {
      await this.db`DELETE FROM recording_keys WHERE recording_id = ${rec.id}`;
    }

    const deletedCount = await this.db`
      DELETE FROM recordings r
      WHERE r.session_id IN (
        SELECT s.id FROM sessions s
        JOIN teams t ON s.team_id = t.id
        WHERE t.organization_id = ${organizationId} AND r.created_at < ${cutoffDate}
      )
      RETURNING id
    `;

    return deletedCount.length;
  }

  async getAuditSummary(organizationId: string, days: number = 30): Promise<Record<string, unknown>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const filters: AuditFilter = {
      startDate,
      limit: 10000,
    };

    const events = await this.getAuditLog(organizationId, filters);
    const actionCounts = this.countByAction(events);
    const userCounts = this.countByUser(events);

    return {
      period_days: days,
      start_date: startDate,
      total_events: events.length,
      actions: actionCounts,
      users: userCounts,
      unique_users: new Set(events.map((e) => e.user_id)).size,
    };
  }

  private mapAuditEvent(event: unknown): AuditEvent {
    const e = event as Record<string, unknown>;
    return {
      id: e.id as string,
      organization_id: e.organization_id as string,
      team_id: e.team_id as string | undefined,
      user_id: e.user_id as string,
      action: e.action as string,
      resource_type: e.resource_type as string,
      resource_id: e.resource_id as string | undefined,
      details: e.details as Record<string, unknown> | undefined,
      ip_address: e.ip_address as string | undefined,
      user_agent: e.user_agent as string | undefined,
      created_at: new Date(e.created_at as string),
    };
  }

  private mapRetentionPolicy(policy: unknown): RetentionPolicy {
    const p = policy as Record<string, unknown>;
    return {
      id: p.id as string,
      organization_id: p.organization_id as string,
      team_audit_retention_days: p.team_audit_retention_days as number,
      session_recording_retention_days: p.session_recording_retention_days as number,
      last_purged_at: p.last_purged_at ? new Date(p.last_purged_at as string) : undefined,
      updated_at: new Date(p.updated_at as string),
    };
  }

  private convertToCsv(events: AuditEvent[]): string {
    if (events.length === 0) {
      return '';
    }

    const headers = ['id', 'organization_id', 'team_id', 'user_id', 'action', 'resource_type', 'resource_id', 'created_at'];
    const rows = events.map((e) => [
      e.id,
      e.organization_id,
      e.team_id || '',
      e.user_id,
      e.action,
      e.resource_type,
      e.resource_id || '',
      e.created_at.toISOString(),
    ]);

    const headerRow = headers.join(',');
    const dataRows = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));

    return [headerRow, ...dataRows].join('\n');
  }

  private countByAction(events: AuditEvent[]): Record<string, number> {
    return events.reduce(
      (acc, event) => {
        acc[event.action] = (acc[event.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private countByUser(events: AuditEvent[]): Record<string, number> {
    return events.reduce(
      (acc, event) => {
        acc[event.user_id] = (acc[event.user_id] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  async logSensitiveDataAccess(
    organizationId: string,
    teamId: string | undefined,
    userId: string,
    resourceType: 'vault' | 'entry' | 'encryption_key',
    resourceId: string,
    accessType: 'read' | 'export' | 'decrypt',
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.logEvent(
      organizationId,
      teamId,
      userId,
      `data_access:${accessType}`,
      resourceType,
      resourceId,
      {
        accessType,
        severity: 'high',
        ...details,
      },
      ipAddress,
      userAgent
    );
  }

  async logPermissionChange(
    organizationId: string,
    teamId: string,
    userId: string,
    targetUserId: string,
    changeType: 'role_updated' | 'member_added' | 'member_removed' | 'permission_granted' | 'permission_revoked',
    beforeState: Record<string, unknown>,
    afterState: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, unknown>
  ): Promise<AuditEvent> {
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of new Set([...Object.keys(beforeState), ...Object.keys(afterState)])) {
      if (beforeState[key] !== afterState[key]) {
        changes[key] = {
          before: beforeState[key],
          after: afterState[key],
        };
      }
    }

    return this.logEvent(
      organizationId,
      teamId,
      userId,
      changeType,
      'team_member',
      targetUserId,
      {
        severity: 'high',
        targetUserId,
        beforeState,
        afterState,
        changes,
        ...details,
      },
      ipAddress,
      userAgent
    );
  }

  async logAuthenticationEvent(
    organizationId: string,
    userId: string,
    eventType: 'login' | 'logout' | 'token_refresh' | 'failed_login',
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, unknown>
  ): Promise<AuditEvent> {
    return this.logEvent(
      organizationId,
      undefined,
      userId,
      `auth:${eventType}`,
      'authentication',
      undefined,
      {
        success,
        severity: success ? 'medium' : 'high',
        ...details,
      },
      ipAddress,
      userAgent
    );
  }

  async logSessionExport(
    organizationId: string,
    teamId: string,
    userId: string,
    sessionId: string,
    format: 'bash' | 'json',
    commandCount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditEvent> {
    return this.logEvent(
      organizationId,
      teamId,
      userId,
      'session:export',
      'session',
      sessionId,
      {
        format,
        commandCount,
        severity: 'high',
        exportType: 'session_script',
      },
      ipAddress,
      userAgent
    );
  }

  async logPlaybackAccess(
    organizationId: string,
    teamId: string,
    userId: string,
    sessionId: string,
    commandsViewed?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuditEvent> {
    return this.logEvent(
      organizationId,
      teamId,
      userId,
      'session:playback:access',
      'session',
      sessionId,
      {
        commandsViewed: commandsViewed || 0,
        severity: 'medium',
        playbackAccess: true,
      },
      ipAddress,
      userAgent
    );
  }

  async queryAuditEvents(
    organizationId: string,
    filters: {
      teamId?: string;
      userId?: string;
      action?: string;
      resourceType?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      startDate?: Date;
      endDate?: Date;
      ipAddress?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<AuditEvent[]> {
    let query = this.db`SELECT * FROM team_audit_logs WHERE organization_id = ${organizationId}`;

    if (filters.teamId) {
      query = this.db`${query} AND team_id = ${filters.teamId}`;
    }
    if (filters.userId) {
      query = this.db`${query} AND user_id = ${filters.userId}`;
    }
    if (filters.action) {
      query = this.db`${query} AND action = ${filters.action}`;
    }
    if (filters.resourceType) {
      query = this.db`${query} AND resource_type = ${filters.resourceType}`;
    }
    if (filters.severity) {
      query = this.db`${query} AND (details->>'severity')::text = ${filters.severity}`;
    }
    if (filters.ipAddress) {
      query = this.db`${query} AND ip_address = ${filters.ipAddress}`;
    }
    if (filters.startDate) {
      query = this.db`${query} AND created_at >= ${filters.startDate}`;
    }
    if (filters.endDate) {
      query = this.db`${query} AND created_at <= ${filters.endDate}`;
    }

    query = this.db`${query} ORDER BY created_at DESC`;

    if (filters.limit) {
      query = this.db`${query} LIMIT ${filters.limit}`;
    }
    if (filters.offset) {
      query = this.db`${query} OFFSET ${filters.offset}`;
    }

    const result = await query;
    return (result as unknown[]).map((event) => this.mapAuditEvent(event));
  }

  async getAuditStatistics(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalEvents: number;
    uniqueUsers: number;
    uniqueTeams: number;
    eventsByAction: Record<string, number>;
    eventsByResourceType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    highRiskEvents: number;
  }> {
    const events = await this.getAuditLog(organizationId, {
      startDate,
      endDate,
      limit: 10000,
    });

    const eventsByAction = this.countByAction(events);
    const eventsByResourceType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};
    const uniqueUsers = new Set<string>();
    const uniqueTeams = new Set<string>();
    let highRiskEvents = 0;

    for (const event of events) {
      uniqueUsers.add(event.user_id);
      if (event.team_id) {
        uniqueTeams.add(event.team_id);
      }

      eventsByResourceType[event.resource_type] =
        (eventsByResourceType[event.resource_type] || 0) + 1;

      const severity = (event.details as any)?.severity || 'low';
      eventsBySeverity[severity] = (eventsBySeverity[severity] || 0) + 1;

      if (['high', 'critical'].includes(severity)) {
        highRiskEvents++;
      }
    }

    return {
      totalEvents: events.length,
      uniqueUsers: uniqueUsers.size,
      uniqueTeams: uniqueTeams.size,
      eventsByAction,
      eventsByResourceType,
      eventsBySeverity,
      highRiskEvents,
    };
  }

  async getUserRiskAssessment(
    organizationId: string,
    userId: string,
    days: number = 30
  ): Promise<{
    userId: string;
    riskScore: number;
    failedLoginAttempts: number;
    permissionChanges: number;
    sensitiveAccessCount: number;
    lastActivity: Date | null;
    events: AuditEvent[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.getAuditLog(organizationId, {
      userId,
      startDate,
      limit: 1000,
    });

    let riskScore = 0;
    let failedLoginAttempts = 0;
    let permissionChanges = 0;
    let sensitiveAccessCount = 0;

    for (const event of events) {
      if (event.action === 'auth:failed_login') {
        failedLoginAttempts++;
        riskScore += 10;
      }
      if (
        event.action.includes('member:') ||
        event.action.includes('permission:') ||
        event.action.includes('role:')
      ) {
        permissionChanges++;
        riskScore += 5;
      }
      if (
        event.action.includes('session:export') ||
        event.action.includes('data_access') ||
        event.action.includes('key:access')
      ) {
        sensitiveAccessCount++;
        riskScore += 8;
      }
    }

    return {
      userId,
      riskScore: Math.min(riskScore, 100),
      failedLoginAttempts,
      permissionChanges,
      sensitiveAccessCount,
      lastActivity: events.length > 0 ? events[0].created_at : null,
      events,
    };
  }
}
