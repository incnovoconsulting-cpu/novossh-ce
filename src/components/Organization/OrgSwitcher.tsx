/**
 * Organization Switcher Component
 * Phase 5 Week 1 Feature 3
 *
 * Dropdown to switch between user's organizations
 */

import { useState, useEffect, FC } from 'react';
import { organizationApi } from '../../lib/organizationApi';
import type { Organization } from '../../lib/organizationTypes';

interface OrgSwitcherProps {
  currentOrgId?: string;
  onOrgChange?: (orgId: string) => void;
}

export const OrgSwitcher: FC<OrgSwitcherProps> = ({ currentOrgId, onOrgChange }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setLoading(true);
        const data = await organizationApi.listOrganizations();
        setOrganizations(data.organizations);
      } catch (err) {
        console.error('Failed to load organizations:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOrganizations();
  }, []);

  const currentOrg = organizations.find((org) => org.id === currentOrgId);

  if (loading || organizations.length === 0) {
    return null;
  }

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-between px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {currentOrg?.name || 'Select Organization'}
        <svg
          className="ml-2 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  onOrgChange?.(org.id);
                  setOpen(false);
                }}
                className={`block w-full text-left px-4 py-2 text-sm ${
                  org.id === currentOrgId
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {org.name}
                <p className="text-xs text-gray-600">{org.slug}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
