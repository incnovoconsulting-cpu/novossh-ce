import { useState } from 'react';
import { ShieldCheck, Key, AlertTriangle, Loader, Smartphone, RefreshCw } from '@/lib/icons';
import clsx from 'clsx';
import { useMFA } from '../../hooks/useMFA';

type VerifyMethod = 'totp' | 'webauthn' | 'backup';

interface MFAVerifyProps {
  onVerified: () => void;
  onCancel?: () => void;
}

export function MFAVerify({ onVerified, onCancel }: MFAVerifyProps) {
  const mfa = useMFA();
  const [method, setMethod] = useState<VerifyMethod>('webauthn');
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [webauthnPending, setWebauthnPending] = useState(false);

  const handleWebAuthnVerify = async () => {
    setWebauthnPending(true);
    setError(null);
    try {
      const authData = await mfa.startAuth();
      const verified = await mfa.verifyAuth(authData as { userId: string; response: any });
      if (verified) {
        if (rememberDevice) {
          localStorage.setItem('mfa_remember_device', Date.now().toString());
        }
        onVerified();
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        setError('Verification was cancelled.');
      } else {
        setError(e.message || 'WebAuthn verification failed.');
      }
    } finally {
      setWebauthnPending(false);
    }
  };

  const handleBackupVerify = async () => {
    if (!backupCode.trim()) {
      setError('Please enter a backup code.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const verified = await mfa.verifyBackupCode(backupCode.trim());
      if (verified) {
        onVerified();
      } else {
        setError('Invalid or expired backup code.');
      }
    } catch (e: any) {
      setError(e.message || 'Backup code verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleTotpVerify = async () => {
    if (totpCode.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const verified = await mfa.verifyBackupCode(totpCode);
      if (verified) {
        onVerified();
      } else {
        setError('Invalid code. Please try again.');
      }
    } catch (e: any) {
      setError(e.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
            <ShieldCheck className="h-7 w-7 text-accent" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Two-Factor Authentication</h2>
          <p className="mt-1 text-sm text-slate-400">Verify your identity to continue</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertTriangle className="mb-1 inline h-4 w-4" />
            {error}
          </div>
        )}

        <div className="flex gap-1 rounded-lg bg-ink-900 p-1">
          <button
            onClick={() => { setMethod('webauthn'); setError(null); }}
            className={clsx(
              'flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors',
              method === 'webauthn' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <Smartphone className="mr-1.5 inline h-3.5 w-3.5" />
            Security Key
          </button>
          <button
            onClick={() => { setMethod('backup'); setError(null); }}
            className={clsx(
              'flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors',
              method === 'backup' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <Key className="mr-1.5 inline h-3.5 w-3.5" />
            Backup Code
          </button>
        </div>

        {method === 'webauthn' && (
          <div className="space-y-4">
            <p className="text-center text-sm text-slate-300">
              Use your security key, Touch ID, or Face ID to verify.
            </p>
            <button
              onClick={handleWebAuthnVerify}
              disabled={webauthnPending}
              className="btn-primary w-full"
            >
              {webauthnPending ? (
                <>
                  <Loader className="mr-2 inline h-4 w-4 animate-spin" />
                  Waiting for device...
                </>
              ) : (
                <>
                  <Smartphone className="mr-2 inline h-4 w-4" />
                  Verify with Security Key
                </>
              )}
            </button>
          </div>
        )}

        {method === 'backup' && (
          <div className="space-y-4">
            <div>
              <label className="label">Backup Code</label>
              <input
                type="text"
                className="input font-mono"
                placeholder="XXXX-XXXX-XXXX"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBackupVerify()}
                autoFocus
              />
            </div>
            <button
              onClick={handleBackupVerify}
              disabled={verifying || !backupCode.trim()}
              className="btn-primary w-full"
            >
              {verifying ? (
                <Loader className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                'Verify'
              )}
            </button>
          </div>
        )}

        <label className="flex cursor-pointer items-center justify-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            className="h-4 w-4 rounded border-ink-600 bg-ink-700 text-accent focus:ring-accent"
          />
          Remember this device for 30 days
        </label>

        {onCancel && (
          <button onClick={onCancel} className="btn-ghost w-full text-xs">
            Use a different account
          </button>
        )}
      </div>
    </div>
  );
}
