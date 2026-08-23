import { FC } from 'react';
/**
 * Organization Settings Page
 * Phase 5 Week 1 Feature 3
 */

import { OrganizationSettings as OrgSettingsComponent } from '../components/Organization/OrganizationSettings';

export const OrganizationSettingsPage: FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organization Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your organization, members, and invitations
          </p>
        </div>

        <OrgSettingsComponent />
      </div>
    </div>
  );
};
