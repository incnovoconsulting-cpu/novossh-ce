import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PermissionService, Role, RolePermission } from '../PermissionService';

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(() => mockDb),
}));

const mockDb = vi.fn();

describe('PermissionService', () => {
  let service: PermissionService;
  const testOrgId = 'org-1';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PermissionService();
  });

  describe('Role Management', () => {
    it('should create a new role', async () => {
      const mockRole: Role = {
        id: 'role-1',
        organization_id: testOrgId,
        name: 'custom-role',
        description: 'Custom role',
        is_built_in: false,
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockRole]);

      const result = await service.createRole(testOrgId, 'custom-role', 'Custom role', false);

      expect(result.id).toBe('role-1');
      expect(result.name).toBe('custom-role');
      expect(result.is_built_in).toBe(false);
    });

    it('should create built-in role', async () => {
      const mockRole: Role = {
        id: 'role-2',
        organization_id: testOrgId,
        name: 'owner',
        description: 'Owner role',
        is_built_in: true,
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockRole]);

      const result = await service.createRole(testOrgId, 'owner', 'Owner role', true);

      expect(result.is_built_in).toBe(true);
    });

    it('should create role without description', async () => {
      const mockRole: Role = {
        id: 'role-3',
        organization_id: testOrgId,
        name: 'test-role',
        is_built_in: false,
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockRole]);

      const result = await service.createRole(testOrgId, 'test-role');

      expect(result.name).toBe('test-role');
      expect(result.description).toBeUndefined();
    });

    it('should retrieve role by id', async () => {
      const mockRole: Role = {
        id: 'role-1',
        organization_id: testOrgId,
        name: 'editor',
        is_built_in: true,
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockRole]);

      const result = await service.getRole('role-1');

      expect(result?.id).toBe('role-1');
      expect(result?.name).toBe('editor');
    });

    it('should return null for non-existent role', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getRole('non-existent');

      expect(result).toBeNull();
    });

    it('should retrieve role by name', async () => {
      const mockRole: Role = {
        id: 'role-1',
        organization_id: testOrgId,
        name: 'owner',
        is_built_in: true,
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockRole]);

      const result = await service.getRoleByName(testOrgId, 'owner');

      expect(result?.name).toBe('owner');
    });

    it('should list all roles for organization', async () => {
      const mockRoles: Role[] = [
        {
          id: 'role-1',
          organization_id: testOrgId,
          name: 'owner',
          is_built_in: true,
          created_at: new Date(),
        },
        {
          id: 'role-2',
          organization_id: testOrgId,
          name: 'editor',
          is_built_in: true,
          created_at: new Date(),
        },
        {
          id: 'role-3',
          organization_id: testOrgId,
          name: 'viewer',
          is_built_in: true,
          created_at: new Date(),
        },
        {
          id: 'role-4',
          organization_id: testOrgId,
          name: 'custom-role',
          is_built_in: false,
          created_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockRoles);

      const result = await service.listRoles(testOrgId);

      expect(result).toHaveLength(4);
    });

    it('should list roles with built-in first', async () => {
      const mockRoles: Role[] = [
        {
          id: 'role-1',
          organization_id: testOrgId,
          name: 'owner',
          is_built_in: true,
          created_at: new Date(),
        },
        {
          id: 'role-2',
          organization_id: testOrgId,
          name: 'custom-role',
          is_built_in: false,
          created_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockRoles);

      const result = await service.listRoles(testOrgId);

      expect(result[0].is_built_in).toBe(true);
    });
  });

  describe('Permission Management', () => {
    it('should add permission to role', async () => {
      const mockPermission: RolePermission = {
        id: 'perm-1',
        role_id: 'role-1',
        permission: 'team:create',
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockPermission]);

      const result = await service.addPermission('role-1', 'team:create');

      expect(result.permission).toBe('team:create');
      expect(result.role_id).toBe('role-1');
    });

    it('should handle duplicate permission gracefully', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.addPermission('role-1', 'team:create');

      expect(result.permission).toBe('team:create');
    });

    it('should remove permission from role', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.removePermission('role-1', 'team:delete');

      expect(mockDb).toHaveBeenCalled();
    });

    it('should clear permission cache when adding', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.addPermission('role-1', 'team:create');

      // Cache should be cleared, next call should hit DB
      mockDb.mockResolvedValueOnce([
        { permission: 'team:create' },
        { permission: 'team:read' },
      ]);

      const permissions = await service.getPermissions('role-1');
      expect(permissions).toContain('team:create');
    });

    it('should clear permission cache when removing', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.removePermission('role-1', 'team:create');

      // Cache should be cleared
      mockDb.mockResolvedValueOnce([{ permission: 'team:read' }]);

      const permissions = await service.getPermissions('role-1');
      expect(permissions).not.toContain('team:create');
    });
  });

  describe('Permission Retrieval', () => {
    it('should get all permissions for role', async () => {
      const mockPermissions = [
        { permission: 'team:create' },
        { permission: 'team:read' },
        { permission: 'team:update' },
        { permission: 'team:delete' },
      ];

      mockDb.mockResolvedValueOnce(mockPermissions);

      const result = await service.getPermissions('role-1');

      expect(result).toHaveLength(4);
      expect(result).toContain('team:create');
      expect(result).toContain('team:delete');
    });

    it('should cache permissions on first retrieval', async () => {
      const mockPermissions = [
        { permission: 'team:read' },
        { permission: 'vault:read' },
      ];

      mockDb.mockResolvedValueOnce(mockPermissions);

      // First call should hit DB
      await service.getPermissions('role-1');

      // Second call should use cache (no additional DB call)
      const result = await service.getPermissions('role-1');

      expect(result).toHaveLength(2);
      expect(mockDb).toHaveBeenCalledTimes(1);
    });

    it('should return empty array for role with no permissions', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getPermissions('role-1');

      expect(result).toEqual([]);
    });

    it('should sort permissions alphabetically', async () => {
      const mockPermissions = [
        { permission: 'audit:read' },
        { permission: 'team:create' },
        { permission: 'team:read' },
      ];

      mockDb.mockResolvedValueOnce(mockPermissions);

      const result = await service.getPermissions('role-1');

      expect(result).toEqual(['audit:read', 'team:create', 'team:read']);
    });

    it('should check if role has specific permission', async () => {
      const mockPermissions = [
        { permission: 'team:create' },
        { permission: 'team:read' },
      ];

      mockDb.mockResolvedValueOnce(mockPermissions);

      const hasCreate = await service.hasPermission('role-1', 'team:create');
      const hasDelete = await service.hasPermission('role-1', 'team:delete');

      expect(hasCreate).toBe(true);
      expect(hasDelete).toBe(false);
    });
  });

  describe('Permission Checking for Users', () => {
    it('should check if user has permission in team', async () => {
      mockDb.mockResolvedValueOnce([{ permission: 'team:create' }]);

      const result = await service.checkPermission('user-1', 'team-1', 'team:create');

      expect(result).toBe(true);
    });

    it('should return false if user lacks permission', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.checkPermission('user-1', 'team-1', 'team:delete');

      expect(result).toBe(false);
    });

    it('should return false if user is not team member', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.checkPermission('non-member', 'team-1', 'team:read');

      expect(result).toBe(false);
    });

    it('should handle query errors gracefully', async () => {
      mockDb.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.checkPermission('user-1', 'team-1', 'team:read');

      expect(result).toBe(false);
    });

    it('should get all permissions for user in team', async () => {
      const mockPermissions = [
        { permission: 'team:create' },
        { permission: 'team:read' },
        { permission: 'member:add' },
        { permission: 'vault:create' },
      ];

      mockDb.mockResolvedValueOnce(mockPermissions);

      const result = await service.getUserPermissions('user-1', 'team-1');

      expect(result).toHaveLength(4);
      expect(result).toContain('team:create');
      expect(result).toContain('vault:create');
    });

    it('should return empty array if user has no permissions', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getUserPermissions('user-1', 'team-1');

      expect(result).toEqual([]);
    });

    it('should handle query error for user permissions', async () => {
      mockDb.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.getUserPermissions('user-1', 'team-1');

      expect(result).toEqual([]);
    });
  });

  describe('Default Permissions', () => {
    it('should get default permissions for owner role', async () => {
      const result = await service.getDefaultPermissionsForRole('owner');

      expect(result).toContain('team:create');
      expect(result).toContain('team:delete');
      expect(result).toContain('member:remove');
      expect(result).toContain('vault:delete');
      expect(result).toContain('session:record');
      expect(result).toContain('audit:read');
    });

    it('should get default permissions for editor role', async () => {
      const result = await service.getDefaultPermissionsForRole('editor');

      expect(result).toContain('vault:create');
      expect(result).toContain('vault:update');
      expect(result).toContain('session:create');
      expect(result).not.toContain('team:delete');
      expect(result).not.toContain('member:remove');
    });

    it('should get default permissions for viewer role', async () => {
      const result = await service.getDefaultPermissionsForRole('viewer');

      expect(result).toContain('team:read');
      expect(result).toContain('vault:read');
      expect(result).toContain('recording:play');
      expect(result).not.toContain('vault:update');
      expect(result).not.toContain('session:create');
    });

    it('should return empty array for unknown role', async () => {
      const result = await service.getDefaultPermissionsForRole('unknown-role');

      expect(result).toEqual([]);
    });

    it('should have all required owner permissions', async () => {
      const requiredPermissions = [
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
      ];

      const ownerPerms = await service.getDefaultPermissionsForRole('owner');

      for (const perm of requiredPermissions) {
        expect(ownerPerms).toContain(perm);
      }
    });
  });

  describe('Cache Management', () => {
    it('should clear all permission cache', async () => {
      mockDb.mockResolvedValueOnce([{ permission: 'team:read' }]);

      // Load permission into cache
      await service.getPermissions('role-1');

      // Clear cache
      service.clearCache();

      // Next call should hit DB
      mockDb.mockResolvedValueOnce([{ permission: 'team:read' }]);
      await service.getPermissions('role-1');

      expect(mockDb).toHaveBeenCalledTimes(2);
    });

    it('should clear specific role cache', async () => {
      mockDb.mockResolvedValueOnce([{ permission: 'team:read' }]);

      // Load permission into cache
      await service.getPermissions('role-1');

      // Clear specific role cache
      service.clearRoleCache('role-1');

      // Next call should hit DB
      mockDb.mockResolvedValueOnce([{ permission: 'team:read' }]);
      await service.getPermissions('role-1');

      expect(mockDb).toHaveBeenCalledTimes(2);
    });

    it('should not affect other roles when clearing specific cache', async () => {
      mockDb.mockResolvedValueOnce([{ permission: 'team:read' }]);
      mockDb.mockResolvedValueOnce([{ permission: 'vault:read' }]);

      // Load permissions into cache
      await service.getPermissions('role-1');
      await service.getPermissions('role-2');

      // Clear role-1 cache only
      service.clearRoleCache('role-1');

      // role-2 should still use cache
      const result = await service.getPermissions('role-2');

      expect(result).toContain('vault:read');
      expect(mockDb).toHaveBeenCalledTimes(2);
    });
  });

  describe('RBAC Integration Scenarios', () => {
    it('should enforce owner permissions', async () => {
      mockDb.mockResolvedValueOnce([{ permission: 'team:delete' }]);

      const result = await service.checkPermission('user-1', 'team-1', 'team:delete');

      expect(result).toBe(true);
    });

    it('should restrict editor from deleting team', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.checkPermission('user-2', 'team-1', 'team:delete');

      expect(result).toBe(false);
    });

    it('should restrict viewer from creating vault', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.checkPermission('user-3', 'team-1', 'vault:create');

      expect(result).toBe(false);
    });

    it('should allow viewer to read vault', async () => {
      mockDb.mockResolvedValueOnce([{ permission: 'vault:read' }]);

      const result = await service.checkPermission('user-3', 'team-1', 'vault:read');

      expect(result).toBe(true);
    });

    it('should allow all roles to read audit logs', async () => {
      const roles = ['owner', 'editor', 'viewer'];

      for (const role of roles) {
        const defaultPerms = await service.getDefaultPermissionsForRole(role);
        expect(defaultPerms).toContain('audit:read');
      }
    });

    it('should support role promotion from viewer to editor', async () => {
      // User starts as viewer - no permissions for vault:create
      mockDb.mockResolvedValueOnce([]);

      let result = await service.checkPermission('user-1', 'team-1', 'vault:create');
      expect(result).toBe(false);

      // Role is upgraded to editor - clear cache to reflect the promotion
      service.clearCache();
      mockDb.mockResolvedValueOnce([
        { permission: 'vault:create' },
      ]);

      result = await service.checkPermission('user-1', 'team-1', 'vault:create');
      expect(result).toBe(true);
    });
  });
});
