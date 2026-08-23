/**
 * Organization Management Routes
 *
 * Endpoints:
 * - POST /api/organizations - Create organization
 * - GET /api/organizations - List user organizations
 * - GET /api/organizations/:id - Get organization
 * - PATCH /api/organizations/:id - Update organization
 * - DELETE /api/organizations/:id - Delete organization
 * - PATCH /api/organizations/:id/hierarchy - Update hierarchy
 * - GET /api/organizations/:id/hierarchy/tree - Get hierarchy tree
 * - POST /api/organizations/:id/members - Add member
 * - GET /api/organizations/:id/members - List members
 * - GET /api/organizations/:id/members/:memberId - Get member
 * - PATCH /api/organizations/:id/members/:memberId - Update member role
 * - DELETE /api/organizations/:id/members/:memberId - Remove member
 * - GET /api/organizations/:id/audit-logs - Get audit logs
 */

import express from 'express';
import { OrganizationService } from '../services/OrganizationService.js';

const router = express.Router();
const orgService = new OrganizationService();

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// POST /api/organizations - Create organization
router.post('/', async (req, res) => {
  try {
    const { name, slug, description, logo_url, parent_id } = req.body;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    if (!name || !slug) {
      res.status(400).json({ error: 'Name and slug are required' });
      return;
    }

    // Check if user has permission to create org with parent
    if (parent_id) {
      const hasPermission = await orgService.hasPermission(parent_id, user.id, 'org:update');
      if (!hasPermission) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }
    }

    const org = await orgService.createOrganization(
      name,
      slug,
      description,
      logo_url,
      parent_id
    );

    // Add creator as owner
    await orgService.addMember(org.id, user.id, 'owner');

    res.status(201).json(org);
  } catch (error) {
    console.error('Failed to create organization:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// GET /api/organizations - List user organizations
router.get('/', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const organizations = await orgService.listUserOrganizations(user.id);
    res.json({
      organizations,
      total: organizations.length,
      page: 1,
      limit: 20,
    });
  } catch (error) {
    console.error('Failed to list organizations:', error);
    res.status(500).json({ error: 'Failed to list organizations' });
  }
});

// GET /api/organizations/:id - Get organization
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const org = await orgService.getOrganization(id);

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Check if user has permission
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const hasPermission = await orgService.hasPermission(id, user.id, 'org:read');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    res.json(org);
  } catch (error) {
    console.error('Failed to get organization:', error);
    res.status(500).json({ error: 'Failed to get organization' });
  }
});

// PATCH /api/organizations/:id - Update organization
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, logo_url } = req.body;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'org:update');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const org = await orgService.updateOrganization(id, {
      name,
      slug,
      description,
      logo_url,
    });

    res.json(org);
  } catch (error) {
    console.error('Failed to update organization:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// DELETE /api/organizations/:id - Delete organization
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'org:delete');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    await orgService.deleteOrganization(id);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to delete organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// PATCH /api/organizations/:id/hierarchy - Update hierarchy
router.patch('/:id/hierarchy', async (req, res) => {
  try {
    const { id } = req.params;
    const { parent_id } = req.body;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'hierarchy:update');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const org = await orgService.updateHierarchy(id, parent_id);
    res.json(org);
  } catch (error) {
    console.error('Failed to update hierarchy:', error);
    if ((error as Error).message.includes('Circular reference')) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }
    res.status(500).json({ error: 'Failed to update hierarchy' });
  }
});

// GET /api/organizations/:id/hierarchy/tree - Get hierarchy tree
router.get('/:id/hierarchy/tree', async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'org:read');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const tree = await orgService.getHierarchyTree(id);
    res.json(tree);
  } catch (error) {
    console.error('Failed to get hierarchy tree:', error);
    res.status(500).json({ error: 'Failed to get hierarchy tree' });
  }
});

// GET /api/organizations/:id/members - List members
router.get('/:id/members', async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'member:read');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const members = await orgService.listMembers(id);
    res.json({
      members,
      total: members.length,
    });
  } catch (error) {
    console.error('Failed to list members:', error);
    res.status(500).json({ error: 'Failed to list members' });
  }
});

// GET /api/organizations/:id/members/:memberId - Get member
router.get('/:id/members/:memberId', async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'member:read');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const member = await orgService.getMember(id, memberId);
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    res.json(member);
  } catch (error) {
    console.error('Failed to get member:', error);
    res.status(500).json({ error: 'Failed to get member' });
  }
});

// PATCH /api/organizations/:id/members/:memberId - Update member role
router.patch('/:id/members/:memberId', async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const { role } = req.body;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'member:update');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const member = await orgService.updateMemberRole(id, memberId, role);
    res.json(member);
  } catch (error) {
    console.error('Failed to update member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// DELETE /api/organizations/:id/members/:memberId - Remove member
router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'member:remove');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    await orgService.removeMember(id, memberId);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to remove member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// GET /api/organizations/:id/audit-logs - Get audit logs
router.get('/:id/audit-logs', async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'audit:read');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Placeholder response - would need audit log service
    res.json({
      logs: [],
      total: 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    res.status(500).json({ error: 'Failed to get audit logs' });
  }
});

export default router;
