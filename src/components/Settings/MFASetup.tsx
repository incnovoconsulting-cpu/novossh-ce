import { useState } from 'react';
import { Shield, ShieldCheck, ShieldOff, Key, Smartphone, AlertTriangle, Check, Loader, Download, Copy, RefreshCw, Trash2 } from '@/lib/icons';
import clsx from 'clsx';
import { useMFA } from '../../hooks/useMFA';
import { MFADeviceList } from './MFADeviceList';

export function MFASetup() {
  const mfa = useMFA();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Only treat MFA as enabled if there are actual registered credentials
  const effectiveEnabled = mfa.settings.webauthn_enabled && mfa.credentials.length > 0;

  const handleToggleMFA = async (enabled: boolean) => {
    if (!enabled) {
      setToggleLoading(true);
      try {
        await mfa.updateSettings({ webauthn_enabled: false, webauthn_required: false });
      } finally {
        setToggleLoading(false);
      }
      return;
    }
    // Can only enable by registering a device first
    setShowSetupWizard(true);
  };

  const handleToggleRequired = async (required: boolean) => {
    setToggleLoading(true);
    try {
      if (required && !mfa.settings.webauthn_enabled) {
        await mfa.updateSettings({ webauthn_enabled: true, webauthn_required: true });
      } else {
        await mfa.updateSettings({ webauthn_required: required });
      }
    } finally {
      setToggleLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegistering(true);
    try {
      await mfa.registerDevice(deviceName || undefined);
      setDeviceName('');
      setShowSetupWizard(false);
      await mfa.updateSettings({ webauthn_enabled: true });
    } catch (e: any) {
      console.error('Registration failed:', e);
    } finally {
      setRegistering(false);
    }
  };

  const handleGenerateBackupCodes = async () => {
    setRegeneratingCodes(true);
    try {
      const codes = await mfa.generateBackupCodes();
      setBackupCodes(codes);
      setShowBackupCodes(true);
      setCodesCopied(false);
    } finally {
      setRegeneratingCodes(false);
    }
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCodesCopied(true);
    setTimeout(() => setCodesCopied(false), 2000);
  };

  const handleDownloadCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novossh-backup-codes-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (mfa.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Multi-Factor Authentication</h2>
        <p className="text-sm text-slate-400">Secure your account with an additional layer of protection.</p>
      </div>

      {mfa.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="mb-1 inline h-4 w-4" />
          {mfa.error}
        </div>
      )}

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              effectiveEnabled ? 'bg-green-500/15' : 'bg-ink-700',
            )}>
              {effectiveEnabled ? (
                <ShieldCheck className="h-5 w-5 text-green-400" />
              ) : (
                <ShieldOff className="h-5 w-5 text-slate-500" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">MFA Status</h3>
              <p className="text-xs text-slate-400">
                {effectiveEnabled
                  ? `${mfa.credentials.length} device(s) registered`
                  : 'Not configured'}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleToggleMFA(!effectiveEnabled)}
            disabled={toggleLoading}
            className={clsx(
              'relative h-6 w-11 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              effectiveEnabled ? 'bg-green-500' : 'bg-ink-600',
            )}
          >
            <span
              className={clsx(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                effectiveEnabled ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-700">
              <Key className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Require MFA for all logins</h3>
              <p className="text-xs text-slate-400">Force MFA verification on every sign-in</p>
            </div>
          </div>
          <button
            onClick={() => handleToggleRequired(!mfa.settings.webauthn_required)}
            disabled={toggleLoading || !effectiveEnabled}
            className={clsx(
              'relative h-6 w-11 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              mfa.settings.webauthn_required ? 'bg-accent' : 'bg-ink-600',
              !effectiveEnabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span
              className={clsx(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                mfa.settings.webauthn_required ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Security Keys & Devices</h3>
          <button
            onClick={() => setShowSetupWizard(!showSetupWizard)}
            className="btn-primary flex items-center gap-1.5 text-xs"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Add Device
          </button>
        </div>

        {showSetupWizard && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
            <h4 className="mb-3 text-sm font-medium text-slate-200">Register New Device</h4>
            <p className="mb-3 text-xs text-slate-400">
              Your browser will prompt you to use a security key, Touch ID, or Face ID.
            </p>
            <div className="mb-3">
              <label className="label">Device name (optional)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., MacBook Pro Touch ID"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRegister}
                disabled={registering}
                className="btn-primary flex items-center gap-1.5"
              >
                {registering ? (
                  <>
                    <Loader className="h-3.5 w-3.5 animate-spin" />
                    Waiting...
                  </>
                ) : (
                  <>
                    <Smartphone className="h-3.5 w-3.5" />
                    Start Registration
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowSetupWizard(false);
                  setDeviceName('');
                }}
                className="btn-ghost text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <MFADeviceList
          credentials={mfa.credentials}
          onDelete={mfa.deleteDevice}
          onRename={mfa.renameDevice}
        />
      </section>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Backup Codes</h3>
            <p className="text-xs text-slate-400">Use these one-time codes if you lose access to your device</p>
          </div>
          <button
            onClick={handleGenerateBackupCodes}
            disabled={regeneratingCodes}
            className="btn-ghost flex items-center gap-1.5 text-xs"
          >
            {regeneratingCodes ? (
              <Loader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {backupCodes.length > 0 ? 'Regenerate' : 'Generate'}
          </button>
        </div>

        {showBackupCodes && backupCodes.length > 0 && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Save these codes in a safe place. Each code can only be used once.</span>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {backupCodes.map((code, i) => (
                <code
                  key={i}
                  className="rounded bg-ink-900 px-2 py-1.5 text-center font-mono text-xs text-slate-200"
                >
                  {code}
                </code>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyCodes}
                className="btn-ghost flex items-center gap-1.5 text-xs"
              >
                {codesCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadCodes}
                className="btn-ghost flex items-center gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
