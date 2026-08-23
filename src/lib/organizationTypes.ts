/**
 * TypeScript interfaces for Organization Management and Team Invitations
 * Phase 5 Week 1 Feature 3
 */

// Mirrors server-side OrgRole type (server/services/OrganizationService.ts)
// Role types for organizations (4-tier RBAC system)
export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

// Mirrors server-side InvitationStatus type (server/services/InvitationService.ts)
// Invitation status types
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

// Permissions by role
export const ROLE_PERMISSIONS: Record<OrgRole, string[]> = {
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

// Organization entity
export interface Organization {
  id: string;
  parent_id?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// Organization with hierarchy info
export interface OrganizationWithHierarchy extends Organization {
  parent?: Organization | null;
  children?: Organization[];
  member_count?: number;
  owner?: OrgMember | null;
}

// Organization member
export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  is_active: boolean;
  invited_by?: string | null;
  joined_at: string;
  left_at?: string | null;
  updated_at: string;
  deleted_at?: string | null;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

// Organization invitation
export interface OrgInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrgRole;
  token: string;
  status: InvitationStatus;
  accepted_at?: string | null;
  rejected_at?: string | null;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Organization invitation with organization info
export interface OrgInvitationWithOrg extends OrgInvitation {
  organization?: Organization;
  inviter?: {
    id: string;
    email: string;
    name?: string;
  };
}

// Organization audit log
export interface OrgAuditLog {
  id: string;
  organization_id: string;
  user_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

// Request/response types
export interface CreateOrgRequest {
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  parent_id?: string;
}

export interface UpdateOrgRequest {
  name?: string;
  slug?: string;
  description?: string;
  logo_url?: string;
}

export interface InviteMemberRequest {
  email: string;
  role: OrgRole;
}

export interface UpdateMemberRoleRequest {
  role: OrgRole;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface RejectInvitationRequest {
  token: string;
}

export interface ResendInvitationRequest {
  invitationId: string;
}

// API response types
export interface OrgApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface OrgListResponse {
  organizations: Organization[];
  total: number;
  page: number;
  limit: number;
}

export interface OrgMembersResponse {
  members: OrgMember[];
  total: number;
}

export interface OrgInvitationsResponse {
  invitations: OrgInvitation[];
  total: number;
}

export interface OrgAuditLogsResponse {
  logs: OrgAuditLog[];
  total: number;
  page: number;
  limit: number;
}
