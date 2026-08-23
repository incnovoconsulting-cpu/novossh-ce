import { getDb } from '../db/connection.js';

export interface TeamRole {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  permissions: string[];
  is_custom: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TeamMemberRole {
  id: string;
  team_id: string;
  user_id: string;
  role_id: string;
  assigned_by?: string;
  assigned_at: Date;
  updated_at: Date;
}

export interface RoleAssignment {
  user_id: string;
  role_id: string;
  role_name: string;
  permissions: string[];
  assigned_at: Date;
}

// Built-in roles that cannot be modified
const BUILT_IN_ROLES = ['owner', 'editor', 'viewer', 'manager'];

// Valid permissions in the system
const VALID_PERMISSIONS = [
  // Hosts
  'hosts.create',
  'hosts.read',
  'hosts.update',
  'hosts.delete',
  // Snippets
  'snippets.create',
  'snippets.read',
  'snippets.update',
  'snippets.delete',
  // Vaults
  'vaults.create',
  'vaults.read',
  'vaults.update',
  'vaults.delete',
  // Team
  'team.read',
  'team.invite',
  'team.remove',
  'team.manage_roles',
  // Sessions
  'sessions.view',
  'sessions.record',
  'sessions.replay',
  // Audit
  'audit.view',
  // Billing
  'billing.manage',
];

export class TeamRoleService {
  private db = getDb();
  private permissionCache = new Map<string, Set<string>>();

  /**
   * List all roles in a team (built-in + custom)
   */
  async listRoles(teamId: string): Promise<TeamRole[]> {
    try {
      const result = await this.db`
        SELECT
          id,
          team_id,
          name,
          description,
          permissions,
          is_custom,
          created_at,
          updated_at
        FROM team_roles
        WHERE team_id = ${teamId}
        ORDER BY is_custom ASC, name ASC
      `;

      return (result as any[]).map(row => ({
        ...row,
        permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
      }));
    } catch (error) {
      console.error('Failed to list roles:', error);
      throw error;
    }
  }

  /**
   * Get a single role by ID
   */
  async getRole(roleId: string): Promise<TeamRole | null> {
    try {
      const result = await this.db`
        SELECT
          id,
          team_id,
          name,
          description,
          permissions,
          is_custom,
          created_at,
          updated_at
        FROM team_roles
        WHERE id = ${roleId}
      `;

      if (result.length === 0) return null;

      const row = result[0] as any;
      return {
        ...row,
        permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
      };
    } catch (error) {
      console.error('Failed to get role:', error);
      throw error;
    }
  }

  /**
   * Get a role by team and name
   */
  async getRoleByName(teamId: string, name: string): Promise<TeamRole | null> {
    try {
      const result = await this.db`
        SELECT
          id,
          team_id,
          name,
          description,
          permissions,
          is_custom,
          created_at,
          updated_at
        FROM team_roles
        WHERE team_id = ${teamId} AND name = ${name}
      `;

      if (result.length === 0) return null;

      const row = result[0] as any;
      return {
        ...row,
        permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
      };
    } catch (error) {
      console.error('Failed to get role by name:', error);
      throw error;
    }
  }

  /**
   * Create a custom role in a team
   */
  async createCustomRole(
    teamId: string,
    name: string,
    permissions: string[],
    description?: string
  ): Promise<TeamRole> {
    try {
      // Validate permissions
      this.validatePermissions(permissions);

      // Check if role name already exists
      const existing = await this.getRoleByName(teamId, name);
      if (existing) {
        throw new Error(`Role "${name}" already exists in this team`);
      }

      // Custom roles cannot use built-in names
      if (BUILT_IN_ROLES.includes(name.toLowerCase())) {
        throw new Error(`Cannot create custom role with built-in name: ${name}`);
      }

      const result = await this.db`
        INSERT INTO team_roles (team_id, name, description, permissions, is_custom)
        VALUES (${teamId}, ${name}, ${description || null}, ${JSON.stringify(permissions)}, true)
        RETURNING
          id,
          team_id,
          name,
          description,
          permissions,
          is_custom,
          created_at,
          updated_at
      `;

      const row = result[0] as any;
      this.clearPermissionCache(row.id);

      return {
        ...row,
        permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
      };
    } catch (error) {
      console.error('Failed to create custom role:', error);
      throw error;
    }
  }

  /**
   * Update a role (only custom roles, not built-in)
   */
  async updateRole(
    roleId: string,
    name?: string,
    permissions?: string[],
    description?: string
  ): Promise<TeamRole> {
    try {
      // Get the role first to check if it's custom
      const role = await this.getRole(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (!role.is_custom) {
        throw new Error('Cannot modify built-in roles');
      }

      // Validate permissions if provided
      if (permissions) {
        this.validatePermissions(permissions);
      }

      // Check for name conflicts if changing name
      if (name && name !== role.name) {
        const existing = await this.getRoleByName(role.team_id, name);
        if (existing) {
          throw new Error(`Role "${name}" already exists in this team`);
        }
      }

      const updateName = name !== undefined ? name : this.db`name`;
      const updateDescription = description !== undefined ? description : this.db`description`;
      const updatePermissions = permissions ? JSON.stringify(permissions) : this.db`permissions`;

      const result = await this.db`
        UPDATE team_roles
        SET
          name = ${updateName},
          description = ${updateDescription},
          permissions = ${updatePermissions},
          updated_at = NOW()
        WHERE id = ${roleId}
        RETURNING
          id,
          team_id,
          name,
          description,
          permissions,
          is_custom,
          created_at,
          updated_at
      `;

      if (result.length === 0) {
        throw new Error('Failed to update role');
      }

      this.clearPermissionCache(roleId);

      const row = result[0] as any;
      return {
        ...row,
        permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
      };
    } catch (error) {
      console.error('Failed to update role:', error);
      throw error;
    }
  }

  /**
   * Delete a custom role (only if no members are assigned)
   */
  async deleteRole(roleId: string): Promise<void> {
    try {
      // Get the role first to check if it's custom
      const role = await this.getRole(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (!role.is_custom) {
        throw new Error('Cannot delete built-in roles');
      }

      // Check if any members are assigned to this role
      const assignmentResult = await this.db`
        SELECT COUNT(*) as count FROM team_member_roles
        WHERE role_id = ${roleId}
      `;

      const count = (assignmentResult[0] as any).count;
      if (count > 0) {
        throw new Error(`Cannot delete role: ${count} member(s) are assigned to this role`);
      }

      await this.db`
        DELETE FROM team_roles
        WHERE id = ${roleId}
      `;

      this.clearPermissionCache(roleId);
    } catch (error) {
      console.error('Failed to delete role:', error);
      throw error;
    }
  }

  /**
   * Get all permissions for a role
   */
  async getRolePermissions(roleId: string): Promise<string[]> {
    try {
      // Check cache first
      if (this.permissionCache.has(roleId)) {
        return Array.from(this.permissionCache.get(roleId)!);
      }

      const role = await this.getRole(roleId);
      if (!role) {
        return [];
      }

      const permissions = role.permissions || [];
      this.permissionCache.set(roleId, new Set(permissions));
      return permissions;
    } catch (error) {
      console.error('Failed to get role permissions:', error);
      throw error;
    }
  }

  /**
   * Assign a role to a team member
   */
  async assignMemberRole(
    teamId: string,
    userId: string,
    roleId: string,
    assignedBy?: string
  ): Promise<TeamMemberRole> {
    try {
      // Verify role exists and belongs to this team
      const role = await this.getRole(roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.team_id !== teamId) {
        throw new Error('Role does not belong to this team');
      }

      const result = await this.db`
        INSERT INTO team_member_roles (team_id, user_id, role_id, assigned_by)
        VALUES (${teamId}, ${userId}, ${roleId}, ${assignedBy || null})
        ON CONFLICT (team_id, user_id) DO UPDATE
        SET role_id = ${roleId}, assigned_by = ${assignedBy || null}, updated_at = NOW()
        RETURNING
          id,
          team_id,
          user_id,
          role_id,
          assigned_by,
          assigned_at,
          updated_at
      `;

      return result[0] as TeamMemberRole;
    } catch (error) {
      console.error('Failed to assign member role:', error);
      throw error;
    }
  }

  /**
   * Get a member's role assignment
   */
  async getMemberRole(teamId: string, userId: string): Promise<RoleAssignment | null> {
    try {
      const result = await this.db`
        SELECT
          tmr.user_id,
          tmr.role_id,
          tr.name as role_name,
          tr.permissions,
          tmr.assigned_at
        FROM team_member_roles tmr
        JOIN team_roles tr ON tmr.role_id = tr.id
        WHERE tmr.team_id = ${teamId} AND tmr.user_id = ${userId}
      `;

      if (result.length === 0) return null;

      const row = result[0] as any;
      return {
        user_id: row.user_id,
        role_id: row.role_id,
        role_name: row.role_name,
        permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
        assigned_at: row.assigned_at,
      };
    } catch (error) {
      console.error('Failed to get member role:', error);
      throw error;
    }
  }

  /**
   * Get all members and their role assignments in a team
   */
  async getTeamMembersWithRoles(teamId: string): Promise<(TeamMemberRole & { role_name: string; permissions: string[] })[]> {
    try {
      const result = await this.db`
        SELECT
          tmr.id,
          tmr.team_id,
          tmr.user_id,
          tmr.role_id,
          tmr.assigned_by,
          tmr.assigned_at,
          tmr.updated_at,
          tr.name as role_name,
          tr.permissions
        FROM team_member_roles tmr
        JOIN team_roles tr ON tmr.role_id = tr.id
        WHERE tmr.team_id = ${teamId}
        ORDER BY tmr.assigned_at DESC
      `;

      return (result as any[]).map(row => ({
        id: row.id,
        team_id: row.team_id,
        user_id: row.user_id,
        role_id: row.role_id,
        assigned_by: row.assigned_by,
        assigned_at: row.assigned_at,
        updated_at: row.updated_at,
        role_name: row.role_name,
        permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
      }));
    } catch (error) {
      console.error('Failed to get team members with roles:', error);
      throw error;
    }
  }

  /**
   * Check if a user has a specific permission in a team
   */
  async hasPermission(teamId: string, userId: string, permission: string): Promise<boolean> {
    try {
      const memberRole = await this.getMemberRole(teamId, userId);
      if (!memberRole) {
        return false;
      }

      return memberRole.permissions.includes(permission);
    } catch (error) {
      console.error('Failed to check permission:', error);
      return false;
    }
  }

  /**
   * Get all permissions for a user in a team
   */
  async getUserPermissions(teamId: string, userId: string): Promise<string[]> {
    try {
      const memberRole = await this.getMemberRole(teamId, userId);
      if (!memberRole) {
        return [];
      }

      return memberRole.permissions;
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      return [];
    }
  }

  /**
   * Remove a member from a team (delete their role assignment)
   */
  async removeMember(teamId: string, userId: string): Promise<void> {
    try {
      await this.db`
        DELETE FROM team_member_roles
        WHERE team_id = ${teamId} AND user_id = ${userId}
      `;
    } catch (error) {
      console.error('Failed to remove team member:', error);
      throw error;
    }
  }

  /**
   * Validate permission array
   */
  private validatePermissions(permissions: string[]): void {
    if (!Array.isArray(permissions)) {
      throw new Error('Permissions must be an array');
    }

    for (const permission of permissions) {
      if (!VALID_PERMISSIONS.includes(permission)) {
        throw new Error(`Invalid permission: ${permission}`);
      }
    }
  }

  /**
   * Clear permission cache for a role
   */
  private clearPermissionCache(roleId: string): void {
    this.permissionCache.delete(roleId);
  }

  /**
   * Get all valid permissions (for UI reference)
   */
  getValidPermissions(): string[] {
    return [...VALID_PERMISSIONS];
  }

  /**
   * Get default permissions for a built-in role
   */
  getBuiltInRolePermissions(roleName: string): string[] {
    const defaults: Record<string, string[]> = {
      owner: [
        'hosts.create',
        'hosts.read',
        'hosts.update',
        'hosts.delete',
        'snippets.create',
        'snippets.read',
        'snippets.update',
        'snippets.delete',
        'vaults.create',
        'vaults.read',
        'vaults.update',
        'vaults.delete',
        'team.invite',
        'team.remove',
        'team.manage_roles',
        'sessions.view',
        'sessions.record',
        'sessions.replay',
        'audit.view',
        'billing.manage',
      ],
      editor: [
        'hosts.create',
        'hosts.read',
        'hosts.update',
        'hosts.delete',
        'snippets.create',
        'snippets.read',
        'snippets.update',
        'snippets.delete',
        'vaults.create',
        'vaults.read',
        'vaults.update',
        'vaults.delete',
        'team.read',
        'sessions.view',
        'sessions.record',
        'sessions.replay',
        'audit.view',
      ],
      viewer: [
        'hosts.read',
        'snippets.read',
        'vaults.read',
        'team.read',
        'sessions.view',
        'audit.view',
      ],
      manager: [
        'hosts.create',
        'hosts.read',
        'hosts.update',
        'hosts.delete',
        'snippets.create',
        'snippets.read',
        'snippets.update',
        'snippets.delete',
        'vaults.create',
        'vaults.read',
        'vaults.update',
        'vaults.delete',
        'team.invite',
        'team.remove',
        'team.manage_roles',
        'sessions.view',
        'sessions.record',
        'sessions.replay',
        'audit.view',
      ],
    };

    return defaults[roleName.toLowerCase()] || [];
  }
}
