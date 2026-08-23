/**
 * Organization Hierarchy Component
 * Phase 5 Week 1 Feature 3
 *
 * Displays organization hierarchy:
 * - Expandable tree view
 * - Parent-child relationships
 * - Drag-drop support (future)
 */

import { useState, useEffect, FC } from 'react';
import { organizationApi } from '../../lib/organizationApi';
import type { OrganizationWithHierarchy } from '../../lib/organizationTypes';

interface OrgHierarchyProps {
  orgId: string;
}

const OrgTreeNode: FC<{
  node: OrganizationWithHierarchy;
  level: number;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}> = ({ node, level, expanded, onToggle }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded[node.id];

  return (
    <div>
      <div className="flex items-center py-2" style={{ marginLeft: `${level * 1.5}rem` }}>
        {hasChildren && (
          <button
            onClick={() => onToggle(node.id)}
            className="mr-2 p-1 hover:bg-gray-100 rounded"
          >
            <span className="text-sm">{isExpanded ? '▼' : '▶'}</span>
          </button>
        )}
        {!hasChildren && <span className="mr-2 w-6" />}

        <div className="flex-1">
          <p className="font-medium text-gray-900">{node.name}</p>
          <p className="text-sm text-gray-600">{node.slug}</p>
        </div>

        {node.member_count && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {node.member_count} members
          </span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <OrgTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const OrgHierarchy: FC<OrgHierarchyProps> = ({ orgId }) => {
  const [hierarchy, setHierarchy] = useState<OrganizationWithHierarchy | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHierarchy = async () => {
      try {
        setLoading(true);
        const data = await organizationApi.getOrgHierarchyTree(orgId);
        setHierarchy(data);
        // Expand root by default
        setExpanded({ [orgId]: true });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
        console.error('Failed to load hierarchy:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHierarchy();
  }, [orgId]);

  const handleToggle = (id: string) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (loading) {
    return <div className="text-gray-600">Loading hierarchy...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!hierarchy) {
    return <div className="text-gray-600">No hierarchy found</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Organization Hierarchy</h2>
      <OrgTreeNode node={hierarchy} level={0} expanded={expanded} onToggle={handleToggle} />
    </div>
  );
};
