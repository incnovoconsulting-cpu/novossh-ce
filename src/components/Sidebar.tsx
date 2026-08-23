import { Plus, Search, Command, PanelLeftClose, PanelLeftOpen, ChevronRight, ChevronDown, FolderOpen, PlayCircle } from '@/lib/icons';
import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useStore } from '../lib/store';
import { useSubscription } from '../hooks/useSubscription';
import type { Host, ViewKey } from '../lib/types';
import { HostListItem } from './HostListItem';
import { SnippetListItem } from './SnippetListItem';
import { KeyListItem } from './KeyListItem';
import { ForwardListItem } from './ForwardListItem';

interface Props {
  view: ViewKey;
  onNewHost: () => void;
  onNewForward?: () => void;
  onNewSnippet?: () => void;
  onNewKey?: () => void;
  onEditHost: (h: Host) => void;
  onConnectHost: (h: Host) => void;
  onOpenPalette: () => void;
  onViewChange?: (v: ViewKey) => void;
}

const VIEW_TITLES: Record<ViewKey, string> = {
  hosts: 'Hosts',
  snippets: 'Snippets',
  keys: 'Keychain',
  portforwarding: 'Port Forwarding',
  sftp: 'SFTP Browser',
  history: 'History',
  settings: 'Settings',
  analytics: 'Analytics',
  logs: 'Logs',
  portal: 'Portal',
  notifications: 'Notifications',
  organizations: 'Organizations',
  p2p: 'P2P Sync',
  security: 'Security',
  sessions: 'Sessions',
  vault: 'Vault',
  wiki: 'Documentation',
  admin: 'Admin Dashboard',
};

export function Sidebar({ view, onNewHost, onNewForward, onNewSnippet, onNewKey, onEditHost, onConnectHost, onOpenPalette, onViewChange }: Props) {
  const hosts = useStore((s) => s.hosts);
  const groups = useStore((s) => s.groups);
  const snippets = useStore((s) => s.snippets);
  const snippetPackages = useStore((s) => s.snippetPackages);
  const keys = useStore((s) => s.keys);
  const identities = useStore((s) => s.identities);
  const forwards = useStore((s) => s.forwards);
  const query = useStore((s) => s.searchQuery);
  const setQuery = useStore((s) => s.setSearchQuery);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const addGroup = useStore((s) => s.addGroup);
  const openMultipleTabs = useStore((s) => s.openMultipleTabs);
  const { checkLimit } = useSubscription();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);

  const filteredHosts = useMemo(() => {
    if (!query) return hosts;
    const q = query.toLowerCase();
    return hosts.filter(
      (h) =>
        h.label.toLowerCase().includes(q) ||
        h.address.toLowerCase().includes(q) ||
        h.username.toLowerCase().includes(q) ||
        h.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [hosts, query]);

  const recent = useMemo(() => {
    return [...hosts]
      .filter((h) => h.lastConnectedAt)
      .sort((a, b) => (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0))
      .slice(0, 8);
  }, [hosts]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    addGroup(newGroupName.trim());
    setNewGroupName('');
    setShowNewGroup(false);
  };

  const quickConnectGroup = (groupId: string) => {
    const groupHostIds = hosts.filter((h) => h.groupId === groupId).map((h) => h.id);
    if (groupHostIds.length > 0) openMultipleTabs(groupHostIds);
  };

  const rootGroups = groups.filter((g) => !g.parentId);

  const showSearch = view !== 'settings' && view !== 'history' && view !== 'security' && view !== 'notifications' && view !== 'organizations';
  const showAdd = view === 'hosts' || view === 'snippets' || view === 'keys' || view === 'portforwarding';
  const canAddHost = view === 'hosts' ? checkLimit('hosts').allowed : true;

  return (
    <aside className="relative flex h-full">
      {collapsed && (
        <button
          onClick={toggleSidebar}
          className="absolute left-0 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-r-md bg-ink-800 border border-l-0 border-white/[0.06] text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 transition-colors"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
      )}

      <aside
        className={clsx(
          'flex h-full flex-col border-r border-white/[0.04] bg-ink-900 transition-all duration-200 ease-in-out',
          collapsed ? 'w-0 overflow-hidden' : 'w-full md:w-[260px]'
        )}
      >
      <div className="flex h-11 items-center justify-between border-b border-white/[0.04] px-3">
        <h1 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{VIEW_TITLES[view]}</h1>
        <div className="flex items-center gap-0.5">
          {showAdd && (
            <button
              onClick={view === 'portforwarding' ? onNewForward : view === 'snippets' ? onNewSnippet : view === 'keys' ? onNewKey : onNewHost}
              disabled={view !== 'portforwarding' && !canAddHost}
              className={clsx('btn-ghost p-1.5 rounded-md', view !== 'portforwarding' && !canAddHost && 'opacity-40 cursor-not-allowed')}
              aria-label="Add"
              title={view !== 'portforwarding' && !canAddHost ? 'Host limit reached' : 'Add'}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={toggleSidebar} className="btn-ghost p-1.5 rounded-md" aria-label="Toggle sidebar">
            {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="border-b border-white/[0.04] p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${view}...`}
              className="input pl-8 pr-12 py-1.5 text-xs"
            />
            <button
              onClick={onOpenPalette}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-white/[0.08] hover:text-slate-400 transition-colors"
              title="Command palette"
            >
              <Command className="h-2.5 w-2.5" /> K
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
      {onViewChange && (
          <div className="md:hidden border-b border-white/[0.04] px-2 py-2 space-y-0.5">
            {(['hosts', 'snippets', 'keys', 'history'] as ViewKey[]).map((key) => (
              <button
                key={key}
                onClick={() => onViewChange(key)}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
                  view === key ? 'bg-white/[0.04] text-neon' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
                )}
              >
                {key === 'hosts' && 'Hosts'}
                {key === 'snippets' && 'Snippets'}
                {key === 'keys' && 'Keychain'}
                {key === 'history' && 'History'}
              </button>
            ))}
          </div>
        )}

        {view === 'hosts' && (
          <>
            {recent.length > 0 && !query && (
              <div className="px-2 pt-2">
                <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500/60">
                  Recent
                </div>
                <div className="space-y-px">
                  {recent.map((h) => (
                    <HostListItem
                      key={`r-${h.id}`}
                      host={h}
                      onConnect={() => onConnectHost(h)}
                      onEdit={() => onEditHost(h)}
                    />
                  ))}
                </div>
              </div>
            )}

            {rootGroups.length > 0 && !query && (
              <div className="px-2 pt-2">
                <div className="mb-1 flex items-center justify-between px-2">
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500/60">Groups</div>
                  <button
                    onClick={() => setShowNewGroup(!showNewGroup)}
                    className="rounded p-0.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300"
                    title="New group"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                {showNewGroup && (
                  <div className="mb-1 flex gap-1 px-1">
                    <input
                      autoFocus
                      className="input flex-1 text-xs py-1"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                      placeholder="Group name"
                    />
                    <button onClick={handleCreateGroup} className="btn-primary text-[10px] px-2">Add</button>
                  </div>
                )}
                <div className="space-y-px">
                  {rootGroups.map((g) => (
                    <GroupItem
                      key={g.id}
                      group={g}
                      hosts={hosts}
                      groups={groups}
                      expandedGroups={expandedGroups}
                      toggleGroup={toggleGroup}
                      quickConnectGroup={quickConnectGroup}
                      onConnectHost={onConnectHost}
                      onEditHost={onEditHost}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="px-2 pt-2 pb-4">
              <div className="mb-1 px-2 flex items-center justify-between">
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500/60">
                  All ({filteredHosts.length})
                </div>
              </div>
              <div className="space-y-px">
                {filteredHosts.map((h) => (
                  <HostListItem
                    key={h.id}
                    host={h}
                    onConnect={() => onConnectHost(h)}
                    onEdit={() => onEditHost(h)}
                  />
                ))}
                {filteredHosts.length === 0 && <EmptyHint label="hosts" onAdd={onNewHost} />}
              </div>
            </div>
          </>
        )}

        {view === 'snippets' && (
          <div className="space-y-px px-2 py-2">
            {snippetPackages.map((pkg) => {
              const pkgSnippets = snippets.filter((s) => s.packageId === pkg.id);
              return (
                <div key={pkg.id} className="mb-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500/60">
                    <FolderOpen className="h-3 w-3" />
                    {pkg.label}
                  </div>
                  {pkgSnippets
                    .filter((s) => !query || s.label.toLowerCase().includes(query.toLowerCase()) || s.command.toLowerCase().includes(query.toLowerCase()))
                    .map((s) => (
                      <SnippetListItem key={s.id} snippet={s} />
                    ))}
                </div>
              );
            })}
            {snippets
              .filter((s) => !s.packageId)
              .filter((s) => !query || s.label.toLowerCase().includes(query.toLowerCase()) || s.command.toLowerCase().includes(query.toLowerCase()))
              .map((s) => (
                <SnippetListItem key={s.id} snippet={s} />
              ))}
            {snippets.length === 0 && <EmptyHint label="snippets" onAdd={onNewSnippet ?? onNewHost} />}
          </div>
        )}

        {view === 'keys' && (
          <div className="space-y-px px-2 py-2">
            {identities.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500/60">Identities</div>
                {identities.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-200">
                    <span className="truncate">{i.label}</span>
                    <span className="text-[10px] text-slate-500">({i.username})</span>
                  </div>
                ))}
              </>
            )}
            {keys.map((k) => (
              <KeyListItem key={k.id} k={k} />
            ))}
            {keys.length === 0 && identities.length === 0 && <EmptyHint label="SSH keys" onAdd={onNewKey ?? onNewHost} />}
          </div>
        )}

        {view === 'portforwarding' && (
          <div className="space-y-px px-2 py-2">
            {forwards.map((f) => (
              <ForwardListItem key={f.id} forward={f} />
            ))}
            {forwards.length === 0 && <EmptyHint label="port forwards" onAdd={onNewForward ?? onNewHost} />}
          </div>
        )}

        {view === 'history' && (
          <div className="px-2 py-2">
            <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500/60">
              Recent sessions
            </div>
            <div className="space-y-px">
              {recent.map((h) => (
                <HostListItem
                  key={h.id}
                  host={h}
                  onConnect={() => onConnectHost(h)}
                  onEdit={() => onEditHost(h)}
                />
              ))}
              {recent.length === 0 && (
                <p className="px-2 text-[11px] text-slate-500/60">No previous sessions.</p>
              )}
            </div>
          </div>
        )}

        {view === 'settings' && <SettingsNavItems />}

      </div>
    </aside>
    </aside>
  );
}

function GroupItem({ group, hosts, groups, expandedGroups, toggleGroup, quickConnectGroup, onConnectHost, onEditHost }: {
  group: { id: string; name: string; parentId?: string; color?: string };
  hosts: Host[];
  groups: { id: string; name: string; parentId?: string }[];
  expandedGroups: Set<string>;
  toggleGroup: (id: string) => void;
  quickConnectGroup: (id: string) => void;
  onConnectHost: (h: Host) => void;
  onEditHost: (h: Host) => void;
}) {
  const isExpanded = expandedGroups.has(group.id);
  const groupHosts = hosts.filter((h) => h.groupId === group.id);
  const children = groups.filter((g) => g.parentId === group.id);

  return (
    <div>
      <div className="group flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/[0.03]">
        <button
          onClick={() => toggleGroup(group.id)}
          className="flex items-center gap-1 flex-1 text-left"
        >
          {isExpanded ? <ChevronDown className="h-3 w-3 text-slate-500" /> : <ChevronRight className="h-3 w-3 text-slate-500" />}
          <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-sm text-slate-200">{group.name}</span>
          <span className="text-[10px] text-slate-500">({groupHosts.length})</span>
        </button>
        <button
          onClick={() => quickConnectGroup(group.id)}
          className="rounded p-0.5 text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-neon/10 hover:text-neon transition-all"
          title="Quick Connect all"
        >
          <PlayCircle className="h-3 w-3" />
        </button>
      </div>
      {isExpanded && (
        <div className="ml-4">
          {groupHosts.map((h) => (
            <HostListItem
              key={h.id}
              host={h}
              onConnect={() => onConnectHost(h)}
              onEdit={() => onEditHost(h)}
            />
          ))}
          {children.map((child) => (
            <GroupItem
              key={child.id}
              group={child}
              hosts={hosts}
              groups={groups}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              quickConnectGroup={quickConnectGroup}
              onConnectHost={onConnectHost}
              onEditHost={onEditHost}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsNavItems() {
  const settingsTab = useStore((s) => s.settingsTab);
  const setSettingsTab = useStore((s) => s.setSettingsTab);

  return (
    <div className="px-2 py-2 space-y-px">
      {(['appearance', 'terminal', 'network', 'subscription', 'about'] as const).map((key) => {
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        return (
          <button
            key={key}
            onClick={() => setSettingsTab(key)}
            className={clsx(
              'flex w-full items-center rounded-md px-2 py-1.5 text-xs transition-colors',
              settingsTab === key ? 'bg-white/[0.04] text-slate-200' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyHint({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-white/[0.06] p-4 text-center">
      <p className="text-[11px] text-slate-500/60">No {label} yet.</p>
      <button onClick={onAdd} className="btn-ghost mt-2 mx-auto text-xs">
        <Plus className="h-3 w-3" /> Add
      </button>
    </div>
  );
}
