# Audit Logging Integration Guide for Developers

## Quick Start

### 1. Import AuditService and AuditTracker

```typescript
import { AuditService } from '../services/AuditService.js';
import { createAuditTracker } from '../middleware/auditTracker.js';

const auditService = new AuditService();
const auditTracker = createAuditTracker(auditService);
```

### 2. Log Sensitive Operations

```typescript
// Session export
await auditTracker.logSessionExport(
  req,
  sessionId,
  teamId,
  'bash',      // or 'json'
  42,          // command count
  true         // success flag
);

// Playback access
await auditTracker.logPlaybackAccess(
  req,
  sessionId,
  teamId,
  75           // commands viewed
);

// Permission change
await auditTracker.logPermissionChange(
  req,
  teamId,
  targetUserId,
  'role_updated',      // or 'member_added', 'member_removed'
  { role: 'viewer' },  // before state
  { role: 'editor' },  // after state
  { reason: 'promotion' }  // extra details
);

// Sensitive data access
await auditTracker.logDataAccess(
  req,
  teamId,
  'vault',     // or 'entry', 'encryption_key'
  resourceId,
  'read',      // or 'export', 'decrypt'
  { vaultName: 'Production Secrets' }
);

// Authentication events
await auditTracker.logAuthEvent(
  req,
  userId,
  organizationId,
  'login',     // or 'logout', 'token_refresh', 'failed_login'
  true,        // success flag
  { mfaUsed: true }  // extra details
);
```

### 3. Use the Middleware Approach (Optional)

For automatic request/response tracking:

```typescript
import { createAuditLogger } from '../middleware/auditLog.js';

const auditLogger = createAuditLogger(auditService);

// Apply to specific routes
router.post('/sensitive-operation', 
  auditLogger.middleware(
    'sensitive:operation',           // action
    'resource',                      // resource type
    (req) => req.params.id,          // extract resource ID
    (req) => req.params.teamId       // extract team ID
  ),
  async (req, res) => {
    // Your handler code
  }
);
```

## Detailed API Reference

### AuditTracker Methods

#### logSessionExport()

```typescript
async logSessionExport(
  req: express.Request,
  sessionId: string,
  teamId: string,
  format: 'bash' | 'json',
  commandCount: number,
  success?: boolean
): Promise<void>
```

**When to use**: When user downloads/exports a terminal session

**Example**:
```typescript
const exported = await playbackService.exportAsScript(session.id, format);
const commands = await sessionService.getSessionHistory(session.id, 1000);

await auditTracker.logSessionExport(
  req,
  session.id,
  session.team_id,
  format,
  commands.length,
  true
);

res.send(exported);
```

#### logPlaybackAccess()

```typescript
async logPlaybackAccess(
  req: express.Request,
  sessionId: string,
  teamId: string,
  commandsViewed?: number
): Promise<void>
```

**When to use**: When user views session playback/recording

**Example**:
```typescript
const playbackData = await playbackService.getPlaybackData(session.id);
const commands = playbackData?.commands || [];

await auditTracker.logPlaybackAccess(
  req,
  session.id,
  session.team_id,
  commands.length
);

res.json(playbackData);
```

#### logPermissionChange()

```typescript
async logPermissionChange(
  req: express.Request,
  teamId: string,
  targetUserId: string,
  changeType: 'role_updated' | 'member_added' | 'member_removed' | 
             'permission_granted' | 'permission_revoked',
  beforeState: Record<string, unknown>,
  afterState: Record<string, unknown>,
  details?: Record<string, unknown>
): Promise<void>
```

**When to use**: When team membership or permissions change

**Example for role change**:
```typescript
const memberBefore = await teamService.getTeamMember(team.id, userId);
const updated = await teamService.updateMemberRole(team.id, userId, newRole);

await auditTracker.logPermissionChange(
  req,
  team.id,
  userId,
  'role_updated',
  { role: memberBefore?.role },
  { role: updated.role },
  { oldRole: memberBefore?.role, newRole: newRole }
);
```

**Example for member addition**:
```typescript
const member = await teamService.addTeamMember(team.id, userId, role, user.id);

await auditTracker.logPermissionChange(
  req,
  team.id,
  userId,
  'member_added',
  {},  // no before state
  { role, addedAt: new Date().toISOString() },
  { addedBy: user.id }
);
```

#### logDataAccess()

```typescript
async logDataAccess(
  req: express.Request,
  teamId: string,
  resourceType: 'vault' | 'entry' | 'encryption_key',
  resourceId: string,
  accessType: 'read' | 'export' | 'decrypt',
  details?: Record<string, unknown>
): Promise<void>
```

**When to use**: When sensitive data is accessed, exported, or decrypted

**Example**:
```typescript
const vault = await vaultService.getVault(vaultId);

// Log the sensitive read operation
await auditTracker.logDataAccess(
  req,
  vault.team_id,
  'vault',
  vault.id,
  'read',
  { 
    vaultName: vault.name,
    accessType: 'direct_read',
    entries: 125
  }
);

res.json(vault);
```

#### logAuthEvent()

```typescript
async logAuthEvent(
  req: express.Request,
  userId: string,
  organizationId: string,
  eventType: 'login' | 'logout' | 'token_refresh' | 'failed_login',
  success: boolean,
  details?: Record<string, unknown>
): Promise<void>
```

**When to use**: For authentication-related events

**Example for failed login**:
```typescript
const user = await authenticate(credentials);
if (!user) {
  await auditTracker.logAuthEvent(
    req,
    credentials.email,
    org.id,
    'failed_login',
    false,
    { 
      reason: 'invalid_credentials',
      attemptCount: 3
    }
  );
  res.status(401).json({ error: 'Invalid credentials' });
  return;
}

await auditTracker.logAuthEvent(
  req,
  user.id,
  org.id,
  'login',
  true,
  { mfaUsed: user.mfaEnabled }
);

res.json({ token: jwt });
```

#### logEvent()

```typescript
async logEvent(
  req: express.Request,
  teamId: string | undefined,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, unknown>
): Promise<void>
```

**When to use**: For generic/custom audit events

**Example**:
```typescript
const vault = await vaultService.createVault(
  org.id,
  user.id,
  name,
  description
);

await auditTracker.logEvent(
  req,
  team.id,
  'vault:created',
  'vault',
  vault.id,
  {
    vaultName: name,
    encrypted: true,
    severity: 'medium'
  }
);
```

### AuditService Direct Methods

For more control, use AuditService directly:

```typescript
import { AuditService } from '../services/AuditService.js';

const auditService = new AuditService();

// Log generic event
const event = await auditService.logEvent(
  organizationId,
  teamId,
  userId,
  'action:name',
  'resourceType',
  'resource-id',
  { customField: 'value' },
  ipAddress,
  userAgent
);

// Query events
const events = await auditService.getAuditLog(organizationId, {
  teamId: 'team-1',
  action: 'session:export',
  severity: 'high',
  startDate: new Date('2024-12-01'),
  endDate: new Date('2024-12-31'),
  limit: 1000
});

// Generate statistics
const stats = await auditService.getAuditStatistics(
  organizationId,
  new Date('2024-12-01'),
  new Date('2024-12-31')
);

// Risk assessment
const assessment = await auditService.getUserRiskAssessment(
  organizationId,
  userId,
  30  // days
);
```

## Best Practices

### 1. Always Include Context

```typescript
// GOOD: Full context
await auditTracker.logPermissionChange(
  req,
  team.id,
  targetUserId,
  'role_updated',
  { role: oldRole },
  { role: newRole },
  { oldRole, newRole, reason: 'promotion', changedBy: user.id }
);

// BAD: Missing context
await auditTracker.logPermissionChange(
  req,
  team.id,
  targetUserId,
  'role_updated',
  {},
  {}
);
```

### 2. Log Before/After State for Critical Operations

```typescript
// GOOD: Capture state changes
const memberBefore = await teamService.getTeamMember(team.id, userId);
const result = await teamService.updateMemberRole(team.id, userId, 'admin');
await auditTracker.logPermissionChange(
  req,
  team.id,
  userId,
  'role_updated',
  { role: memberBefore?.role },
  { role: result.role },
  { oldRole: memberBefore?.role, newRole: result.role }
);

// BAD: No state information
await auditTracker.logPermissionChange(req, team.id, userId, 'role_updated', {}, {});
```

### 3. Handle Audit Failures Gracefully

```typescript
try {
  const vault = await vaultService.getVault(id);
  
  try {
    await auditTracker.logDataAccess(
      req,
      vault.team_id,
      'vault',
      vault.id,
      'read'
    );
  } catch (auditError) {
    // Log but don't fail the main operation
    console.error('Audit logging failed:', auditError);
  }
  
  res.json(vault);
} catch (error) {
  res.status(500).json({ error: 'Failed to get vault' });
}
```

### 4. Include Operation Metadata

```typescript
// For exports, include format and size
await auditTracker.logSessionExport(
  req,
  session.id,
  team.id,
  format,
  commands.length,
  true
);

// For permission changes, note who made the change
await auditTracker.logPermissionChange(
  req,
  team.id,
  targetUserId,
  'member_added',
  {},
  { role: 'editor', addedAt: new Date().toISOString() },
  { addedBy: currentUser.id, invitedVia: 'email' }
);
```

### 5. Separate High-Risk from Normal Operations

Use severity levels to distinguish:

```typescript
// The AuditTracker automatically sets severity
// - session:export = high
// - session:playback:access = medium
// - data_access:* = high
// - auth:login = medium
// - auth:failed_login = high
// - role_updated = high

// For custom events, include severity in details:
await auditTracker.logEvent(
  req,
  team.id,
  'vault:shared',
  'vault',
  vault.id,
  {
    severity: 'high',
    sharedWith: recipients.length,
    recipients: recipients
  }
);
```

## Common Patterns

### Pattern 1: Log On Success

```typescript
router.post('/api/sessions/:id/export', async (req, res) => {
  try {
    // ... validation and permission checks ...
    
    const exported = await playbackService.exportAsScript(session.id, format);
    const commands = await sessionService.getSessionHistory(session.id, 1000);

    // Log AFTER operation succeeds
    await auditTracker.logSessionExport(
      req,
      session.id,
      session.team_id,
      format,
      commands.length,
      true
    );

    res.setHeader('Content-Disposition', `attachment; filename="session.${format}"`);
    res.send(exported);
  } catch (error) {
    console.error('Failed to export:', error);
    res.status(500).json({ error: 'Failed to export session' });
  }
});
```

### Pattern 2: Log Before/After Changes

```typescript
router.put('/api/teams/:id/members/:userId', async (req, res) => {
  try {
    // ... permission checks ...
    
    // Get BEFORE state
    const memberBefore = await teamService.getTeamMember(team.id, req.params.userId);
    
    // Perform operation
    const updated = await teamService.updateMemberRole(team.id, req.params.userId, role);
    
    // Log change with before/after
    await auditTracker.logPermissionChange(
      req,
      team.id,
      req.params.userId,
      'role_updated',
      memberBefore ? { role: memberBefore.role } : {},
      { role: updated.role },
      { oldRole: memberBefore?.role, newRole: role }
    );

    res.json(updated);
  } catch (error) {
    console.error('Failed to update member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});
```

### Pattern 3: Track Access Attempts

```typescript
router.get('/api/vaults/:id', async (req, res) => {
  try {
    const user = getUser(req);
    const vault = await vaultService.getVault(req.params.id);

    if (!vault) {
      // Could log unauthorized access attempt here
      res.status(404).json({ error: 'Vault not found' });
      return;
    }

    // Check access
    const access = await shareService.checkAccess(vault.id, user.id);
    if (!access.hasAccess && vault.owner_id !== user.id) {
      // Log failed access attempt
      await auditTracker.logEvent(
        req,
        vault.team_id,
        'vault:access:denied',
        'vault',
        vault.id,
        { reason: 'access_denied', severity: 'high' }
      );
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Log successful access
    await auditTracker.logDataAccess(
      req,
      vault.team_id,
      'vault',
      vault.id,
      'read',
      { vaultName: vault.name }
    );

    res.json(vault);
  } catch (error) {
    console.error('Failed to get vault:', error);
    res.status(500).json({ error: 'Failed to get vault' });
  }
});
```

## Testing Audit Logging

### Unit Test Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditTracker } from '../middleware/auditTracker.js';
import { AuditService } from '../services/AuditService.js';

describe('Session Export Audit Logging', () => {
  let auditTracker: AuditTracker;
  let auditService: AuditService;
  let mockReq: any;

  beforeEach(() => {
    auditService = new AuditService();
    auditTracker = new AuditTracker(auditService);
    
    mockReq = {
      headers: {
        'x-user-id': 'user-1',
        'x-org-id': 'org-1',
        'user-agent': 'Test Browser'
      },
      socket: { remoteAddress: '127.0.0.1' }
    };

    vi.spyOn(auditService, 'logSessionExport');
  });

  it('should log session export with command count', async () => {
    await auditTracker.logSessionExport(
      mockReq,
      'session-1',
      'team-1',
      'bash',
      42,
      true
    );

    expect(auditService.logSessionExport).toHaveBeenCalledWith(
      'org-1',
      'team-1',
      'user-1',
      'session-1',
      'bash',
      42,
      expect.any(String),
      expect.any(String)
    );
  });
});
```

### Integration Test Example

```typescript
import request from 'supertest';
import app from '../index';

describe('Session Export with Audit Logging', () => {
  it('should log export and send file', async () => {
    const response = await request(app)
      .get('/api/sessions/session-1/export?format=bash')
      .set('x-user-id', 'user-1')
      .set('x-org-id', 'org-1');

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain('session-replay.sh');

    // Verify audit log was written
    const auditResponse = await request(app)
      .get('/api/audit/events?action=session:export&limit=1')
      .set('x-user-id', 'user-1')
      .set('x-org-id', 'org-1');

    expect(auditResponse.body.data).toHaveLength(1);
    expect(auditResponse.body.data[0].action).toBe('session:export');
  });
});
```

## Troubleshooting

### Issue: Audit logs not appearing

1. Check if AuditTracker is properly initialized
2. Verify database connection is working
3. Check if audit:write permission is granted
4. Review console for error messages from audit logging

### Issue: Performance degradation

1. Check if audit queries are using proper indexes
2. Consider implementing audit log archival for old data
3. Monitor database load during peak audit logging

### Issue: Missing audit context

1. Ensure `x-user-id` and `x-org-id` headers are set
2. Check that request object is properly passed to audit tracker
3. Verify IP address extraction (especially behind proxies)

## Additional Resources

- **AuditService.ts**: Core audit logging implementation
- **AuditTracker.ts**: Route handler integration helpers
- **AuditLog.ts**: Express middleware for automatic logging
- **audit.ts routes**: Query and reporting endpoints
- **AUDIT_LOGGING_GUIDE.md**: Compliance and query documentation
