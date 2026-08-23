/**
 * HTTP client for organization management API
 * Phase 5 Week 1 Feature 3
 *
 * Wraps all /api/organizations endpoints and handles:
 * - User authentication headers
 * - JSON serialization/deserialization
 * - Error normalization
 * - Type safety with TypeScript
 */

import type {
  Organization,
  OrganizationWithHierarchy,
  OrgMember,
  OrgInvitation,
  OrgInvitationWithOrg,
  CreateOrgRequest,
  UpdateOrgRequest,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  AcceptInvitationRequest,
  RejectInvitationRequest,
  OrgListResponse,
  OrgMembersResponse,
  OrgInvitationsResponse,
  OrgAuditLogsResponse,
} from './organizationTypes.js';
import { apiFetch } from './apiFetch.js';
import { useStore } from './store.js';

class OrganizationApi {
  private fetch(path: string, init: RequestInit = {}): Promise<Response> {
    const accessToken = useStore.getState().auth.accessToken || '';
    return apiFetch(path, accessToken, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  }

  /**
   * Create a new organization
   */
  async createOrganization(request: CreateOrgRequest): Promise<Organization> {
    const response = await this.fetch(`/api/organizations`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to create organization: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: string): Promise<Organization> {
    const response = await this.fetch(`/api/organizations/${orgId}`);

    if (!response.ok) {
      throw new Error(`Failed to get organization: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get organization with hierarchy info
   */
  async getOrganizationWithHierarchy(orgId: string): Promise<OrganizationWithHierarchy> {
    const response = await this.fetch(`/api/organizations/${orgId}?include=hierarchy`);

    if (!response.ok) {
      throw new Error(`Failed to get organization hierarchy: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List user's organizations
   */
  async listOrganizations(page = 1, limit = 20): Promise<OrgListResponse> {
    const response = await this.fetch(`/api/organizations?page=${page}&limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Failed to list organizations: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update organization
   */
  async updateOrganization(orgId: string, request: UpdateOrgRequest): Promise<Organization> {
    const response = await this.fetch(`/api/organizations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to update organization: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete organization (soft delete)
   */
  async deleteOrganization(orgId: string): Promise<void> {
    const response = await this.fetch(`/api/organizations/${orgId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete organization: ${response.statusText}`);
    }
  }

  /**
   * Update organization hierarchy (change parent)
   */
  async updateOrgHierarchy(orgId: string, parentId: string | null): Promise<Organization> {
    const response = await this.fetch(`/api/organizations/${orgId}/hierarchy`, {
      method: 'PATCH',
      body: JSON.stringify({ parent_id: parentId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update organization hierarchy: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get organization hierarchy tree
   */
  async getOrgHierarchyTree(orgId: string): Promise<OrganizationWithHierarchy> {
    const response = await this.fetch(`/api/organizations/${orgId}/hierarchy/tree`);

    if (!response.ok) {
      throw new Error(`Failed to get organization hierarchy tree: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List organization members
   */
  async listMembers(orgId: string, page = 1, limit = 50): Promise<OrgMembersResponse> {
    const response = await this.fetch(`/api/organizations/${orgId}/members?page=${page}&limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Failed to list members: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get single member
   */
  async getMember(orgId: string, memberId: string): Promise<OrgMember> {
    const response = await this.fetch(`/api/organizations/${orgId}/members/${memberId}`);

    if (!response.ok) {
      throw new Error(`Failed to get member: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    orgId: string,
    memberId: string,
    request: UpdateMemberRoleRequest
  ): Promise<OrgMember> {
    const response = await this.fetch(`/api/organizations/${orgId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to update member role: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Remove member from organization
   */
  async removeMember(orgId: string, memberId: string): Promise<void> {
    const response = await this.fetch(`/api/organizations/${orgId}/members/${memberId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to remove member: ${response.statusText}`);
    }
  }

  /**
   * Invite member to organization
   */
  async inviteMember(orgId: string, request: InviteMemberRequest): Promise<OrgInvitation> {
    const response = await this.fetch(`/api/organizations/${orgId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to send invitation: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List pending invitations for organization
   */
  async listInvitations(orgId: string, page = 1, limit = 50): Promise<OrgInvitationsResponse> {
    const response = await this.fetch(`/api/organizations/${orgId}/invitations?page=${page}&limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Failed to list invitations: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get user's pending invitations
   */
  async getUserInvitations(): Promise<OrgInvitationWithOrg[]> {
    const response = await this.fetch(`/api/invitations/pending`);

    if (!response.ok) {
      throw new Error(`Failed to get user invitations: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(request: AcceptInvitationRequest): Promise<OrgMember> {
    const response = await this.fetch(`/api/invitations/accept`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to accept invitation: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Reject invitation
   */
  async rejectInvitation(request: RejectInvitationRequest): Promise<void> {
    const response = await this.fetch(`/api/invitations/reject`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to reject invitation: ${response.statusText}`);
    }
  }

  /**
   * Resend invitation
   */
  async resendInvitation(orgId: string, invitationId: string): Promise<OrgInvitation> {
    const response = await this.fetch(
      `/organizations/${orgId}/invitations/${invitationId}/resend`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error(`Failed to resend invitation: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(orgId: string, invitationId: string): Promise<void> {
    const response = await this.fetch(`/api/organizations/${orgId}/invitations/${invitationId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel invitation: ${response.statusText}`);
    }
  }

  /**
   * Get organization audit logs
   */
  async getAuditLogs(
    orgId: string,
    page = 1,
    limit = 50
  ): Promise<OrgAuditLogsResponse> {
    const response = await this.fetch(`/api/organizations/${orgId}/audit-logs?page=${page}&limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Failed to get audit logs: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Filter audit logs by action
   */
  async getAuditLogsByAction(
    orgId: string,
    action: string,
    page = 1,
    limit = 50
  ): Promise<OrgAuditLogsResponse> {
    const response = await this.fetch(
      `/organizations/${orgId}/audit-logs?action=${action}&page=${page}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get audit logs: ${response.statusText}`);
    }

    return response.json();
  }
}

export const organizationApi = new OrganizationApi();
