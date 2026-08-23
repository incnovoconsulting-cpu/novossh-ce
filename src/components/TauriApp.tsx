import React, { useState, useEffect, Suspense, lazy } from 'react';
import { TauriLayout } from './TauriLayout';
import { TauriTerminal } from './TauriTerminal';
import { Host } from '../lib/types';
import { listen } from '@tauri-apps/api/event';
import { useStore } from '../lib/store';

// Lazy-load all view components for code splitting
const HostsHomeView = lazy(() => import('./views/HostsHomeView').then(m => ({ default: m.HostsHomeView })));
const SnippetsView = lazy(() => import('./views/SnippetsView').then(m => ({ default: m.SnippetsView })));
const KeysView = lazy(() => import('./views/KeysView').then(m => ({ default: m.KeysView })));
const ForwardingView = lazy(() => import('./views/ForwardingView').then(m => ({ default: m.ForwardingView })));
const SFTPView = lazy(() => import('./views/SFTPView').then(m => ({ default: m.SFTPView })));
const HistoryView = lazy(() => import('./views/HistoryView').then(m => ({ default: m.HistoryView })));
const SessionsView = lazy(() => import('./views/SessionsView').then(m => ({ default: m.SessionsView })));
const LogsView = lazy(() => import('./views/LogsView').then(m => ({ default: m.LogsView })));
const AnalyticsView = lazy(() => import('./views/AnalyticsView'));
const P2PView = lazy(() => import('./views/P2PView').then(m => ({ default: m.P2PView })));
const SecurityView = lazy(() => import('./views/SecurityView').then(m => ({ default: m.SecurityView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));
const NotificationsView = lazy(() => import('./views/NotificationsView').then(m => ({ default: m.NotificationsView })));
const OrganizationsView = lazy(() => import('./views/OrganizationsView').then(m => ({ default: m.OrganizationsView })));
const VaultManager = lazy(() => import('./Vault/VaultManager').then(m => ({ default: m.VaultManager })));
const PortalView = lazy(() => import('./Portal/PortalView').then(m => ({ default: m.PortalView })));
const CommandPalette = lazy(() => import('./CommandPalette'));
const AdminDashboard = lazy(() => import('./views/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

// Get auth identity from localStorage (same as web app)
function getAuthIdentity(): { userId: string; organizationId: string } {
  try {
    const auth = JSON.parse(localStorage.getItem('novossh-auth') || '{}');
    return {
      userId: auth?.user?.id || 'desktop-user',
      organizationId: auth?.user?.organizationId || 'desktop-org',
    };
  } catch {
    return { userId: 'desktop-user', organizationId: 'desktop-org' };
  }
}

function getDeviceId(): string {
  let deviceId = localStorage.getItem('novossh-device-id');
  if (!deviceId) {
    deviceId = 'desktop-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('novossh-device-id', deviceId);
  }
  return deviceId;
}

type ViewKey =
  | 'terminal'
  | 'hosts'
  | 'snippets'
  | 'keys'
  | 'portforwarding'
  | 'sftp'
  | 'vault'
  | 'history'
  | 'sessions'
  | 'logs'
  | 'analytics'
  | 'p2p'
  | 'security'
  | 'settings'
  | 'notifications'
  | 'organizations'
  | 'portal'
  | 'admin';

const navItems: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'terminal', label: 'Terminal', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { key: 'hosts', label: 'Hosts', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2' },
  { key: 'snippets', label: 'Snippets', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  { key: 'keys', label: 'Keys', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
  { key: 'portforwarding', label: 'Port Forward', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
  { key: 'sftp', label: 'SFTP', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { key: 'vault', label: 'Vault', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { key: 'history', label: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'sessions', label: 'Sessions', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { key: 'logs', label: 'Logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { key: 'analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { key: 'p2p', label: 'P2P Sync', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
  { key: 'security', label: 'Security', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { key: 'organizations', label: 'Teams', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { key: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { key: 'portal', label: 'Billing', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  { key: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export function TauriApp() {
  const [currentView, setCurrentView] = useState<ViewKey>('terminal');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const hosts = useStore((s) => s.hosts);
  const setView = useStore((s) => s.setView);

  // Ctrl/Cmd+K for command palette
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Listen for global shortcuts from Rust backend
  useEffect(() => {
    const unlisten = listen<string>('global-shortcut', (event) => {
      switch (event.payload) {
        case 'new-tab':
          setCurrentView('terminal');
          break;
        case 'quick-connect':
          setCurrentView('hosts');
          break;
        case 'open-sftp':
          setCurrentView('sftp');
          break;
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const LoadingFallback = () => (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00e5ff] border-t-transparent" />
    </div>
  );

  const renderView = () => {
    switch (currentView) {
      case 'terminal':
        return (
          <TauriTerminal
            sessionId={activeSessionId || undefined}
            onConnect={setActiveSessionId}
            onDisconnect={() => setActiveSessionId(null)}
          />
        );
      case 'hosts':
        return <Suspense fallback={<LoadingFallback />}><HostsHomeView /></Suspense>;
      case 'snippets':
        return <Suspense fallback={<LoadingFallback />}><SnippetsView /></Suspense>;
      case 'keys':
        return <Suspense fallback={<LoadingFallback />}><KeysView /></Suspense>;
      case 'portforwarding':
        return <Suspense fallback={<LoadingFallback />}><ForwardingView /></Suspense>;
      case 'sftp':
        return <Suspense fallback={<LoadingFallback />}><SFTPView /></Suspense>;
      case 'vault':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <VaultManager
              userId={getAuthIdentity().userId}
              organizationId={getAuthIdentity().organizationId}
              deviceId={getDeviceId()}
            />
          </Suspense>
        );
      case 'history':
        return <Suspense fallback={<LoadingFallback />}><HistoryView /></Suspense>;
      case 'sessions':
        return <Suspense fallback={<LoadingFallback />}><SessionsView /></Suspense>;
      case 'logs':
        return <Suspense fallback={<LoadingFallback />}><LogsView /></Suspense>;
      case 'analytics':
        return <Suspense fallback={<LoadingFallback />}><AnalyticsView /></Suspense>;
      case 'p2p':
        return <Suspense fallback={<LoadingFallback />}><P2PView /></Suspense>;
      case 'security':
        return <Suspense fallback={<LoadingFallback />}><SecurityView /></Suspense>;
      case 'settings':
        return <Suspense fallback={<LoadingFallback />}><SettingsView /></Suspense>;
      case 'notifications':
        return <Suspense fallback={<LoadingFallback />}><NotificationsView /></Suspense>;
      case 'organizations':
        return <Suspense fallback={<LoadingFallback />}><OrganizationsView /></Suspense>;
      case 'portal':
        return <Suspense fallback={<LoadingFallback />}><PortalView onBack={() => setCurrentView('settings')} /></Suspense>;
      case 'admin':
        return <Suspense fallback={<LoadingFallback />}><AdminDashboard /></Suspense>;
      default:
        return <TauriTerminal />;
    }
  };

  return (
    <TauriLayout>
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="flex w-14 flex-col items-center border-r border-white/[0.06] bg-[#0a0a0f] py-4">
          <div className="mb-6 flex h-8 w-8 items-center justify-center rounded-lg bg-[#00e5ff]/15 text-[#00e5ff]">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 19V7H4v12h16m0-16a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h16M7 12h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" />
            </svg>
          </div>

          <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto">
            {/* Search bar */}
            <div className="w-full px-2 mb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search hosts..."
                className="w-full rounded-lg bg-white/5 px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 outline-none border border-white/[0.06] focus:border-[#00e5ff]/30"
              />
            </div>
            {navItems.map((item) => (
              <NavItem
                key={item.key}
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                  </svg>
                }
                label={item.label}
                active={currentView === item.key}
                onClick={() => setCurrentView(item.key)}
              />
            ))}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {renderView()}
        </div>
      </div>

      {/* Command Palette */}
      {commandPaletteOpen && (
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onConnect={(host) => {
            console.log('Connect to host:', host);
            setCurrentView('terminal');
          }}
          onNewHost={() => {
            setCurrentView('hosts');
          }}
        />
      )}
    </TauriLayout>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
        active
          ? 'bg-[#00e5ff]/10 text-[#00e5ff]'
          : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
      }`}
      title={label}
    >
      {icon}
      {active && (
        <div className="absolute -left-[5px] top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-[#00e5ff]" />
      )}
    </button>
  );
}

export default TauriApp;
