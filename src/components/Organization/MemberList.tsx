/**
 * Member List Component
 * Phase 5 Week 1 Feature 3
 *
 * Displays organization members with:
 * - Member info (email, joined date)
 * - Current role
 * - Role change dropdown
 * - Remove button
 */

import { useState, FC } from 'react';
import { organizationApi } from '../../lib/organizationApi';
import type { OrgMember, OrgRole } from '../../lib/organizationTypes';

interface MemberListProps {
  orgId: string;
  members: OrgMember[];
}

export const MemberList: FC<MemberListProps> = ({ orgId, members }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localMembers, setLocalMembers] = useState(members);

  const handleRoleChange = async (memberId: string, newRole: OrgRole) => {
    try {
      setLoading(true);
      setError(null);

      const updated = await organizationApi.updateMemberRole(orgId, memberId, {
        role: newRole,
      });

      setLocalMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: updated.role as OrgRole } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member role');
      console.error('Failed to update member role:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await organizationApi.removeMember(orgId, memberId);
      setLocalMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
      console.error('Failed to remove member:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Team Members</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {localMembers.length === 0 ? (
          <p className="text-gray-600">No team members</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {localMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {member.user?.email || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as OrgRole)}
                        disabled={loading}
                        className="text-sm border-gray-300 rounded-md px-2 py-1"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(member.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
