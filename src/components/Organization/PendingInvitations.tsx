/**
 * Pending Invitations Component
 * Phase 5 Week 1 Feature 3
 *
 * Displays list of pending invitations with:
 * - Email and role
 * - Expiration date
 * - Resend and cancel buttons
 */

import { useState, useEffect, FC } from 'react';
import { organizationApi } from '../../lib/organizationApi';
import type { OrgInvitation } from '../../lib/organizationTypes';

interface PendingInvitationsProps {
  orgId: string;
}

export const PendingInvitations: FC<PendingInvitationsProps> = ({ orgId }) => {
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, [orgId]);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const data = await organizationApi.listInvitations(orgId);
      setInvitations(data.invitations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
      console.error('Failed to load invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (invitationId: string) => {
    try {
      await organizationApi.resendInvitation(orgId, invitationId);
      loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation');
      console.error('Failed to resend invitation:', err);
    }
  };

  const handleCancel = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      await organizationApi.cancelInvitation(orgId, invitationId);
      loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
      console.error('Failed to cancel invitation:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-600">Loading invitations...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Pending Invitations</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {invitations.length === 0 ? (
          <p className="text-gray-600">No pending invitations</p>
        ) : (
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{invitation.email}</p>
                  <p className="text-sm text-gray-600">
                    Role: <span className="font-medium capitalize">{invitation.role}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleResend(invitation.id)}
                    className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                  >
                    Resend
                  </button>
                  <button
                    onClick={() => handleCancel(invitation.id)}
                    className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
