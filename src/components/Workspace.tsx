import { lazy, Suspense } from 'react';
import { useStore } from '../lib/store';
import { TabBar } from './TabBar';

const TerminalPane = lazy(() => import('./TerminalPane').then(m => ({ default: m.TerminalPane })));
const HostsHomeView = lazy(() => import('./views/HostsHomeView').then(m => ({ default: m.HostsHomeView })));
const SnippetsView = lazy(() => import('./views/SnippetsView').then(m => ({ default: m.SnippetsView })));
const KeysView = lazy(() => import('./views/KeysView').then(m => ({ default: m.KeysView })));
const ForwardingView = lazy(() => import('./views/ForwardingView').then(m => ({ default: m.ForwardingView })));
const SFTPView = lazy(() => import('./views/SFTPView').then(m => ({ default: m.SFTPView })));
const HistoryView = lazy(() => import('./views/HistoryView').then(m => ({ default: m.HistoryView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const AnalyticsView = lazy(() => import('./views/AnalyticsView'));
const LogsView = lazy(() => import('./views/LogsView').then(m => ({ default: m.LogsView })));
const PortalView = lazy(() => import('./Portal/PortalView').then(m => ({ default: m.PortalView })));
const NotificationsView = lazy(() => import('./views/NotificationsView').then(m => ({ default: m.NotificationsView })));
const OrganizationsView = lazy(() => import('./views/OrganizationsView').then(m => ({ default: m.OrganizationsView })));
const P2PView = lazy(() => import('./views/P2PView').then(m => ({ default: m.P2PView })));
const SecurityView = lazy(() => import('./views/SecurityView').then(m => ({ default: m.SecurityView })));
const SessionsView = lazy(() => import('./views/SessionsView').then(m => ({ default: m.SessionsView })));
const VaultManager = lazy(() => import('./Vault/VaultManager').then(m => ({ default: m.VaultManager })));
const WikiPage = lazy(() => import('./Wiki/WikiPage'));
const AdminDashboard = lazy(() => import('./views/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
import { BroadcastInput } from './BroadcastInput';
import { TrialStatus } from './Billing/TrialStatus';
import { EmailVerificationBanner } from './Auth/EmailVerificationBanner';

function getDeviceId(): string {
  const KEY = 'novossh-device-id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `device-${crypto.randomUUID()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

function getAuthIdentity(): { userId: string; organizationId: string } {
  try {
    const auth = JSON.parse(localStorage.getItem('novossh-auth') || '{}');
    if (!auth?.user?.id) throw new Error('Not authenticated');
    return {
      userId: auth.user.id,
      organizationId: auth.user.organizationId || '',
    };
  } catch {
    return { userId: '', organizationId: '' };
  }
}

const LoadingPlaceholder = () => <div className="flex items-center justify-center h-full bg-black/40">Loading...</div>;

export function Workspace() {
  const tabs = useStore((s) => s.tabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const view = useStore((s) => s.view);
  const splitView = useStore((s) => s.splitView);
  const broadcastMode = useStore((s) => s.broadcastMode);
  const active = tabs.find((t) => t.id === activeTabId) ?? null;

  const visibleTabs = splitView ? tabs : tabs.filter((t) => t.id === activeTabId);

  return (
    <main className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="px-3 pt-2 space-y-2">
        <EmailVerificationBanner />
        <TrialStatus />
      </div>
      {tabs.length > 0 && <TabBar />}

      <div className="relative flex-1 overflow-hidden">
        {tabs.length > 0 ? (
          splitView ? (
            <div className="flex h-full flex-wrap">
              {visibleTabs.map((t) => (
                <div
                  key={t.id}
                  className="overflow-hidden border-r border-b border-white/[0.04]"
                  style={{ width: `${100 / Math.ceil(Math.sqrt(visibleTabs.length))}%`, height: `${100 / Math.ceil(visibleTabs.length / Math.ceil(Math.sqrt(visibleTabs.length)))}%` }}
                >
                  <Suspense fallback={<LoadingPlaceholder />}>
                    <TerminalPane tab={t} />
                  </Suspense>
                </div>
              ))}
            </div>
          ) : (
            tabs.map((t) => (
              <div
                key={t.id}
                className="absolute inset-0"
                style={{ display: t.id === activeTabId ? 'block' : 'none' }}
              >
                <Suspense fallback={<LoadingPlaceholder />}>
                  <TerminalPane tab={t} />
                </Suspense>
              </div>
            ))
          )
        ) : null}

        {!active && tabs.length === 0 && (
          <div className="absolute inset-0 overflow-auto bg-ink-950">
            <Suspense fallback={<LoadingPlaceholder />}>
              {view === 'hosts' && <HostsHomeView />}
              {view === 'snippets' && <SnippetsView />}
              {view === 'keys' && <KeysView />}
              {view === 'portforwarding' && <ForwardingView />}
              {view === 'sftp' && <SFTPView />}
              {view === 'history' && <HistoryView />}
              {view === 'settings' && <SettingsView />}
              {view === 'analytics' && <AnalyticsView />}
              {view === 'logs' && <LogsView />}
              {view === 'portal' && <PortalView onBack={() => useStore.getState().setView('settings')} />}
              {view === 'notifications' && <NotificationsView />}
              {view === 'organizations' && <OrganizationsView />}
              {view === 'p2p' && <P2PView />}
              {view === 'security' && <SecurityView />}
              {view === 'sessions' && <SessionsView />}
              {view === 'wiki' && <WikiPage />}
              {view === 'admin' && <AdminDashboard />}
              {view === 'vault' && (
                <VaultManager
                  userId={getAuthIdentity().userId}
                  organizationId={getAuthIdentity().organizationId}
                  deviceId={getDeviceId()}
                />
              )}
            </Suspense>
          </div>
        )}
      </div>

      {broadcastMode && tabs.length > 0 && <BroadcastInput />}
    </main>
  );
}
export default Workspace;
