import { getDb } from '../db/connection.js';

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_built_in: boolean;
  created_at: Date;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission: string;
  created_at: Date;
}

export class PermissionService {
  private db = getDb();
  private permissionCache = new Map<string, Set<string>>();
  private userTeamPermissionCache = new Map<string, Set<string>>(); // userId+teamId -> permissions

  async createRole(
    organizationId: string,
    name: string,
    description?: string,
    isBuiltIn: boolean = false
  ): Promise<Role> {
    const result = await this.db`
      INSERT INTO roles (organization_id, name, description, is_built_in)
      VALUES (${organizationId}, ${name}, ${description || null}, ${isBuiltIn})
      RETURNING *
    `;
    return result[0] as Role;
  }

  async getRole(roleId: string): Promise<Role | null> {
    const result = await this.db`
      SELECT * FROM roles WHERE id = ${roleId}
    `;
    return result.length > 0 ? (result[0] as Role) : null;
  }

  async getRoleByName(organizationId: string, name: string): Promise<Role | null> {
    const result = await this.db`
      SELECT * FROM roles
      WHERE organization_id = ${organizationId} AND name = ${name}
    `;
    return result.length > 0 ? (result[0] as Role) : null;
  }

  async listRoles(organizationId: string): Promise<Role[]> {
    const result = await this.db`
      SELECT * FROM roles
      WHERE organization_id = ${organizationId}
      ORDER BY is_built_in DESC, name ASC
    `;
    return result as unknown as Role[];
  }

  async addPermission(roleId: string, permission: string): Promise<RolePermission> {
    const result = await this.db`
      INSERT INTO role_permissions (role_id, permission)
      VALUES (${roleId}, ${permission})
      ON CONFLICT (role_id, permission) DO NOTHING
      RETURNING *
    `;

    this.permissionCache.delete(roleId);

    return result.length > 0 ? (result[0] as RolePermission) : { id: '', role_id: roleId, permission, created_at: new Date() };
  }

  async removePermission(roleId: string, permission: string): Promise<void> {
    await this.db`
      DELETE FROM role_permissions
      WHERE role_id = ${roleId} AND permission = ${permission}
    `;

    this.permissionCache.delete(roleId);
  }

  async getPermissions(roleId: string): Promise<string[]> {
    if (this.permissionCache.has(roleId)) {
      return Array.from(this.permissionCache.get(roleId)!);
    }

    const result = await this.db`
      SELECT permission FROM role_permissions
      WHERE role_id = ${roleId}
      ORDER BY permission ASC
    `;

    const permissions = result.map((row: any) => row.permission);
    this.permissionCache.set(roleId, new Set(permissions));

    return permissions;
  }

  async hasPermission(roleId: string, permission: string): Promise<boolean> {
    const permissions = await this.getPermissions(roleId);
    return permissions.includes(permission);
  }

  async checkPermission(
    userId: string,
    teamId: string,
    permission: string
  ): Promise<boolean> {
    try {
      const cacheKey = `${userId}:${teamId}`;
      let permissions = this.userTeamPermissionCache.get(cacheKey);

      if (!permissions) {
        const result = await this.db`
          SELECT DISTINCT rp.permission
          FROM role_permissions rp
          JOIN roles r ON rp.role_id = r.id
          JOIN team_members tm ON tm.role = r.name
          WHERE tm.user_id = ${userId}
          AND tm.team_id = ${teamId}
          AND tm.is_active = true
        `;

        permissions = new Set(result.map((row: any) => row.permission));
        this.userTeamPermissionCache.set(cacheKey, permissions);
      }

      return permissions.has(permission);
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  }

  async getUserPermissions(userId: string, teamId: string): Promise<string[]> {
    try {
      const cacheKey = `${userId}:${teamId}`;
      const cached = this.userTeamPermissionCache.get(cacheKey);

      if (cached) {
        return Array.from(cached).sort();
      }

      const result = await this.db`
        SELECT DISTINCT rp.permission
        FROM role_permissions rp
        JOIN roles r ON rp.role_id = r.id
        JOIN team_members tm ON tm.role = r.name
        WHERE tm.user_id = ${userId}
        AND tm.team_id = ${teamId}
        AND tm.is_active = true
        ORDER BY rp.permission ASC
      `;

      const permissions = result.map((row: any) => row.permission);
      this.userTeamPermissionCache.set(cacheKey, new Set(permissions));

      return permissions;
    } catch (error) {
      console.error('Failed to get user permissions:', error);
      return [];
    }
  }

  async getDefaultPermissionsForRole(roleName: string): Promise<string[]> {
    const defaultPermissions: Record<string, string[]> = {
      owner: [
        'team:create',
        'team:read',
        'team:update',
        'team:delete',
        'member:add',
        'member:remove',
        'member:update',
        'vault:create',
        'vault:read',
        'vault:update',
        'vault:delete',
        'session:create',
        'session:read',
        'session:record',
        'recording:play',
        'audit:read',
      ],
      editor: [
        'team:read',
        'member:read',
        'vault:create',
        'vault:read',
        'vault:update',
        'session:create',
        'session:read',
        'session:record',
        'recording:play',
        'audit:read',
      ],
      viewer: [
        'team:read',
        'vault:read',
        'session:read',
        'recording:play',
        'audit:read',
      ],
    };

    return defaultPermissions[roleName] || [];
  }

  clearCache(): void {
    this.permissionCache.clear();
    this.userTeamPermissionCache.clear();
  }

  clearRoleCache(roleId: string): void {
    this.permissionCache.delete(roleId);
    // Clear related user-team permissions that depend on this role
    this.userTeamPermissionCache.clear();
  }

  clearUserTeamPermissionCache(userId: string, teamId: string): void {
    const cacheKey = `${userId}:${teamId}`;
    this.userTeamPermissionCache.delete(cacheKey);
  }
}
