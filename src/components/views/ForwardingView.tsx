import { useState } from 'react';
import {
  Network,
  Plus,
  BookOpen,
  ArrowRightLeft,
} from '@/lib/icons';
import { useStore } from '../../lib/store';
import { PaywallGate } from '../PaywallGate';
import { PortForwardingWizard } from '../PortForwarding/PortForwardingWizard';
import { PortForwardingTemplates } from '../PortForwarding/PortForwardingTemplates';
import { PortForwardingList } from '../PortForwarding/PortForwardingList';
import type { ForwardingTemplate } from '../../lib/types';

export function ForwardingView() {
  const hosts = useStore((s) => s.hosts);
  const [showWizard, setShowWizard] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedHostId, setSelectedHostId] = useState(hosts[0]?.id ?? '');
  const [initialTemplate, setInitialTemplate] = useState<ForwardingTemplate | null>(null);

  const handleSelectTemplate = (template: ForwardingTemplate) => {
    setShowTemplates(false);
    setInitialTemplate(template);
    setShowWizard(true);
  };

  const handleWizardClose = () => {
    setShowWizard(false);
    setInitialTemplate(null);
  };

  const handleWizardSuccess = () => {
    setShowWizard(false);
    setInitialTemplate(null);
  };

  return (
    <PaywallGate feature="portForwarding">
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-100">Port forwarding</h1>
              <p className="text-sm text-slate-400">
                Manage SSH tunnels and port forwards for your hosts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hosts.length > 1 && (
              <select
                className="input min-w-[140px]"
                value={selectedHostId}
                onChange={(e) => setSelectedHostId(e.target.value)}
              >
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>{h.label}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowTemplates(true)}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.08]"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Templates
            </button>
            <button
              onClick={() => {
                setInitialTemplate(null);
                setShowWizard(true);
              }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              New forward
            </button>
          </div>
        </div>

        {/* Active forwards list */}
        <section className="mt-8">
          <PortForwardingList />
        </section>
      </div>

      {/* Wizard modal */}
      {showWizard && selectedHostId && (
        <PortForwardingWizard
          hostId={selectedHostId}
          onClose={handleWizardClose}
          onSuccess={handleWizardSuccess}
          initialTemplate={initialTemplate}
        />
      )}

      {/* Templates modal */}
      {showTemplates && selectedHostId && (
        <PortForwardingTemplates
          hostId={selectedHostId}
          onSelectTemplate={handleSelectTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </PaywallGate>
  );
}
