import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import type { Host } from '../lib/types';
import { useStore } from '../lib/store';

interface Props {
  host: Host | null;
  onClose: () => void;
}

export function ConnectDialog({ host, onClose }: Props) {
  const openTab = useStore((s) => s.openTab);
  const updateHost = useStore((s) => s.updateHost);
  const [password, setPassword] = useState('');

  useEffect(() => {
    setPassword('');
  }, [host?.id]);

  if (!host) return null;

  const needsPassword = host.authMethod === 'password' && !host.password;

  const connect = () => {
    if (needsPassword) {
      // store password ephemerally on the host record so TerminalPane can pick it up
      updateHost(host.id, { password });
    }
    openTab(host.id);
    onClose();
  };

  const connectionModeLabel = host.connectionMode === 'tailscale' ? ' (via Tailscale)' : '';

  return (
    <Dialog
      open={!!host}
      onClose={onClose}
      title={`Connect to ${host.label}`}
      description={`${host.username}@${host.address}:${host.port}${connectionModeLabel}`}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={connect} className="btn-primary" disabled={needsPassword && !password}>
            Connect
          </button>
        </div>
      }
    >
      {needsPassword ? (
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="input"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && password && connect()}
          />
          <p className="mt-1 text-[11px] text-slate-500">This password is sent only to your local backend.</p>
        </div>
      ) : (
        <p className="text-sm text-slate-300">Open a new terminal tab for this host?</p>
      )}
    </Dialog>
  );
}
export default ConnectDialog;
