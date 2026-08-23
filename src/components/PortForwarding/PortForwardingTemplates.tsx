import { useState } from 'react';
import {
  X,
  Plus,
  Database,
  Globe,
  Shield,
  Monitor,
  Zap,
  Boxes,
  Upload,
  Lock,
  Trash2,
  Save,
} from '@/lib/icons';
import type { ForwardingTemplate, ForwardingType } from '../../lib/types';
import { usePortForwarding } from '../../hooks/usePortForwarding';
import { useStore } from '../../lib/store';

const ICON_MAP: Record<string, typeof Database> = {
  database: Database,
  globe: Globe,
  shield: Shield,
  monitor: Monitor,
  lock: Lock,
  zap: Zap,
  boxes: Boxes,
  upload: Upload,
};

function getIcon(iconName: string) {
  return ICON_MAP[iconName] || Globe;
}

interface PortForwardingTemplatesProps {
  hostId: string;
  onSelectTemplate: (template: ForwardingTemplate) => void;
  onClose: () => void;
}

export function PortForwardingTemplates({
  hostId,
  onSelectTemplate,
  onClose,
}: PortForwardingTemplatesProps) {
  const {
    templates,
    saveCustomTemplate,
    deleteCustomTemplate,
    loading,
  } = usePortForwarding();
  const hosts = useStore((s) => s.hosts);

  const [filter, setFilter] = useState<string>('all');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    type: 'local' as ForwardingType,
    bindPort: 8080,
    destinationPort: 80,
    category: 'Custom',
    icon: 'globe',
  });

  const categories = [...new Set(templates.map((t) => t.category))];
  const filtered = filter === 'all' ? templates : templates.filter((t) => t.category === filter);

  const handleSaveTemplate = async () => {
    if (!newTemplate.name.trim()) return;
    try {
      await saveCustomTemplate(newTemplate);
      setShowSaveForm(false);
      setNewTemplate({
        name: '',
        description: '',
        type: 'local',
        bindPort: 8080,
        destinationPort: 80,
        category: 'Custom',
        icon: 'globe',
      });
    } catch {
      // Error handled by hook
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-3xl rounded-xl border border-white/[0.06] bg-ink-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Template Library</h2>
            <p className="text-xs text-slate-500">
              Choose a template or create a custom one · {templates.length} templates
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category filter + Save button */}
        <div className="flex items-center gap-3 border-b border-white/[0.04] px-6 py-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-400 hover:bg-white/[0.04]'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  filter === cat
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-slate-400 hover:bg-white/[0.04]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setShowSaveForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08]"
            >
              <Plus className="h-3 w-3" />
              Save Custom
            </button>
          </div>
        </div>

        {/* Save template form */}
        {showSaveForm && (
          <div className="border-b border-white/[0.04] bg-emerald-500/5 px-6 py-4">
            <h3 className="mb-3 text-xs font-semibold text-slate-200">Save Custom Template</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="My template"
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  className="input"
                  value={newTemplate.type}
                  onChange={(e) => setNewTemplate({ ...newTemplate, type: e.target.value as ForwardingType })}
                >
                  <option value="local">Local</option>
                  <option value="remote">Remote</option>
                  <option value="dynamic">Dynamic</option>
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <input
                  className="input"
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Bind Port</label>
                <input
                  type="number"
                  className="input"
                  value={newTemplate.bindPort}
                  onChange={(e) => setNewTemplate({ ...newTemplate, bindPort: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Dest Port</label>
                <input
                  type="number"
                  className="input"
                  value={newTemplate.destinationPort}
                  onChange={(e) => setNewTemplate({ ...newTemplate, destinationPort: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="label">Description</label>
                <input
                  className="input"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  placeholder="Short description"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowSaveForm(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={loading || !newTemplate.name.trim()}
                className="btn-primary flex items-center gap-1.5"
              >
                <Save className="h-3 w-3" />
                Save
              </button>
            </div>
          </div>
        )}

        {/* Template grid */}
        <div className="max-h-[400px] overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((tpl) => {
              const IconComp = getIcon(tpl.icon);
              const isCustom = tpl.id.startsWith('tpl_custom_');
              return (
                <button
                  key={tpl.id}
                  onClick={() => onSelectTemplate(tpl)}
                  className="group flex flex-col items-start rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-left transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] text-slate-400 group-hover:bg-emerald-500/15 group-hover:text-emerald-300">
                      <IconComp className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          tpl.type === 'local'
                            ? 'bg-blue-500/15 text-blue-300'
                            : tpl.type === 'remote'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-purple-500/15 text-purple-300'
                        }`}
                      >
                        {tpl.type}
                      </span>
                      {isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomTemplate(tpl.id);
                          }}
                          className="rounded p-0.5 text-slate-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-slate-200">{tpl.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{tpl.description}</div>
                  <div className="mt-1.5 text-[10px] text-slate-600">
                    {tpl.type === 'dynamic' ? `Port ${tpl.bindPort}` : `Port ${tpl.bindPort} → ${tpl.destinationPort}`}
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">No templates in this category</div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.04] px-6 py-3">
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
