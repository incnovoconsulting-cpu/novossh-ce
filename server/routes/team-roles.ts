import express from 'express';
import { TeamRoleService } from '../services/TeamRoleService.js';
import { TeamService } from '../services/TeamService.js';
import { AuditService } from '../services/AuditService.js';
import { createAuditTracker } from '../middleware/auditTracker.js';

const router = express.Router({ mergeParams: true });

export const teamRoleService = new TeamRoleService();
export const teamService = new TeamService();
export const auditService = new AuditService();
export const auditTracker = createAuditTracker(auditService);

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// Middleware to check ownership/management access
const requireTeamManagement = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const teamId = req.params.teamId;

    // Check if user is owner or manager
    const memberRole = await teamRoleService.getMemberRole(teamId, user.id);
    if (!memberRole) {
      res.status(403).json({ error: 'Not a team member' });
      return;
    }

    // Only owner and manager can manage roles
    if (!['owner', 'manager'].includes(memberRole.role_name)) {
      res.status(403).json({ error: 'Insufficient permissions to manage roles' });
      return;
    }

    next();
  } catch (error) {
    console.error('Team management check failed:', error);
    res.status(500).json({ error: 'Failed to verify permissions' });
  }
};

// GET /api/teams/:teamId/roles - List all roles in team
router.get('/:teamId/roles', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const teamId = req.params.teamId;

    // Verify user is team member
    const memberRole = await teamRoleService.getMemberRole(teamId, user.id);
    if (!memberRole) {
      res.status(403).json({ error: 'Not a team member' });
      return;
    }

    const roles = await teamRoleService.listRoles(teamId);
    res.json(roles);
  } catch (error) {
    console.error('Failed to list roles:', error);
    res.status(500).json({ error: 'Failed to list roles' });
  }
});

// POST /api/teams/:teamId/roles - Create custom role
router.post('/:teamId/roles', requireTeamManagement, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const teamId = req.params.teamId;
    const { name, description, permissions } = req.body;

    // Validate required fields
    if (!name || !permissions) {
      res.status(400).json({ error: 'Role name and permissions are required' });
      return;
    }

    if (!Array.isArray(permissions)) {
      res.status(400).json({ error: 'Permissions must be an array' });
      return;
    }

    const role = await teamRoleService.createCustomRole(teamId, name, permissions, description);

    // Audit log - log as permission granted for custom role creation
    await auditTracker.logPermissionChange(
      req,
      teamId,
      user.id,
      'permission_granted',
      {},
      { custom_role: role.name },
      { role_id: role.id }
    );

    res.status(201).json(role);
  } catch (error: any) {
    console.error('Failed to create role:', error);
    if (error.message.includes('already exists') || error.message.includes('built-in')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create role' });
    }
  }
});

// PUT /api/teams/:teamId/roles/:roleId - Update role
router.put('/:teamId/roles/:roleId', requireTeamManagement, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { teamId, roleId } = req.params;
    const { name, description, permissions } = req.body;

    // Validate input
    if (permissions && !Array.isArray(permissions)) {
      res.status(400).json({ error: 'Permissions must be an array' });
      return;
    }

    // Get before state for audit
    const roleBefore = await teamRoleService.getRole(roleId);
    if (!roleBefore) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    const role = await teamRoleService.updateRole(roleId, name, permissions, description);

    // Audit log
    await auditTracker.logPermissionChange(
      req,
      teamId,
      user.id,
      'role_updated',
      { name: roleBefore.name, permissions: roleBefore.permissions },
      { name: role.name, permissions: role.permissions },
      { role_id: roleId }
    );

    res.json(role);
  } catch (error: any) {
    console.error('Failed to update role:', error);
    if (error.message.includes('built-in') || error.message.includes('not found')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update role' });
    }
  }
});

// DELETE /api/teams/:teamId/roles/:roleId - Delete role
router.delete('/:teamId/roles/:roleId', requireTeamManagement, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { teamId, roleId } = req.params;

    // Get role before deletion for audit
    const role = await teamRoleService.getRole(roleId);
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    await teamRoleService.deleteRole(roleId);

    // Audit log - log as permission revoked for custom role deletion
    await auditTracker.logPermissionChange(
      req,
      teamId,
      user.id,
      'permission_revoked',
      { custom_role: role.name },
      {},
      { role_id: roleId }
    );

    res.status(204).send();
  } catch (error: any) {
    console.error('Failed to delete role:', error);
    if (error.message.includes('built-in') || error.message.includes('assigned')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete role' });
    }
  }
});

// GET /api/teams/:teamId/roles/:roleId/permissions - Get role permissions
router.get('/:teamId/roles/:roleId/permissions', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { teamId, roleId } = req.params;

    // Verify user is team member
    const memberRole = await teamRoleService.getMemberRole(teamId, user.id);
    if (!memberRole) {
      res.status(403).json({ error: 'Not a team member' });
      return;
    }

    const permissions = await teamRoleService.getRolePermissions(roleId);
    res.json({ permissions });
  } catch (error) {
    console.error('Failed to get permissions:', error);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

// GET /api/teams/:teamId/members/:userId/role - Get member's role
router.get('/:teamId/members/:userId/role', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { teamId, userId } = req.params;

    // Verify user is team member
    const requesterRole = await teamRoleService.getMemberRole(teamId, user.id);
    if (!requesterRole) {
      res.status(403).json({ error: 'Not a team member' });
      return;
    }

    const memberRole = await teamRoleService.getMemberRole(teamId, userId);
    if (!memberRole) {
      res.status(404).json({ error: 'Member not found or has no role' });
      return;
    }

    res.json(memberRole);
  } catch (error) {
    console.error('Failed to get member role:', error);
    res.status(500).json({ error: 'Failed to get member role' });
  }
});

// POST /api/teams/:teamId/members/:userId/role - Assign role to member
router.post('/:teamId/members/:userId/role', requireTeamManagement, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { teamId, userId } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      res.status(400).json({ error: 'Role ID is required' });
      return;
    }

    // Get before state for audit
    const roleBefore = await teamRoleService.getMemberRole(teamId, userId);

    const memberRole = await teamRoleService.assignMemberRole(teamId, userId, roleId, user.id);

    // Get the role details for response
    const role = await teamRoleService.getRole(roleId);

    // Audit log - log as role update for member role assignment
    await auditTracker.logPermissionChange(
      req,
      teamId,
      userId,
      'role_updated',
      { previous_role: roleBefore?.role_name || null },
      { new_role: role?.name },
      { assigned_by: user.id }
    );

    res.json({
      ...memberRole,
      role_name: role?.name,
      permissions: role?.permissions,
    });
  } catch (error: any) {
    console.error('Failed to assign role:', error);
    if (error.message.includes('not found') || error.message.includes('does not belong')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to assign role' });
    }
  }
});

// GET /api/teams/:teamId/members/roles - Get all members with their roles
router.get('/:teamId/members/roles', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const teamId = req.params.teamId;

    // Verify user is team member
    const memberRole = await teamRoleService.getMemberRole(teamId, user.id);
    if (!memberRole) {
      res.status(403).json({ error: 'Not a team member' });
      return;
    }

    const members = await teamRoleService.getTeamMembersWithRoles(teamId);
    res.json(members);
  } catch (error) {
    console.error('Failed to get team members with roles:', error);
    res.status(500).json({ error: 'Failed to get team members with roles' });
  }
});

// GET /api/teams/:teamId/members/:userId/permissions - Get member's permissions
router.get('/:teamId/members/:userId/permissions', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { teamId, userId } = req.params;

    // Verify user is team member
    const requesterRole = await teamRoleService.getMemberRole(teamId, user.id);
    if (!requesterRole) {
      res.status(403).json({ error: 'Not a team member' });
      return;
    }

    const permissions = await teamRoleService.getUserPermissions(teamId, userId);
    res.json({ permissions });
  } catch (error) {
    console.error('Failed to get member permissions:', error);
    res.status(500).json({ error: 'Failed to get member permissions' });
  }
});

// GET /api/permissions/valid - Get all valid permissions (public)
router.get('/list/valid', (_req, res) => {
  try {
    const permissions = teamRoleService.getValidPermissions();
    res.json({ permissions });
  } catch (error) {
    console.error('Failed to get valid permissions:', error);
    res.status(500).json({ error: 'Failed to get valid permissions' });
  }
});

// GET /api/permissions/builtin/:roleName - Get built-in role permissions (public)
router.get('/list/builtin/:roleName', (req, res) => {
  try {
    const { roleName } = req.params;
    const permissions = teamRoleService.getBuiltInRolePermissions(roleName);

    if (permissions.length === 0) {
      res.status(404).json({ error: 'Built-in role not found' });
      return;
    }

    res.json({ role_name: roleName, permissions });
  } catch (error) {
    console.error('Failed to get built-in role permissions:', error);
    res.status(500).json({ error: 'Failed to get built-in role permissions' });
  }
});

export { router as teamRolesRouter };
