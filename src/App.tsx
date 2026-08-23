import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { NavRail } from './components/NavRail';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { useStore, setTabGuard } from './lib/store';
import { useSubscription } from './hooks/useSubscription';
import { useIsMobile } from './hooks/useMediaQuery';
import type { Host, ViewKey } from './lib/types';

const Workspace = lazy(() => import('./components/Workspace'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const HostFormDialog = lazy(() => import('./components/HostFormDialog'));
const ConnectDialog = lazy(() => import('./components/ConnectDialog'));
const PrivacyPage = lazy(() => import('./components/PrivacyPage'));
const TermsPage = lazy(() => import('./components/TermsPage'));
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const PortForwardingWizard = lazy(() => import('./components/PortForwarding/PortForwardingWizard').then(m => ({ default: m.PortForwardingWizard })));
const WikiPage = lazy(() => import('./components/Wiki/WikiPage'));

const isElectron = !!(window as any).electron || navigator.userAgent.toLowerCase().includes('electron');

// Views the shared Sidebar actually renders navigation for. Every other view is a
// self-contained page (some, like Security, bring their own sub-nav), so rendering the
// shared Sidebar for them just adds an empty second panel next to the page's own —
// the "two nested side panels" bug. Keep this in sync with the view cases in Sidebar.tsx.
const SHARED_SIDEBAR_VIEWS = new Set<ViewKey>([
  'hosts', 'snippets', 'keys', 'portforwarding', 'history', 'settings',
]);

function Titlebar() {
  if (!isElectron) return null;
  return (
    <div className="titlebar" data-tauri-drag-region>
      <span className="font-mono text-xs text-slate-500 select-none">NovoSSH</span>
      <div className="absolute right-0 top-0 flex h-8 items-center" />
    </div>
  );
}

const PATH_TO_VIEW: Record<string, ViewKey> = {
  '/pricing': 'settings',
  '/hosts': 'hosts',
  '/snippets': 'snippets',
  '/keys': 'keys',
  '/keychain': 'keys',
  '/port-forwarding': 'portforwarding',
  '/history': 'history',
  '/analytics': 'analytics',
  '/settings': 'settings',
  '/logs': 'logs',
  '/wiki': 'settings',
};

function syncViewFromUrl() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/pricing' || path === '/settings/subscription') {
    useStore.getState().setView('settings');
    useStore.getState().setSettingsTab('subscription');
  } else if (PATH_TO_VIEW[path]) {
    useStore.getState().setView(PATH_TO_VIEW[path]);
  }
}

export default function App() {
  const view = useStore((s) => s.view);
  const { checkLimit } = useSubscription();
  const isMobile = useIsMobile();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [hostEditor, setHostEditor] = useState<{ open: boolean; initial?: Host }>({ open: false });
  const [connectFor, setConnectFor] = useState<Host | null>(null);
  const [limitToast, setLimitToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showForwardWizard, setShowForwardWizard] = useState(false);
  const setView = useStore((s) => s.setView);
  const hosts = useStore((s) => s.hosts);

  const handleViewChange = useCallback((v: ViewKey) => {
    setView(v);
    setSidebarOpen(false);
  }, [setView]);

  // Privacy page check must come after all hooks
  const isPrivacyPage = window.location.pathname === '/privacy';
  const isTermsPage = window.location.pathname === '/terms';

  useEffect(() => {
    syncViewFromUrl();
    const onPopState = () => syncViewFromUrl();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    setTabGuard(() => {
      const result = checkLimit('tabs');
      if (!result.allowed) {
        setLimitToast(`Tab limit reached (${result.current}/${result.limit}). Upgrade your plan for more.`);
        setTimeout(() => setLimitToast(null), 4000);
        return false;
      }
      return true;
    });
    return () => setTabGuard(null);
  }, [checkLimit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n' && e.shiftKey) {
        e.preventDefault();
        setHostEditor({ open: true });
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm' && e.shiftKey) {
        e.preventDefault();
        useStore.getState().toggleSplitView();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        useStore.getState().toggleBroadcastMode();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Auto-close sidebar on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (!isMobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isMobile]);

  if (isPrivacyPage) return <Suspense fallback={<div className="flex h-screen items-center justify-center bg-ink-950"><div className="h-8 w-8 border-2 border-neon border-t-transparent rounded-full animate-spin" /></div>}><PrivacyPage /></Suspense>;
  if (isTermsPage) return <Suspense fallback={<div className="flex h-screen items-center justify-center bg-ink-950"><div className="h-8 w-8 border-2 border-neon border-t-transparent rounded-full animate-spin" /></div>}><TermsPage /></Suspense>;

  const isResetPage = window.location.pathname === '/reset-password';
  if (isResetPage) return <Suspense fallback={<div className="flex h-screen items-center justify-center bg-ink-950"><div className="h-8 w-8 border-2 border-neon border-t-transparent rounded-full animate-spin" /></div>}><ResetPasswordPage /></Suspense>;

  if (isMobile) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden bg-ink-950">
        {/* Mobile header */}
        <header className="flex h-12 items-center justify-between border-b border-white/[0.04] bg-ink-900 px-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06]"
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-slate-100">NovoSSH</span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06]"
            aria-label="Search"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </header>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative z-50 h-full w-[280px] animate-slide-in-left">
              <Sidebar
                view={view}
                onNewHost={() => { setHostEditor({ open: true }); setSidebarOpen(false); }}
                onNewForward={() => { setShowForwardWizard(true); setSidebarOpen(false); }}
                onNewSnippet={() => setSidebarOpen(false)}
                onNewKey={() => setSidebarOpen(false)}
                onEditHost={(h) => { setHostEditor({ open: true, initial: h }); setSidebarOpen(false); }}
                onConnectHost={(h) => { setConnectFor(h); setSidebarOpen(false); }}
                onOpenPalette={() => { setPaletteOpen(true); setSidebarOpen(false); }}
                onViewChange={handleViewChange}
              />
            </div>
          </div>
        )}

        {/* Mobile content */}
        <main className="flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-6 w-6 border-2 border-neon border-t-transparent rounded-full animate-spin" /></div>}>
            <Workspace />
          </Suspense>
        </main>

        {/* Mobile bottom nav */}
        <MobileNav
          currentView={view}
          onViewChange={handleViewChange}
          onNewHost={() => setHostEditor({ open: true })}
        />

        {/* Dialogs */}
        <Suspense fallback={null}>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onConnect={(h) => setConnectFor(h)}
            onNewHost={() => setHostEditor({ open: true })}
          />
        </Suspense>
        <Suspense fallback={null}>
          <HostFormDialog
            open={hostEditor.open}
            initial={hostEditor.initial}
            onClose={() => setHostEditor({ open: false })}
          />
        </Suspense>
        <Suspense fallback={null}>
          <ConnectDialog host={connectFor} onClose={() => setConnectFor(null)} />
        </Suspense>

        {showForwardWizard && hosts.length > 0 && (
          <Suspense fallback={null}>
            <PortForwardingWizard
              hostId={hosts[0].id}
              onClose={() => setShowForwardWizard(false)}
              onSuccess={() => setShowForwardWizard(false)}
            />
          </Suspense>
        )}

        {limitToast && (
          <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-500/30 bg-amber-900/90 px-4 py-3 text-sm text-amber-100 shadow-lg backdrop-blur">
            {limitToast}
            <button onClick={() => useStore.getState().setView('settings')} className="ml-2 underline hover:text-white">Upgrade</button>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-950">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <NavRail />
        <div className="flex flex-1 overflow-hidden">
          {SHARED_SIDEBAR_VIEWS.has(view) && (
            <Sidebar
              view={view}
              onNewHost={() => setHostEditor({ open: true })}
              onNewForward={() => setShowForwardWizard(true)}
              onNewSnippet={() => {}}
              onNewKey={() => {}}
              onEditHost={(h) => setHostEditor({ open: true, initial: h })}
              onConnectHost={(h) => setConnectFor(h)}
              onOpenPalette={() => setPaletteOpen(true)}
            />
          )}
          <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-6 w-6 border-2 border-neon border-t-transparent rounded-full animate-spin" /></div>}>
            <Workspace />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onConnect={(h) => setConnectFor(h)}
        onNewHost={() => setHostEditor({ open: true })}
      />
      <HostFormDialog
        open={hostEditor.open}
        initial={hostEditor.initial}
        onClose={() => setHostEditor({ open: false })}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ConnectDialog host={connectFor} onClose={() => setConnectFor(null)} />
      </Suspense>

      {showForwardWizard && hosts.length > 0 && (
        <Suspense fallback={null}>
          <PortForwardingWizard
            hostId={hosts[0].id}
            onClose={() => setShowForwardWizard(false)}
            onSuccess={() => setShowForwardWizard(false)}
          />
        </Suspense>
      )}

      {limitToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-500/30 bg-amber-900/90 px-4 py-3 text-sm text-amber-100 shadow-lg backdrop-blur">
          {limitToast}
          <button onClick={() => useStore.getState().setView('settings')} className="ml-2 underline hover:text-white">Upgrade</button>
        </div>
      )}
    </div>
  );
}
