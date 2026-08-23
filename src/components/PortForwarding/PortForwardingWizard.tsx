import { useState } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Network,
  Upload,
  Shield,
  ArrowRightLeft,
} from '@/lib/icons';
import type { PortForward, ForwardingType, ForwardingTemplate } from '../../lib/types';
import { usePortForwarding } from '../../hooks/usePortForwarding';
import { PortForwardingDiagram } from './PortForwardingDiagram';
import { useStore } from '../../lib/store';

interface PortForwardingWizardProps {
  hostId: string;
  onClose: () => void;
  onSuccess?: () => void;
  initialTemplate?: ForwardingTemplate | null;
}

type WizardStep = 'type' | 'configure' | 'review';

const TYPE_OPTIONS: {
  type: ForwardingType;
  label: string;
  description: string;
  icon: typeof Network;
  example: string;
}[] = [
  {
    type: 'local',
    label: 'Local Forward',
    description: 'Access a remote service on your local machine',
    icon: ArrowRight,
    example: 'Connect to a remote database as if it were local',
  },
  {
    type: 'remote',
    label: 'Remote Forward',
    description: 'Expose a local service on the remote host',
    icon: Upload,
    example: 'Share your dev server with a colleague via SSH',
  },
  {
    type: 'dynamic',
    label: 'Dynamic (SOCKS)',
    description: 'Route any traffic through the SSH connection',
    icon: Shield,
    example: 'Browse the web through your remote server',
  },
];

export function PortForwardingWizard({
  hostId,
  onClose,
  onSuccess,
  initialTemplate = null,
}: PortForwardingWizardProps) {
  const hosts = useStore((s) => s.hosts);
  const addForward = useStore((s) => s.addForward);
  const { createForward, loading, error } = usePortForwarding();

  const [step, setStep] = useState<WizardStep>(initialTemplate ? 'configure' : 'type');
  const [selectedType, setSelectedType] = useState<ForwardingType>(
    initialTemplate?.type ?? 'local'
  );
  const [config, setConfig] = useState({
    label: initialTemplate?.name ?? '',
    bindAddress: '127.0.0.1',
    bindPort: initialTemplate?.bindPort ?? 8080,
    destinationHost: 'localhost',
    destinationPort: initialTemplate?.destinationPort ?? 80,
    autoStart: false,
  });
  const [validationError, setValidationError] = useState('');

  const host = hosts.find((h) => h.id === hostId);
  const isDynamic = selectedType === 'dynamic';
  const isRemote = selectedType === 'remote';

  const handleTypeSelect = (type: ForwardingType) => {
    setSelectedType(type);
    setValidationError('');
  };

  const handleNext = () => {
    setValidationError('');

    if (step === 'type') {
      setStep('configure');
      return;
    }

    if (step === 'configure') {
      if (!config.label.trim()) {
        setValidationError('Label is required');
        return;
      }
      if (config.bindPort < 1 || config.bindPort > 65535) {
        setValidationError('Bind port must be between 1 and 65535');
        return;
      }
      if (!isDynamic && (config.destinationPort < 1 || config.destinationPort > 65535)) {
        setValidationError('Destination port must be between 1 and 65535');
        return;
      }
      setStep('review');
    }
  };

  const handleBack = () => {
    setValidationError('');
    if (step === 'configure') {
      setStep(initialTemplate ? 'type' : 'type');
    } else if (step === 'review') {
      setStep('configure');
    }
  };

  const handleCreate = async () => {
    try {
      setValidationError('');
      const forwardData = {
        label: config.label,
        hostId,
        type: selectedType,
        bindAddress: config.bindAddress,
        bindPort: config.bindPort,
        destinationHost: isDynamic ? undefined : config.destinationHost,
        destinationPort: isDynamic ? undefined : config.destinationPort,
        autoStart: config.autoStart,
        active: false,
        category: initialTemplate?.category ?? 'Custom',
        notes: initialTemplate?.description ?? '',
      };

      addForward(forwardData);
      onSuccess?.();
      onClose();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to create forward');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl rounded-xl border border-white/[0.06] bg-ink-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">New Port Forward</h2>
              <p className="text-xs text-slate-500">Step {step === 'type' ? '1' : step === 'configure' ? '2' : '3'} of 3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3">
          {['Type', 'Configure', 'Review'].map((label, i) => {
            const stepKey = (['type', 'configure', 'review'] as const)[i];
            const isActive = step === stepKey;
            const isDone = (step === 'configure' && i === 0) || (step === 'review' && i <= 1);
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                      : isDone
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-white/[0.04] text-slate-500'
                  }`}
                >
                  {isDone ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className={`text-xs ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>
                  {label}
                </span>
                {i < 2 && <div className="mx-1 h-px w-6 bg-white/[0.06]" />}
              </div>
            );
          })}
        </div>

        {/* Error display */}
        {(validationError || error) && (
          <div className="mx-6 rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-400">
            {validationError || error}
          </div>
        )}

        {/* Content */}
        <div className="min-h-[320px] px-6 py-4">
          {/* Step 1: Type Selection */}
          {step === 'type' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">Choose the type of port forwarding:</p>
              <div className="grid gap-3">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => handleTypeSelect(opt.type)}
                    className={`flex items-start gap-4 rounded-lg border p-4 text-left transition-all ${
                      selectedType === opt.type
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        selectedType === opt.type
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/[0.04] text-slate-400'
                      }`}
                    >
                      <opt.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-100">{opt.label}</div>
                      <div className="text-xs text-slate-400">{opt.description}</div>
                      <div className="mt-1 text-[11px] text-slate-500 italic">{opt.example}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 'configure' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Label</label>
                  <input
                    className="input"
                    value={config.label}
                    onChange={(e) => setConfig({ ...config, label: e.target.value })}
                    placeholder="e.g. PostgreSQL tunnel"
                  />
                </div>
                <div>
                  <label className="label">Bind Address</label>
                  <input
                    className="input"
                    value={config.bindAddress}
                    onChange={(e) => setConfig({ ...config, bindAddress: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Local Port</label>
                  <input
                    type="number"
                    className="input"
                    value={config.bindPort}
                    onChange={(e) => setConfig({ ...config, bindPort: Number(e.target.value) || 0 })}
                  />
                </div>
                {!isDynamic && (
                  <>
                    <div>
                      <label className="label">Destination Host</label>
                      <input
                        className="input"
                        value={config.destinationHost}
                        onChange={(e) => setConfig({ ...config, destinationHost: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Destination Port</label>
                      <input
                        type="number"
                        className="input"
                        value={config.destinationPort}
                        onChange={(e) => setConfig({ ...config, destinationPort: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </>
                )}
                <label className="col-span-2 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={config.autoStart}
                    onChange={(e) => setConfig({ ...config, autoStart: e.target.checked })}
                    className="rounded border-white/20 bg-white/[0.06] text-emerald-500 focus:ring-emerald-500/40"
                  />
                  Auto-start when host connects
                </label>
              </div>

              {/* Diagram preview */}
              <div className="mt-4">
                <p className="mb-2 text-xs text-slate-500">Connection Preview</p>
                <PortForwardingDiagram
                  type={selectedType}
                  bindAddress={config.bindAddress}
                  bindPort={config.bindPort}
                  destinationHost={config.destinationHost}
                  destinationPort={config.destinationPort}
                  hostLabel={host?.label ?? 'Remote Host'}
                  active={false}
                />
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-4">
                <h3 className="mb-3 text-sm font-medium text-slate-200">Forward Summary</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Type</span>
                    <p className="mt-0.5 font-medium text-slate-200 capitalize">{selectedType}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Label</span>
                    <p className="mt-0.5 font-medium text-slate-200">{config.label}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Local Endpoint</span>
                    <p className="mt-0.5 font-medium text-slate-200">
                      {config.bindAddress}:{config.bindPort}
                    </p>
                  </div>
                  {!isDynamic && (
                    <div>
                      <span className="text-slate-500">Remote Endpoint</span>
                      <p className="mt-0.5 font-medium text-slate-200">
                        {config.destinationHost}:{config.destinationPort}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">Host</span>
                    <p className="mt-0.5 font-medium text-slate-200">{host?.label ?? hostId}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Auto-start</span>
                    <p className="mt-0.5 font-medium text-slate-200">{config.autoStart ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>

              {/* Diagram */}
              <PortForwardingDiagram
                type={selectedType}
                bindAddress={config.bindAddress}
                bindPort={config.bindPort}
                destinationHost={config.destinationHost}
                destinationPort={config.destinationPort}
                hostLabel={host?.label ?? 'Remote Host'}
                active={false}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.04] px-6 py-4">
          <button
            onClick={step === 'type' ? onClose : handleBack}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {step === 'type' ? 'Cancel' : 'Back'}
          </button>
          <button
            onClick={step === 'review' ? handleCreate : handleNext}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                Creating...
              </span>
            ) : step === 'review' ? (
              <span className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5" />
                Create Forward
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
