import express from 'express';
import { TeamService } from '../services/TeamService.js';
import { PermissionService } from '../services/PermissionService.js';
import { AuditService } from '../services/AuditService.js';
import { createAuditTracker } from '../middleware/auditTracker.js';

const router = express.Router();

export const teamService = new TeamService();
export const permissionService = new PermissionService();
export const auditService = new AuditService();
export const auditTracker = createAuditTracker(auditService);

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId! };
}

// POST /api/teams - Create team
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    if (!name) {
      res.status(400).json({ error: 'Team name is required' });
      return;
    }

    const team = await teamService.createTeam(user.organizationId!, name, description);

    // Add creator as owner
    await teamService.addTeamMember(team.id, user.id, 'owner', user.id);

    res.status(201).json(team);
  } catch (error) {
    console.error('Failed to create team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// GET /api/teams - List teams for organization
router.get('/', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const teams = await teamService.listTeams(user.organizationId!);
    res.json(teams);
  } catch (error) {
    console.error('Failed to list teams:', error);
    res.status(500).json({ error: 'Failed to list teams' });
  }
});

// GET /api/teams/:id - Get team details
router.get('/:id', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    const team = await teamService.getTeam(req.params.id);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    if (team.organization_id !== user.organizationId) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    res.json(team);
  } catch (error) {
    console.error('Failed to get team:', error);
    res.status(500).json({ error: 'Failed to get team' });
  }
});

// PUT /api/teams/:id - Update team
router.put('/:id', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const team = await teamService.getTeam(req.params.id);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      team.id,
      'team:update'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const updated = await teamService.updateTeam(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Failed to update team:', error);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// DELETE /api/teams/:id - Delete team (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const team = await teamService.getTeam(req.params.id);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      team.id,
      'team:delete'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    await teamService.deleteTeam(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// POST /api/teams/:id/members - Add member to team
router.post('/:id/members', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { userId, role = 'viewer' } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    const team = await teamService.getTeam(req.params.id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      team.id,
      'member:add'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const member = await teamService.addTeamMember(team.id, userId, role, user.id);

    // Log permission change
    await auditTracker.logPermissionChange(
      req,
      team.id,
      userId,
      'member_added',
      {},
      { role, addedAt: new Date().toISOString() },
      { addedBy: user.id }
    );

    res.status(201).json(member);
  } catch (error) {
    console.error('Failed to add team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// GET /api/teams/:id/members - List team members
router.get('/:id/members', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const team = await teamService.getTeam(req.params.id);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      team.id,
      'member:read'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const members = await teamService.listMembers(team.id);
    res.json(members);
  } catch (error) {
    console.error('Failed to list team members:', error);
    res.status(500).json({ error: 'Failed to list team members' });
  }
});

// GET /api/teams/:id/members/:userId - Get team member details
router.get('/:id/members/:userId', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const team = await teamService.getTeam(req.params.id);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      team.id,
      'member:read'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const member = await teamService.getTeamMember(team.id, req.params.userId);

    if (!member) {
      res.status(404).json({ error: 'Team member not found' });
      return;
    }

    res.json(member);
  } catch (error) {
    console.error('Failed to get team member:', error);
    res.status(500).json({ error: 'Failed to get team member' });
  }
});

// PUT /api/teams/:id/members/:userId - Update member role
router.put('/:id/members/:userId', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { role } = req.body;

    if (!role) {
      res.status(400).json({ error: 'Role is required' });
      return;
    }

    const team = await teamService.getTeam(req.params.id);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      team.id,
      'member:update'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Get before state
    const memberBefore = await teamService.getTeamMember(team.id, req.params.userId);
    const beforeState = memberBefore ? { role: memberBefore.role } : {};

    const updated = await teamService.updateMemberRole(team.id, req.params.userId, role);

    // Log permission change
    await auditTracker.logPermissionChange(
      req,
      team.id,
      req.params.userId,
      'role_updated',
      beforeState,
      { role: updated.role },
      { oldRole: memberBefore?.role, newRole: role }
    );

    res.json(updated);
  } catch (error) {
    console.error('Failed to update member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /api/teams/:id/members/:userId - Remove member from team
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const team = await teamService.getTeam(req.params.id);

    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }

    // Check permission
    const hasPermission = await permissionService.checkPermission(
      user.id,
      team.id,
      'member:remove'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Get before state
    const memberBefore = await teamService.getTeamMember(team.id, req.params.userId);

    await teamService.removeTeamMember(team.id, req.params.userId);

    // Log permission change
    await auditTracker.logPermissionChange(
      req,
      team.id,
      req.params.userId,
      'member_removed',
      memberBefore ? { role: memberBefore.role } : {},
      { role: null },
      { removedBy: user.id }
    );

    res.status(204).send();
  } catch (error) {
    console.error('Failed to remove team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

export { router as teamRouter };
