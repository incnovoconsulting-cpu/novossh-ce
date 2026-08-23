/**
 * Organization Settings Component
 * Phase 5 Week 1 Feature 3
 *
 * Main component for organization management:
 * - Organization details editing
 * - Member list and role management
 * - Danger zone (delete organization)
 */

import { useState, useEffect, FC } from 'react';
import { organizationApi } from '../../lib/organizationApi';
import type { Organization, OrgMember } from '../../lib/organizationTypes';
import { InvitationForm } from './InvitationForm';
import { PendingInvitations } from './PendingInvitations';
import { MemberList } from './MemberList';

interface OrganizationSettingsProps {
  orgId?: string;
}

export const OrganizationSettings: FC<OrganizationSettingsProps> = ({ orgId }) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'members' | 'invitations'>('details');
  const [saving, setSaving] = useState(false);

  // Load organization and members
  useEffect(() => {
    const loadData = async () => {
      if (!orgId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [org, membersData] = await Promise.all([
          organizationApi.getOrganization(orgId),
          organizationApi.listMembers(orgId),
        ]);

        setOrganization(org);
        setMembers(membersData.members);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load organization');
        console.error('Failed to load organization:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [orgId]);

  const handleUpdateOrganization = async (updates: Partial<Organization>) => {
    if (!organization) return;

    try {
      setSaving(true);
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== null && v !== undefined)
      );
      const updated = await organizationApi.updateOrganization(organization.id, filteredUpdates as any);
      setOrganization(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
      console.error('Failed to update organization:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleMemberAdded = () => {
    // Reload members
    if (orgId) {
      organizationApi.listMembers(orgId).then((data) => setMembers(data.members));
    }
  };

  const handleDeleteOrganization = async () => {
    if (!organization) return;

    if (!window.confirm('Are you sure you want to delete this organization? This cannot be undone.')) {
      return;
    }

    try {
      setSaving(true);
      await organizationApi.deleteOrganization(organization.id);
      setOrganization(null);
      // Redirect to organizations list
      window.location.href = '/organizations';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete organization');
      console.error('Failed to delete organization:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading organization settings...</div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <p className="text-red-800">Organization not found or you don't have access to it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'invitations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            Invitations
          </button>
        </nav>
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Organization Details</h2>

            <form className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                <input
                  type="text"
                  value={organization.name}
                  onChange={(e) => {
                    setOrganization({ ...organization, name: e.target.value });
                  }}
                  onBlur={() =>
                    handleUpdateOrganization({ name: organization.name })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Slug</label>
                <input
                  type="text"
                  value={organization.slug}
                  onChange={(e) => {
                    setOrganization({ ...organization, slug: e.target.value });
                  }}
                  onBlur={() =>
                    handleUpdateOrganization({ slug: organization.slug })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                  placeholder="e.g., acme-corp"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={organization.description || ''}
                  onChange={(e) => {
                    setOrganization({ ...organization, description: e.target.value });
                  }}
                  onBlur={() =>
                    handleUpdateOrganization({ description: organization.description })
                  }
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                />
              </div>
            </form>

            {/* Danger Zone */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-medium text-red-900 mb-4">Danger Zone</h3>
              <button
                onClick={handleDeleteOrganization}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                Delete Organization
              </button>
              <p className="mt-2 text-sm text-gray-600">
                Permanently delete this organization and all associated data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          <MemberList orgId={organization.id} members={members} />
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div className="space-y-6">
          <InvitationForm orgId={organization.id} onMemberAdded={handleMemberAdded} />
          <PendingInvitations orgId={organization.id} />
        </div>
      )}
    </div>
  );
};
