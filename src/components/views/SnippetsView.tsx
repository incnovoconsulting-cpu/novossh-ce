import { useState, useEffect, useMemo } from 'react';
import { Plus, Code2, Trash2, Copy, Play, FolderPlus, ChevronDown, ChevronRight } from '@/lib/icons';
import { useStore } from '../../lib/store';

export function SnippetsView() {
  const snippets = useStore((s) => s.snippets);
  const snippetPackages = useStore((s) => s.snippetPackages);
  const addSnippet = useStore((s) => s.addSnippet);
  const deleteSnippet = useStore((s) => s.deleteSnippet);
  const addSnippetPackage = useStore((s) => s.addSnippetPackage);
  const deleteSnippetPackage = useStore((s) => s.deleteSnippetPackage);
  const hosts = useStore((s) => s.hosts);
  const openMultipleTabs = useStore((s) => s.openMultipleTabs);

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [packageId, setPackageId] = useState<string | undefined>(undefined);
  const [newPackageName, setNewPackageName] = useState('');
  const [showNewPackage, setShowNewPackage] = useState(false);
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());

  const submit = () => {
    if (!label || !command) return;
    addSnippet({
      label,
      command,
      description,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      packageId,
    });
    setLabel('');
    setCommand('');
    setDescription('');
    setTags('');
    setPackageId(undefined);
  };

  const handleCreatePackage = () => {
    if (!newPackageName.trim()) return;
    addSnippetPackage(newPackageName.trim());
    setNewPackageName('');
    setShowNewPackage(false);
  };

  const togglePackage = (id: string) => {
    setExpandedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupedSnippets = useMemo(() => {
    const grouped = new Map<string, typeof snippets>();
    const unpackaged: typeof snippets = [];
    for (const s of snippets) {
      if (s.packageId) {
        const arr = grouped.get(s.packageId) ?? [];
        arr.push(s);
        grouped.set(s.packageId, arr);
      } else {
        unpackaged.push(s);
      }
    }
    return { grouped, unpackaged };
  }, [snippets]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
            <Code2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Snippets</h1>
            <p className="text-sm text-slate-400">Reusable command templates. Paste into any session, or run on multiple hosts.</p>
          </div>
        </div>
        <button onClick={() => setShowForm((f) => !f)} className="btn-secondary text-xs">
          <Plus className="h-3.5 w-3.5" /> {showForm ? 'Cancel' : 'New snippet'}
        </button>
      </div>

      {showForm && <section className="mt-8 rounded-lg border border-white/[0.04] bg-ink-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">New snippet</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Label</label>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Restart nginx" />
          </div>
          <div className="col-span-2">
            <label className="label">Command</label>
            <textarea
              className="input font-mono min-h-[64px]"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="sudo systemctl restart nginx"
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="label">Tags</label>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="nginx, ops" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <div className="col-span-2">
            <label className="label">Package</label>
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={packageId ?? ''}
                onChange={(e) => setPackageId(e.target.value || undefined)}
              >
                <option value="">No package</option>
                {snippetPackages.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <button
                onClick={() => setShowNewPackage(!showNewPackage)}
                className="btn-secondary text-xs"
                title="New package"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>
            {showNewPackage && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  className="input flex-1 text-xs"
                  value={newPackageName}
                  onChange={(e) => setNewPackageName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreatePackage()}
                  placeholder="Package name"
                />
                <button onClick={handleCreatePackage} className="btn-primary text-xs">Create</button>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={submit} className="btn-primary" disabled={!label || !command}>
            <Plus className="h-4 w-4" /> Save snippet
          </button>
        </div>
      </section>}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">All snippets ({snippets.length})</h2>
        <div className="space-y-2">
          {loading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-ink-800/60 border border-white/[0.04] p-3 animate-pulse">
              <div className="h-4 bg-ink-700 rounded w-1/4 mb-3" />
              <div className="h-3 bg-ink-700 rounded w-2/3 mb-2" />
              <div className="h-3 bg-ink-700 rounded w-1/3" />
            </div>
          ))}

          {!loading && snippets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Code2 className="h-12 w-12 text-slate-600 mb-4" />
              <h2 className="text-lg text-slate-400 font-medium mb-1">No snippets yet</h2>
              <p className="text-sm text-slate-500">Save a command template to reuse it across sessions</p>
            </div>
          )}

          {!loading && snippetPackages.map((pkg) => {
            const pkgSnippets = groupedSnippets.grouped.get(pkg.id) ?? [];
            const isExpanded = expandedPackages.has(pkg.id);
            return (
              <div key={pkg.id} className="rounded-lg border border-white/[0.04] bg-ink-800/40">
                <button
                  onClick={() => togglePackage(pkg.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.02]"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
                  <FolderPlus className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-sm font-medium text-slate-200">{pkg.label}</span>
                  <span className="text-xs text-slate-500">({pkgSnippets.length})</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSnippetPackage(pkg.id); }}
                    className="ml-auto rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                    title="Delete package"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
                {isExpanded && (
                  <div className="border-t border-white/[0.04] px-3 py-1">
                    {pkgSnippets.map((s) => (
                      <SnippetRow key={s.id} snippet={s} onDelete={deleteSnippet} hosts={hosts} onRunOnHosts={openMultipleTabs} />
                    ))}
                    {pkgSnippets.length === 0 && (
                      <p className="py-2 text-xs text-slate-500/60">No snippets in this package.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!loading && groupedSnippets.unpackaged.map((s) => (
            <SnippetRow key={s.id} snippet={s} onDelete={deleteSnippet} hosts={hosts} onRunOnHosts={openMultipleTabs} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SnippetRow({ snippet, onDelete, hosts, onRunOnHosts }: {
  snippet: { id: string; label: string; command: string; description?: string; tags: string[] };
  onDelete: (id: string) => void;
  hosts: { id: string; label: string; address: string }[];
  onRunOnHosts: (hostIds: string[]) => void;
}) {
  const [showRunMenu, setShowRunMenu] = useState(false);
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([]);

  return (
    <div className="rounded-lg border border-white/[0.04] bg-ink-800 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-100">{snippet.label}</span>
            {snippet.tags.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
          <pre className="mt-2 overflow-x-auto rounded bg-ink-900 px-3 py-2 font-mono text-xs text-slate-300">
            {snippet.command}
          </pre>
          {snippet.description && <p className="mt-1 text-sm text-slate-500">{snippet.description}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => navigator.clipboard?.writeText(snippet.command)}
            className="rounded p-1 text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            title="Copy"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowRunMenu(!showRunMenu)}
            className="rounded p-1 text-slate-400 hover:bg-neon/10 hover:text-neon"
            title="Run on hosts"
          >
            <Play className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(snippet.id)}
            className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {showRunMenu && (
        <div className="mt-2 rounded border border-white/[0.06] bg-ink-900 p-2">
          <p className="mb-1 text-[10px] font-medium uppercase text-slate-500">Select hosts to run on</p>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {hosts.map((h) => (
              <label key={h.id} className="flex items-center gap-2 text-xs text-slate-300 hover:bg-white/[0.02] rounded px-1 py-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedHostIds.includes(h.id)}
                  onChange={(e) => {
                    setSelectedHostIds((prev) =>
                      e.target.checked ? [...prev, h.id] : prev.filter((id) => id !== h.id)
                    );
                  }}
                  className="rounded"
                />
                {h.label} ({h.address})
              </label>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setShowRunMenu(false)} className="btn-secondary text-xs">Cancel</button>
            <button
              onClick={() => { onRunOnHosts(selectedHostIds); setShowRunMenu(false); }}
              disabled={selectedHostIds.length === 0}
              className="btn-primary text-xs"
            >
              Run ({selectedHostIds.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
