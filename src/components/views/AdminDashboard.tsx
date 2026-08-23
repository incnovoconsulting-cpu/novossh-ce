import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Users, Database, ToggleLeft, Tag, Heart, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';

type Tab = 'overview' | 'users' | 'database' | 'features' | 'releases' | 'security';

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <Heart className="h-4 w-4" /> },
  { key: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { key: 'database', label: 'Database', icon: <Database className="h-4 w-4" /> },
  { key: 'features', label: 'Feature Flags', icon: <ToggleLeft className="h-4 w-4" /> },
  { key: 'releases', label: 'Releases', icon: <Tag className="h-4 w-4" /> },
  { key: 'security', label: 'Security', icon: <Shield className="h-4 w-4" /> },
];

function StatCard({ label, value, color = 'text-[#00e5ff]' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-850/50 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Toggle({ enabled, onToggle, disabled }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        enabled ? 'bg-[#00e5ff]' : 'bg-white/10'
      } ${disabled ? 'opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    adminApi.stats().then(r => r.json()).then(setStats).catch(() => {});
    adminApi.health().then(r => r.json()).then(setHealth).catch(() => {});
    adminApi.users({ limit: '5' }).then(r => r.json()).then(d => setRecentUsers(d.users || [])).catch(() => {});
  }, []);

  if (!stats) return <div className="py-8 text-center text-sm text-slate-500">Loading...</div>;

  const maxPlan = Math.max(stats.plans.free || 1, stats.plans.starter || 1, stats.plans.pro || 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Active Subscriptions" value={stats.activeSubscriptions} color="text-[#22c55e]" />
        <StatCard label="Trial Users" value={stats.trialUsers} color="text-yellow-400" />
        <StatCard
          label="Health"
          value={health?.status || 'unknown'}
          color={health?.status === 'healthy' ? 'text-[#22c55e]' : health?.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'}
        />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-ink-850/50 p-4">
        <div className="mb-3 text-[13px] font-semibold text-white">Plan Distribution</div>
        {Object.entries(stats.plans).map(([plan, count]) => (
          <div key={plan} className="mb-2 flex items-center gap-3">
            <span className="w-16 text-[12px] capitalize text-slate-400">{plan}</span>
            <div className="h-4 flex-1 rounded bg-white/5">
              <div
                className={`h-full rounded ${
                  plan === 'pro' ? 'bg-[#00e5ff]' : plan === 'starter' ? 'bg-blue-500' : 'bg-slate-600'
                }`}
                style={{ width: `${((count as number) / maxPlan) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-[12px] font-mono text-slate-400">{count as number}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-ink-850/50 p-4">
        <div className="mb-3 text-[13px] font-semibold text-white">Recent Signups</div>
        {recentUsers.length === 0 ? (
          <div className="text-[12px] text-slate-500">No users yet</div>
        ) : (
          <div className="space-y-2">
            {recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2">
                <span className="text-[13px] text-slate-300">{u.email}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  u.plan === 'pro' ? 'bg-[#00e5ff]/10 text-[#00e5ff]' :
                  u.plan === 'starter' ? 'bg-blue-500/10 text-blue-400' :
                  'bg-white/5 text-slate-500'
                }`}>{u.plan}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);

  const loadUsers = useCallback(async (p: number, s: string) => {
    const params: Record<string, string> = { page: String(p), limit: '20' };
    if (s) params.search = s;
    const res = await adminApi.users(params);
    const data = await res.json();
    setUsers(data.users || []);
    setTotal(data.total || 0);
  }, []);

  useEffect(() => { loadUsers(page, search); }, [page, search]);

  const expandUser = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setUserDetail(null); return; }
    setExpandedId(id);
    const res = await adminApi.user(id);
    const data = await res.json();
    setUserDetail(data);
  };

  const changePlan = async (userId: string, plan: string) => {
    await adminApi.setUserPlan(userId, plan);
    loadUsers(page, search);
    if (expandedId === userId) expandUser(userId);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email..."
            className="w-full rounded-lg border border-white/[0.06] bg-white/5 py-2 pl-9 pr-3 text-[13px] text-slate-300 placeholder-slate-600 outline-none focus:border-[#00e5ff]/30"
          />
        </div>
        <span className="text-[12px] text-slate-500">{total} users</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Email</th>
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Plan</th>
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Created</th>
              <th className="px-4 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <React.Fragment key={u.id}>
                <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer" onClick={() => expandUser(u.id)}>
                  <td className="px-4 py-2.5 text-slate-300">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      u.plan === 'pro' ? 'bg-[#00e5ff]/10 text-[#00e5ff]' :
                      u.plan === 'starter' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-white/5 text-slate-500'
                    }`}>{u.plan}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-400">{u.status}</td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5">
                    {expandedId === u.id ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                  </td>
                </tr>
                {expandedId === u.id && userDetail && (
                  <tr>
                    <td colSpan={5} className="border-b border-white/[0.04] bg-white/[0.01] px-6 py-4">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                          <div className="text-[10px] uppercase text-slate-600">Email Verified</div>
                          <div className="text-[13px] text-slate-300">{userDetail.email_verified ? 'Yes' : 'No'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-600">Period End</div>
                          <div className="text-[13px] text-slate-300">
                            {userDetail.current_period_end
                              ? new Date(userDetail.current_period_end).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[12px] text-slate-500">Set plan:</span>
                        {['free', 'starter', 'pro'].map(p => (
                          <button
                            key={p}
                            onClick={(e) => { e.stopPropagation(); changePlan(u.id, p); }}
                            className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${
                              u.plan === p
                                ? 'bg-[#00e5ff]/20 text-[#00e5ff]'
                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-[12px] text-slate-400 hover:bg-white/10 disabled:opacity-30"
          >Prev</button>
          <span className="text-[12px] text-slate-500">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-[12px] text-slate-400 hover:bg-white/10 disabled:opacity-30"
          >Next</button>
        </div>
      )}
    </div>
  );
}

function DatabaseTab() {
  const [tables, setTables] = useState<any[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);

  useEffect(() => {
    adminApi.dbTables().then(r => r.json()).then(d => setTables(d.tables || [])).catch(() => {});
  }, []);

  const expandTable = async (name: string) => {
    if (expandedTable === name) { setExpandedTable(null); setTableData(null); return; }
    setExpandedTable(name);
    const res = await adminApi.dbTable(name);
    const data = await res.json();
    setTableData(data);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Table</th>
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500 text-right">Rows</th>
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">Last Vacuum</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t: any) => (
              <React.Fragment key={t.tablename}>
                <tr
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer"
                  onClick={() => expandTable(t.tablename)}
                >
                  <td className="px-4 py-2.5 font-mono text-[12px] text-[#00e5ff]">{t.tablename}</td>
                  <td className="px-4 py-2.5 text-right text-[12px] text-slate-400">{t.row_count?.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-500">
                    {t.last_vacuum ? new Date(t.last_vacuum).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
                {expandedTable === t.tablename && tableData && (
                  <tr>
                    <td colSpan={3} className="border-b border-white/[0.04] bg-white/[0.01] p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr>
                              {(tableData.columns || []).map((col: any) => (
                                <th key={col.column_name} className="whitespace-nowrap px-2 py-1 text-left font-medium text-slate-500">
                                  {col.column_name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(tableData.rows || []).slice(0, 50).map((row: any, i: number) => (
                              <tr key={i} className="border-t border-white/[0.03]">
                                {Object.values(row).map((val: any, j: number) => (
                                  <td key={j} className="max-w-[200px] truncate whitespace-nowrap px-2 py-1 text-slate-400">
                                    {val === null ? <span className="text-slate-600">null</span> : String(val).substring(0, 80)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-600">
                        Showing {Math.min(50, tableData.rows?.length || 0)} of {tableData.total} rows
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeaturesTab() {
  const [flags, setFlags] = useState<any[]>([]);

  useEffect(() => {
    adminApi.features().then(r => r.json()).then(d => setFlags(d.flags || [])).catch(() => {});
  }, []);

  const toggle = async (key: string, current: boolean) => {
    await adminApi.toggleFeature(key, !current);
    setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !current } : f));
  };

  return (
    <div className="space-y-3">
      {flags.map(f => (
        <div key={f.key} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-ink-850/50 px-4 py-3">
          <div className="flex-1">
            <div className="font-mono text-[13px] text-white">{f.key}</div>
            <div className="text-[12px] text-slate-500">{f.description}</div>
            {f.updated_at && (
              <div className="mt-1 text-[10px] text-slate-600">
                Updated {new Date(f.updated_at).toLocaleString()} by {f.updated_by || 'unknown'}
              </div>
            )}
          </div>
          <Toggle enabled={f.enabled} onToggle={() => toggle(f.key, f.enabled)} />
        </div>
      ))}
    </div>
  );
}

function ReleasesTab() {
  const [releases, setReleases] = useState<any[]>([]);

  useEffect(() => {
    adminApi.releases().then(r => r.json()).then(d => setReleases(d.releases || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      {releases.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-ink-850/50 p-8 text-center text-[13px] text-slate-500">
          No releases found
        </div>
      ) : (
        releases.map(r => (
          <div key={r.tag} className="rounded-xl border border-white/[0.06] bg-ink-850/50 p-4">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#00e5ff]/10 px-2 py-0.5 text-[11px] font-mono text-[#00e5ff]">{r.tag}</span>
              {r.prerelease && <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-400">Pre-release</span>}
              <span className="text-[11px] text-slate-500">{new Date(r.published).toLocaleDateString()}</span>
            </div>
            <div className="mt-1 text-[14px] font-medium text-white">{r.name}</div>
            {r.body && <div className="mt-1 text-[12px] text-slate-400 whitespace-pre-line">{r.body}</div>}
            <a href={r.url} target="_blank" rel="noopener" className="mt-2 inline-block text-[11px] text-[#00e5ff] hover:underline">View on GitHub →</a>
          </div>
        ))
      )}
    </div>
  );
}

function SecurityTab() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    adminApi.security().then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="py-8 text-center text-sm text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Users" value={data.totalUsers} />
        <StatCard label="Verified Users" value={data.verifiedUsers} color="text-[#22c55e]" />
        <StatCard label="Auth Failures (24h)" value={data.authFailures24h} color={data.authFailures24h > 10 ? 'text-red-400' : 'text-slate-300'} />
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-ink-850/50 p-4">
        <div className="mb-3 text-[13px] font-semibold text-white">Recent Security Events</div>
        {(data.recentEvents || []).length === 0 ? (
          <div className="text-[12px] text-slate-500">No recent events</div>
        ) : (
          <div className="space-y-1">
            {data.recentEvents.map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2">
                <span className={`h-1.5 w-1.5 rounded-full ${e.event_type === 'auth_failure' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                <span className="text-[11px] font-mono text-slate-400">{e.event_type}</span>
                <span className="text-[11px] text-slate-500">{e.ip_address || 'N/A'}</span>
                <span className="ml-auto text-[10px] text-slate-600">{new Date(e.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />;
      case 'users': return <UsersTab />;
      case 'database': return <DatabaseTab />;
      case 'features': return <FeaturesTab />;
      case 'releases': return <ReleasesTab />;
      case 'security': return <SecurityTab />;
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <Shield className="h-5 w-5 text-[#00e5ff]" />
          <h1 className="text-[18px] font-bold text-white">Admin Dashboard</h1>
        </div>
        <p className="text-[13px] text-slate-500">Owner-only management panel</p>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-white/[0.06]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[12px] font-medium transition-colors ${
              activeTab === t.key
                ? 'border-[#00e5ff] text-[#00e5ff]'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
}
