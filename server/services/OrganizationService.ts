/**
 * Organization Management Service
 *
 * Handles:
 * - CRUD operations for organizations
 * - Multi-level hierarchy management with cycle detection
 * - Organization member management with RBAC
 * - Soft deletes with audit trail
 */

import { getDb } from '../db/connection.js';

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Organization {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  is_active: boolean;
  invited_by?: string | null;
  joined_at: Date;
  left_at?: Date | null;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface OrganizationMemberWithUser extends OrganizationMember {
  user_email?: string;
  user_name?: string;
}

export class OrganizationService {
  private db = getDb();

  /**
   * Create a new organization
   */
  async createOrganization(
    name: string,
    slug: string,
    description?: string,
    logoUrl?: string,
    parentId?: string
  ): Promise<Organization> {
    const result = await this.db`
      INSERT INTO organizations (name, slug, description, logo_url, parent_id)
      VALUES (${name}, ${slug}, ${description || null}, ${logoUrl || null}, ${parentId || null})
      RETURNING *
    `;
    return result[0] as Organization;
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: string): Promise<Organization | null> {
    const result = await this.db`
      SELECT * FROM organizations WHERE id = ${orgId} AND deleted_at IS NULL
    `;
    return result.length > 0 ? (result[0] as Organization) : null;
  }

  /**
   * Get organization by slug
   */
  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const result = await this.db`
      SELECT * FROM organizations WHERE slug = ${slug} AND deleted_at IS NULL
    `;
    return result.length > 0 ? (result[0] as Organization) : null;
  }

  /**
   * List user's organizations
   */
  async listUserOrganizations(userId: string): Promise<Organization[]> {
    const result = await this.db`
      SELECT DISTINCT o.* FROM organizations o
      INNER JOIN org_members om ON o.id = om.organization_id
      WHERE om.user_id = ${userId} AND om.is_active = true AND o.deleted_at IS NULL
      ORDER BY o.created_at DESC
    `;
    return result as unknown as Organization[];
  }

  /**
   * Update organization
   */
  async updateOrganization(
    orgId: string,
    updates: Partial<Organization>
  ): Promise<Organization> {
    const { name, slug, description, logo_url } = updates;
    const result = await this.db`
      UPDATE organizations
      SET
        name = ${name || this.db`name`},
        slug = ${slug || this.db`slug`},
        description = ${description || this.db`description`},
        logo_url = ${logo_url || this.db`logo_url`},
        updated_at = NOW()
      WHERE id = ${orgId}
      RETURNING *
    `;
    return result[0] as Organization;
  }

  /**
   * Soft delete organization
   */
  async deleteOrganization(orgId: string): Promise<void> {
    await this.db`
      UPDATE organizations
      SET is_active = false, deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${orgId}
    `;
  }

  /**
   * Check for circular references in hierarchy
   */
  private async hasCircularReference(orgId: string, parentId: string): Promise<boolean> {
    if (orgId === parentId) return true;

    const visited = new Set<string>();
    let current = parentId;

    while (current) {
      if (visited.has(current)) return true;
      visited.add(current);

      const result = await this.db`
        SELECT parent_id FROM organizations WHERE id = ${current}
      `;

      if (result.length === 0) break;
      current = result[0].parent_id || null;
    }

    return false;
  }

  /**
   * Update organization hierarchy with cycle detection
   */
  async updateHierarchy(orgId: string, parentId: string | null): Promise<Organization> {
    if (parentId && (await this.hasCircularReference(orgId, parentId))) {
      throw new Error('Circular reference detected in organization hierarchy');
    }

    const result = await this.db`
      UPDATE organizations
      SET parent_id = ${parentId}, updated_at = NOW()
      WHERE id = ${orgId}
      RETURNING *
    `;
    return result[0] as Organization;
  }

  /**
   * Get organization hierarchy tree
   */
  async getHierarchyTree(orgId: string, depth = 0, maxDepth = 10): Promise<any> {
    if (depth > maxDepth) return null;

    const org = await this.getOrganization(orgId);
    if (!org) return null;

    const children = await this.db`
      SELECT * FROM organizations
      WHERE parent_id = ${orgId} AND deleted_at IS NULL
      ORDER BY created_at ASC
    `;

    const childTrees = await Promise.all(
      (children as any[]).map((child) => this.getHierarchyTree(child.id, depth + 1, maxDepth))
    );

    return {
      ...org,
      children: childTrees.filter((c) => c !== null),
    };
  }

  /**
   * Add member to organization
   */
  async addMember(
    orgId: string,
    userId: string,
    role: OrgRole = 'member',
    invitedBy?: string
  ): Promise<OrganizationMember> {
    const result = await this.db`
      INSERT INTO org_members (organization_id, user_id, role, invited_by)
      VALUES (${orgId}, ${userId}, ${role}, ${invitedBy || null})
      ON CONFLICT (organization_id, user_id) WHERE is_active = true DO UPDATE
      SET is_active = true, role = ${role}, updated_at = NOW(), deleted_at = NULL
      RETURNING *
    `;
    return result[0] as OrganizationMember;
  }

  /**
   * Get organization member
   */
  async getMember(orgId: string, memberId: string): Promise<OrganizationMember | null> {
    const result = await this.db`
      SELECT * FROM org_members
      WHERE id = ${memberId} AND organization_id = ${orgId} AND is_active = true
    `;
    return result.length > 0 ? (result[0] as OrganizationMember) : null;
  }

  /**
   * Get member by user ID
   */
  async getMemberByUserId(
    orgId: string,
    userId: string
  ): Promise<OrganizationMember | null> {
    const result = await this.db`
      SELECT * FROM org_members
      WHERE organization_id = ${orgId} AND user_id = ${userId} AND is_active = true
    `;
    return result.length > 0 ? (result[0] as OrganizationMember) : null;
  }

  /**
   * List organization members
   */
  async listMembers(orgId: string): Promise<OrganizationMember[]> {
    const result = await this.db`
      SELECT * FROM org_members
      WHERE organization_id = ${orgId} AND is_active = true
      ORDER BY joined_at DESC
    `;
    return result as unknown as OrganizationMember[];
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    orgId: string,
    memberId: string,
    role: OrgRole
  ): Promise<OrganizationMember> {
    const result = await this.db`
      UPDATE org_members
      SET role = ${role}, updated_at = NOW()
      WHERE id = ${memberId} AND organization_id = ${orgId}
      RETURNING *
    `;
    return result[0] as OrganizationMember;
  }

  /**
   * Remove member from organization (soft delete)
   */
  async removeMember(orgId: string, memberId: string): Promise<void> {
    await this.db`
      UPDATE org_members
      SET is_active = false, left_at = NOW(), updated_at = NOW()
      WHERE id = ${memberId} AND organization_id = ${orgId}
    `;
  }

  /**
   * Check if user has permission in organization
   */
  async hasPermission(
    orgId: string,
    userId: string,
    permission: string
  ): Promise<boolean> {
    const member = await this.getMemberByUserId(orgId, userId);
    if (!member) return false;

    const permissions: Record<OrgRole, string[]> = {
      owner: [
        'org:read',
        'org:update',
        'org:delete',
        'member:add',
        'member:remove',
        'member:update',
        'invitation:send',
        'invitation:manage',
        'hierarchy:update',
        'audit:read',
      ],
      admin: [
        'org:read',
        'org:update',
        'member:add',
        'member:remove',
        'member:update',
        'invitation:send',
        'audit:read',
      ],
      member: [
        'org:read',
        'member:read',
      ],
      viewer: [
        'org:read',
      ],
    };

    return permissions[member.role].includes(permission);
  }
}
