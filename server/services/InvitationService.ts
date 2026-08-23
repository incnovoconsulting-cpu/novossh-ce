/**
 * Organization Invitation Service
 *
 * Handles:
 * - Secure token generation (32-byte random hex)
 * - Invitation workflow (send, accept, reject, expire)
 * - Email notifications
 * - Token expiration (7 days)
 */

import { randomBytes } from 'crypto';
import { getDb } from '../db/connection.js';

export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  token: string;
  status: InvitationStatus;
  accepted_at?: Date | null;
  rejected_at?: Date | null;
  invited_by: string;
  invited_at: Date;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export class InvitationService {
  private db = getDb();

  /**
   * Generate secure random token (32-byte hex)
   */
  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create invitation
   */
  async createInvitation(
    orgId: string,
    email: string,
    role: string,
    invitedBy: string
  ): Promise<Invitation> {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await this.db`
      INSERT INTO org_invitations (
        organization_id,
        email,
        role,
        token,
        invited_by,
        expires_at
      )
      VALUES (${orgId}, ${email}, ${role}, ${token}, ${invitedBy}, ${expiresAt})
      RETURNING *
    `;

    return result[0] as Invitation;
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string): Promise<Invitation | null> {
    const result = await this.db`
      SELECT * FROM org_invitations WHERE token = ${token} AND status = 'pending'
    `;
    return result.length > 0 ? (result[0] as Invitation) : null;
  }

  /**
   * Get invitation by ID
   */
  async getInvitation(invitationId: string): Promise<Invitation | null> {
    const result = await this.db`
      SELECT * FROM org_invitations WHERE id = ${invitationId}
    `;
    return result.length > 0 ? (result[0] as Invitation) : null;
  }

  /**
   * List pending invitations for organization
   */
  async listPendingInvitations(orgId: string): Promise<Invitation[]> {
    const result = await this.db`
      SELECT * FROM org_invitations
      WHERE organization_id = ${orgId} AND status = 'pending' AND expires_at > NOW()
      ORDER BY invited_at DESC
    `;
    return result as unknown as Invitation[];
  }

  /**
   * List user's pending invitations
   */
  async listUserPendingInvitations(email: string): Promise<Invitation[]> {
    const result = await this.db`
      SELECT * FROM org_invitations
      WHERE email = ${email} AND status = 'pending' AND expires_at > NOW()
      ORDER BY invited_at DESC
    `;
    return result as unknown as Invitation[];
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, _userId: string): Promise<Invitation> {
    const result = await this.db`
      UPDATE org_invitations
      SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
      WHERE token = ${token}
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Invitation not found');
    }

    return result[0] as Invitation;
  }

  /**
   * Reject invitation
   */
  async rejectInvitation(token: string): Promise<Invitation> {
    const result = await this.db`
      UPDATE org_invitations
      SET status = 'rejected', rejected_at = NOW(), updated_at = NOW()
      WHERE token = ${token}
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Invitation not found');
    }

    return result[0] as Invitation;
  }

  /**
   * Mark invitation as expired
   */
  async expireInvitation(invitationId: string): Promise<Invitation> {
    const result = await this.db`
      UPDATE org_invitations
      SET status = 'expired', updated_at = NOW()
      WHERE id = ${invitationId}
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Invitation not found');
    }

    return result[0] as Invitation;
  }

  /**
   * Resend invitation (update expires_at and create new token if needed)
   */
  async resendInvitation(invitationId: string): Promise<Invitation> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const result = await this.db`
      UPDATE org_invitations
      SET expires_at = ${expiresAt}, updated_at = NOW()
      WHERE id = ${invitationId} AND status = 'pending'
      RETURNING *
    `;

    if (result.length === 0) {
      throw new Error('Invitation not found or no longer pending');
    }

    return result[0] as Invitation;
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    await this.db`
      UPDATE org_invitations
      SET status = 'rejected', rejected_at = NOW(), updated_at = NOW()
      WHERE id = ${invitationId}
    `;
  }

  /**
   * Clean up expired invitations
   */
  async cleanupExpiredInvitations(): Promise<number> {
    const result = await this.db`
      UPDATE org_invitations
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'pending' AND expires_at <= NOW()
    `;
    return result.count;
  }

  /**
   * Get invitation statistics for organization
   */
  async getInvitationStats(orgId: string): Promise<{
    pending: number;
    accepted: number;
    rejected: number;
    expired: number;
  }> {
    const result = await this.db`
      SELECT
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired
      FROM org_invitations
      WHERE organization_id = ${orgId}
    `;

    return {
      pending: parseInt(result[0].pending) || 0,
      accepted: parseInt(result[0].accepted) || 0,
      rejected: parseInt(result[0].rejected) || 0,
      expired: parseInt(result[0].expired) || 0,
    };
  }

  /**
   * Check if email is already a member
   */
  async isEmailMember(orgId: string, email: string): Promise<boolean> {
    const result = await this.db`
      SELECT 1 FROM org_invitations
      WHERE organization_id = ${orgId} AND email = ${email} AND status = 'accepted'
      LIMIT 1
    `;
    return result.length > 0;
  }

  /**
   * Check if invitation exists and is valid
   */
  async isInvitationValid(token: string): Promise<boolean> {
    const result = await this.db`
      SELECT 1 FROM org_invitations
      WHERE token = ${token}
        AND status = 'pending'
        AND expires_at > NOW()
      LIMIT 1
    `;
    return result.length > 0;
  }
}
