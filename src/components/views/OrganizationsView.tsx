import { useStore } from '../../lib/store';
import { OrganizationSettings } from '../Organization/OrganizationSettings';

export function OrganizationsView() {
  const orgId = useStore((s) => s.auth.user?.organizationId);

  return (
    <div className="h-full overflow-y-auto p-6">
      <OrganizationSettings orgId={orgId} />
    </div>
  );
}
