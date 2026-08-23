/**
 * Invitation Form Component
 * Phase 5 Week 1 Feature 3
 *
 * Form to invite new members:
 * - Email input
 * - Role selector
 * - Send button
 */

import { useState, FC, FormEvent } from 'react';
import { organizationApi } from '../../lib/organizationApi';
import type { OrgRole } from '../../lib/organizationTypes';

interface InvitationFormProps {
  orgId: string;
  onMemberAdded?: () => void;
}

export const InvitationForm: FC<InvitationFormProps> = ({ orgId, onMemberAdded }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await organizationApi.inviteMember(orgId, {
        email: email.trim(),
        role,
      });

      setEmail('');
      setRole('member');
      setSuccess(true);

      setTimeout(() => setSuccess(false), 3000);
      onMemberAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
      console.error('Failed to send invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Invite Team Member</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4">
          <p className="text-green-800">Invitation sent successfully!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as OrgRole)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            disabled={loading}
          >
            <option value="viewer">Viewer (Read-only)</option>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          <p className="mt-1 text-xs text-gray-600">
            {role === 'owner' && 'Full control over organization and resources'}
            {role === 'admin' && 'Can manage members and update organization'}
            {role === 'member' && 'Can create and modify resources'}
            {role === 'viewer' && 'Read-only access to resources'}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Invitation'}
        </button>
      </form>
    </div>
  );
};
