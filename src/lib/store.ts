import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import {
  type Group,
  type Host,
  type Identity,
  type IdentityKey,
  type PortForward,
  type SessionLog,
  type Settings,
  type Snippet,
  type SnippetPackage,
  type TerminalTab,
  type ViewKey,
  type WorkspaceTemplate,
  defaultSettings,
} from './types';

export interface AuthState {
  accessToken: string | null;
  expiresIn: number;
  user: { userId: string; organizationId: string; email?: string } | null;
  tailscaleServerAddress: string | null;
  isAuthenticated: boolean;
  subscription: { plan: string; status: string } | null;
}

interface AppState {
  auth: AuthState;
  setAuth: (auth: AuthState) => void;
  clearAuth: () => void;

  isOwner: boolean;
  setOwnerStatus: (val: boolean) => void;

  view: ViewKey;
  setView: (v: ViewKey) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  settingsTab: string;
  setSettingsTab: (tab: string) => void;

  hosts: Host[];
  groups: Group[];
  keys: IdentityKey[];
  identities: Identity[];
  snippets: Snippet[];
  snippetPackages: SnippetPackage[];
  forwards: PortForward[];
  sessionLogs: SessionLog[];
  workspaceTemplates: WorkspaceTemplate[];
  settings: Settings;

  tabs: TerminalTab[];
  activeTabId: string | null;
  splitView: boolean;
  broadcastMode: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  addHost: (data: Omit<Host, 'id' | 'createdAt' | 'updatedAt' | 'tags'> & { tags?: string[] }) => Host;
  updateHost: (id: string, patch: Partial<Host>) => void;
  deleteHost: (id: string) => void;
  touchHost: (id: string) => void;

  addGroup: (name: string, parentId?: string, color?: string) => Group;
  updateGroup: (id: string, patch: Partial<Group>) => void;
  deleteGroup: (id: string) => void;

  addKey: (data: Omit<IdentityKey, 'id' | 'createdAt'>) => IdentityKey;
  deleteKey: (id: string) => void;

  addIdentity: (data: Omit<Identity, 'id' | 'createdAt'>) => Identity;
  updateIdentity: (id: string, patch: Partial<Identity>) => void;
  deleteIdentity: (id: string) => void;

  addSnippetPackage: (label: string) => SnippetPackage;
  deleteSnippetPackage: (id: string) => void;
  addSnippet: (data: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt' | 'tags'> & { tags?: string[]; packageId?: string }) => Snippet;
  updateSnippet: (id: string, patch: Partial<Snippet>) => void;
  deleteSnippet: (id: string) => void;

  addForward: (data: Omit<PortForward, 'id'>) => PortForward;
  updateForward: (id: string, patch: Partial<PortForward>) => void;
  deleteForward: (id: string) => void;

  addSessionLog: (data: Omit<SessionLog, 'id'>) => SessionLog;
  bookmarkLog: (id: string, comment?: string) => void;
  unbookmarkLog: (id: string) => void;

  saveWorkspaceTemplate: (name: string) => WorkspaceTemplate;
  deleteWorkspaceTemplate: (id: string) => void;

  updateSettings: (patch: Partial<Settings>) => void;

  openTab: (hostId?: string, vaultConnect?: import('./types').VaultConnectParams) => string;
  setTabStatus: (id: string, status: TerminalTab['status']) => void;
  setActiveTab: (id: string) => void;
  closeTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;

  setSplitView: (split: boolean) => void;
  setBroadcastMode: (on: boolean) => void;
  toggleSplitView: () => void;
  toggleBroadcastMode: () => void;
  openMultipleTabs: (hostIds: string[]) => void;
}

// Module-level tab guard — set by App.tsx to enforce plan limits.
// Returns true if the tab should be opened, false to block it.
let _tabGuard: ((hostId?: string) => boolean) | null = null;
export function setTabGuard(guard: ((hostId?: string) => boolean) | null) {
  _tabGuard = guard;
}

const now = () => Date.now();

const seedHosts: Host[] = [];

const seedSnippetPackages: SnippetPackage[] = [
  { id: 'pkg1', label: 'System', createdAt: now() },
  { id: 'pkg2', label: 'Docker', createdAt: now() },
  { id: 'pkg3', label: 'Nginx', createdAt: now() },
];

const seedSnippets: Snippet[] = [
  {
    id: 's1',
    label: 'System overview',
    command: 'uname -a && uptime && free -h && df -hT',
    description: 'OS, uptime, memory, and disk usage at a glance.',
    tags: ['system', 'diagnostics'],
    packageId: 'pkg1',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's2',
    label: 'Top memory processes',
    command: 'ps aux --sort=-rss | head -n 15',
    description: 'Top 15 processes by resident memory.',
    tags: ['system', 'perf'],
    packageId: 'pkg1',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's3',
    label: 'Listening ports',
    command: 'ss -tulpn',
    description: 'All listening TCP/UDP ports with process names.',
    tags: ['network', 'security'],
    packageId: 'pkg1',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's4',
    label: 'Tail system log',
    command: 'sudo journalctl -f --no-pager -n 100',
    description: 'Follow the systemd journal in real time.',
    tags: ['logs', 'debugging'],
    packageId: 'pkg1',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's5',
    label: 'Disk usage by dir',
    command: 'du -h --max-depth=1 / | sort -rh | head -20',
    description: 'Largest directories under root.',
    tags: ['system', 'disk'],
    packageId: 'pkg1',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's6',
    label: 'Docker ps',
    command: 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"',
    description: 'List running Docker containers with ports.',
    tags: ['docker', 'containers'],
    packageId: 'pkg2',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's7',
    label: 'Docker compose restart',
    command: 'docker compose down && docker compose up -d --build',
    description: 'Rebuild and restart all containers.',
    tags: ['docker', 'deploy'],
    packageId: 'pkg2',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's8',
    label: 'Tail nginx errors',
    command: 'sudo tail -f /var/log/nginx/error.log',
    description: 'Follow Nginx error log in real time.',
    tags: ['nginx', 'logs'],
    packageId: 'pkg3',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's9',
    label: 'Check SSL cert expiry',
    command: 'echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -dates',
    description: 'Show SSL certificate expiry date for localhost.',
    tags: ['ssl', 'security'],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's10',
    label: 'Find large files',
    command: 'find / -type f -size +100M -exec ls -lh {} \\; 2>/dev/null | sort -k5 -rh | head -20',
    description: 'Find files larger than 100MB anywhere on disk.',
    tags: ['system', 'disk'],
    packageId: 'pkg1',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's11',
    label: 'Network connections',
    command: 'ss -s && echo "---" && ss -tnp | head -30',
    description: 'Socket statistics and active TCP connections.',
    tags: ['network', 'diagnostics'],
    packageId: 'pkg1',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's12',
    label: 'Git status & log',
    command: 'git status && echo "---" && git log --oneline -10',
    description: 'Working tree status and last 10 commits.',
    tags: ['git', 'dev'],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's13',
    label: 'Systemd service status',
    command: 'systemctl status',
    description: 'Overview of all systemd services.',
    tags: ['system', 'services'],
    packageId: 'pkg1',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's14',
    label: 'Kill process by name',
    command: 'pkill -f',
    description: 'Kill a process by name (append the process name).',
    tags: ['system', 'process'],
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 's15',
    label: 'Nginx test & reload',
    command: 'sudo nginx -t && sudo systemctl reload nginx',
    description: 'Test Nginx config and reload without downtime.',
    tags: ['nginx', 'deploy'],
    packageId: 'pkg3',
    createdAt: now(),
    updatedAt: now(),
  },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      auth: {
        accessToken: null,
        expiresIn: 0,
        user: null,
        tailscaleServerAddress: null,
        isAuthenticated: false,
        subscription: null,
      },
      setAuth: (auth) => set({ auth }),
      clearAuth: () =>
        set({
          auth: {
            accessToken: null,
            expiresIn: 0,
            user: null,
            tailscaleServerAddress: null,
            isAuthenticated: false,
            subscription: null,
          },
          isOwner: false,
        }),

      isOwner: false,
      setOwnerStatus: (val) => set({ isOwner: val }),

      view: 'hosts',
      setView: (view) => set({ view }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      settingsTab: 'appearance',
      setSettingsTab: (tab) => set({ settingsTab: tab }),

      hosts: seedHosts,
      groups: [],
      keys: [],
      identities: [],
      snippets: seedSnippets,
      snippetPackages: seedSnippetPackages,
      forwards: [],
      sessionLogs: [],
      workspaceTemplates: [],
      settings: defaultSettings,

      tabs: [],
      activeTabId: null,
      splitView: false,
      broadcastMode: false,
      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      addHost: (data) => {
        const host: Host = {
          id: nanoid(10),
          createdAt: now(),
          updatedAt: now(),
          tags: data.tags ?? [],
          ...data,
        };
        set((s) => ({ hosts: [host, ...s.hosts] }));
        return host;
      },
      updateHost: (id, patch) =>
        set((s) => ({
          hosts: s.hosts.map((h) => (h.id === id ? { ...h, ...patch, updatedAt: now() } : h)),
        })),
      deleteHost: (id) => set((s) => ({ hosts: s.hosts.filter((h) => h.id !== id) })),
      touchHost: (id) =>
        set((s) => ({
          hosts: s.hosts.map((h) => (h.id === id ? { ...h, lastConnectedAt: now() } : h)),
        })),

      addGroup: (name, parentId, color) => {
        const g: Group = { id: nanoid(8), name, parentId, color, createdAt: now() };
        set((s) => ({ groups: [...s.groups, g] }));
        return g;
      },
      updateGroup: (id, patch) =>
        set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGroup: (id) => set((s) => ({ groups: s.groups.filter((g) => g.id !== id) })),

      addKey: (data) => {
        const k: IdentityKey = { id: nanoid(10), createdAt: now(), ...data };
        set((s) => ({ keys: [k, ...s.keys] }));
        return k;
      },
      deleteKey: (id) => set((s) => ({ keys: s.keys.filter((k) => k.id !== id) })),

      addIdentity: (data) => {
        const i: Identity = { id: nanoid(10), createdAt: now(), ...data };
        set((s) => ({ identities: [i, ...s.identities] }));
        return i;
      },
      updateIdentity: (id, patch) =>
        set((s) => ({ identities: s.identities.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      deleteIdentity: (id) => set((s) => ({ identities: s.identities.filter((i) => i.id !== id) })),

      addSnippetPackage: (label) => {
        const p: SnippetPackage = { id: nanoid(8), label, createdAt: now() };
        set((s) => ({ snippetPackages: [...s.snippetPackages, p] }));
        return p;
      },
      deleteSnippetPackage: (id) =>
        set((s) => ({
          snippetPackages: s.snippetPackages.filter((p) => p.id !== id),
          snippets: s.snippets.map((sn) => (sn.packageId === id ? { ...sn, packageId: undefined } : sn)),
        })),

      addSnippet: (data) => {
        const s: Snippet = {
          id: nanoid(10),
          createdAt: now(),
          updatedAt: now(),
          tags: data.tags ?? [],
          ...data,
        };
        set((st) => ({ snippets: [s, ...st.snippets] }));
        return s;
      },
      updateSnippet: (id, patch) =>
        set((s) => ({
          snippets: s.snippets.map((sn) => (sn.id === id ? { ...sn, ...patch, updatedAt: now() } : sn)),
        })),
      deleteSnippet: (id) => set((s) => ({ snippets: s.snippets.filter((sn) => sn.id !== id) })),

      addForward: (data) => {
        const f: PortForward = { id: nanoid(8), ...data };
        set((s) => ({ forwards: [f, ...s.forwards] }));
        return f;
      },
      updateForward: (id, patch) =>
        set((s) => ({ forwards: s.forwards.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      deleteForward: (id) => set((s) => ({ forwards: s.forwards.filter((f) => f.id !== id) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addSessionLog: (data) => {
        const log: SessionLog = { id: nanoid(10), ...data };
        set((s) => ({ sessionLogs: [log, ...s.sessionLogs] }));
        return log;
      },
      bookmarkLog: (id, comment) =>
        set((s) => ({
          sessionLogs: s.sessionLogs.map((l) =>
            l.id === id ? { ...l, bookmarked: true, bookmarkComment: comment ?? l.bookmarkComment } : l
          ),
        })),
      unbookmarkLog: (id) =>
        set((s) => ({
          sessionLogs: s.sessionLogs.map((l) =>
            l.id === id ? { ...l, bookmarked: false, bookmarkComment: undefined } : l
          ),
        })),

      saveWorkspaceTemplate: (name) => {
        const state = get();
        const template: WorkspaceTemplate = {
          id: nanoid(8),
          name,
          tabNames: state.tabs.map((t) => t.title),
          hostIds: state.tabs.map((t) => t.hostId ?? ''),
          splitView: state.splitView,
          createdAt: now(),
        };
        set((s) => ({ workspaceTemplates: [...s.workspaceTemplates, template] }));
        return template;
      },
      deleteWorkspaceTemplate: (id) =>
        set((s) => ({ workspaceTemplates: s.workspaceTemplates.filter((t) => t.id !== id) })),

      openTab: (hostId, vaultConnect) => {
        if (_tabGuard && !_tabGuard(hostId)) return '';
        const id = nanoid(8);
        set((s) => {
          const host = hostId ? s.hosts.find((h) => h.id === hostId) : undefined;
          const title = vaultConnect ? `${vaultConnect.username}@${vaultConnect.host}` : (host ? host.label : 'Local');
          const tab: TerminalTab = { id, hostId, vaultConnect, title, status: 'idle', createdAt: now() };
          return { tabs: [...s.tabs, tab], activeTabId: id };
        });
        return id;
      },
      setTabStatus: (id, status) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, status } : t)) })),
      setActiveTab: (id) => set({ activeTabId: id }),
      closeTab: (id) =>
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== id);
          const activeTabId =
            s.activeTabId === id ? tabs[tabs.length - 1]?.id ?? null : s.activeTabId;
          return { tabs, activeTabId };
        }),
      renameTab: (id, title) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)) })),

      setSplitView: (splitView) => set({ splitView }),
      setBroadcastMode: (broadcastMode) => set({ broadcastMode }),
      toggleSplitView: () => set((s) => ({ splitView: !s.splitView })),
      toggleBroadcastMode: () => set((s) => ({ broadcastMode: !s.broadcastMode })),
      openMultipleTabs: (hostIds) => {
        const state = get();
        const newTabs: TerminalTab[] = [];
        const newIds: string[] = [];
        for (const hostId of hostIds) {
          if (_tabGuard && !_tabGuard(hostId)) continue;
          const id = nanoid(8);
          const host = state.hosts.find((h) => h.id === hostId);
          newTabs.push({ id, hostId, title: host?.label ?? 'Local', status: 'idle', createdAt: now() });
          newIds.push(id);
        }
        if (newTabs.length > 0) {
          set((s) => ({
            tabs: [...s.tabs, ...newTabs],
            activeTabId: newIds[newIds.length - 1],
          }));
        }
      },
    }),
    {
      name: 'novossh-state-v1',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          return {
            ...persistedState,
            hosts: persistedState.hosts ?? [],
            groups: persistedState.groups ?? [],
            keys: persistedState.keys ?? [],
            identities: persistedState.identities ?? [],
            snippets: persistedState.snippets ?? [],
            snippetPackages: persistedState.snippetPackages ?? [],
            forwards: persistedState.forwards ?? [],
            sessionLogs: persistedState.sessionLogs ?? [],
            workspaceTemplates: persistedState.workspaceTemplates ?? [],
            settings: persistedState.settings ?? defaultSettings,
          };
        }
        return persistedState;
      },
      partialize: (s) => ({
        hosts: s.hosts,
        groups: s.groups,
        keys: s.keys,
        identities: s.identities,
        snippets: s.snippets,
        snippetPackages: s.snippetPackages,
        forwards: s.forwards,
        sessionLogs: s.sessionLogs,
        workspaceTemplates: s.workspaceTemplates,
        settings: s.settings,
        view: s.view,
        // auth is NOT persisted (managed separately)
      }),
    },
  ),
);
