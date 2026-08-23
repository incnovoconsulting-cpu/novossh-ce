import { NotificationCenter } from '../Notifications/NotificationCenter';

export function NotificationsView() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <NotificationCenter />
    </div>
  );
}
