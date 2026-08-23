import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { useStore } from '../lib/store';
import { useSubscription } from '../hooks/useSubscription';
import type { AuthMethod, ConnectionMode, Host, ProxyType } from '../lib/types';

interface Props {
  open: boolean;
  initial?: Host;
  onClose: () => void;
}

const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export function HostFormDialog({ open, initial, onClose }: Props) {
  const addHost = useStore((s) => s.addHost);
  const updateHost = useStore((s) => s.updateHost);
  const hosts = useStore((s) => s.hosts);
  const keys = useStore((s) => s.keys);
  const identities = useStore((s) => s.identities);
  const snippets = useStore((s) => s.snippets);
  const { checkLimit } = useSubscription();

  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [password, setPassword] = useState('');
  const [keyId, setKeyId] = useState<string | undefined>(undefined);
  const [certificate, setCertificate] = useState('');
  const [tags, setTags] = useState('');
  const [color, setColor] = useState<string>(PALETTE[5]);
  const [notes, setNotes] = useState('');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('tailscale');
  const [identityId, setIdentityId] = useState<string | undefined>(undefined);
  const [jumpHostIds, setJumpHostIds] = useState<string[]>([]);
  const [proxyType, setProxyType] = useState<ProxyType>('none');
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState(1080);
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [startupSnippetId, setStartupSnippetId] = useState<string | undefined>(undefined);
  const [autoAttachTmux, setAutoAttachTmux] = useState(true);
  const [errors, setErrors] = useState<{ address?: string; username?: string }>({});

  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? '');
      setAddress(initial?.address ?? '');
      setPort(initial?.port ?? 22);
      setUsername(initial?.username ?? '');
      setAuthMethod(initial?.authMethod ?? 'password');
      setPassword(initial?.password ?? '');
      setKeyId(initial?.keyId);
      setCertificate(initial?.certificate ?? '');
      setTags(initial?.tags.join(', ') ?? '');
      setColor(initial?.color ?? PALETTE[5]);
      setNotes(initial?.notes ?? '');
      setConnectionMode(initial?.connectionMode ?? 'tailscale');
      setIdentityId(initial?.identityId);
      setJumpHostIds(initial?.jumpHosts?.map((j) => j.hostId) ?? []);
      setProxyType(initial?.proxy?.type ?? 'none');
      setProxyHost(initial?.proxy?.host ?? '');
      setProxyPort(initial?.proxy?.port ?? 1080);
      setProxyUsername(initial?.proxy?.username ?? '');
      setProxyPassword(initial?.proxy?.password ?? '');
      setStartupSnippetId(initial?.startupSnippetId);
      setAutoAttachTmux(initial?.autoAttachTmux !== false);
      setErrors({});
    }
  }, [open, initial]);

  if (!open) return null;

  const submit = () => {
    const newErrors: { address?: string; username?: string } = {};
    if (!address.trim()) newErrors.address = 'Address is required';
    if (!username.trim()) newErrors.username = 'Username is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    if (!initial) {
      const limit = checkLimit('hosts');
      if (!limit.allowed) {
        setErrors({ address: `Host limit reached (${limit.current}/${limit.limit}). Upgrade your plan.` });
        return;
      }
    }

    const identity = identityId ? identities.find((i) => i.id === identityId) : undefined;

    const data = {
      label: label || address,
      address: address.trim(),
      port,
      username: identity?.username || username.trim(),
      authMethod: identity ? (identity.keyId ? 'key' : 'password') : authMethod,
      password: identity?.password || (authMethod === 'password' ? password : undefined),
      keyId: identity?.keyId || (authMethod === 'key' || authMethod === 'cert' ? keyId : undefined),
      certificate: authMethod === 'cert' ? certificate || undefined : undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      color,
      notes,
      connectionMode,
      identityId,
      jumpHosts: jumpHostIds.map((hostId, order) => ({ hostId, order })),
      proxy: proxyType !== 'none' ? { type: proxyType, host: proxyHost, port: proxyPort, username: proxyUsername || undefined, password: proxyPassword || undefined } : undefined,
      startupSnippetId,
      autoAttachTmux,
    };
    if (initial) {
      updateHost(initial.id, data);
    } else {
      addHost(data);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit host' : 'New host'}
      description="Configure connection details. Credentials stored locally."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={submit} className="btn-primary">
            {initial ? 'Save changes' : 'Add host'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="col-span-2">
          <label className="label">Label</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="production-web-01" />
        </div>

        <div className="col-span-1 grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-3">
          <div className="col-span-2">
            <label className="label">Address</label>
            <input
              className={`input ${errors.address ? 'border-terminal-red/60 focus:border-terminal-red' : ''}`}
              value={address}
              onChange={(e) => { setAddress(e.target.value); if (errors.address) setErrors((p) => ({ ...p, address: undefined })); }}
              placeholder="host.example.com"
            />
            {errors.address && <p className="mt-1 text-[10px] text-terminal-red">{errors.address}</p>}
          </div>
          <div>
            <label className="label">Port</label>
            <input
              type="number"
              className="input"
              value={port}
              onChange={(e) => setPort(Number(e.target.value) || 22)}
            />
          </div>
        </div>

        <div>
          <label className="label">Username</label>
          <input
            className={`input ${errors.username ? 'border-terminal-red/60 focus:border-terminal-red' : ''}`}
            value={username}
            onChange={(e) => { setUsername(e.target.value); if (errors.username) setErrors((p) => ({ ...p, username: undefined })); }}
            placeholder="root"
          />
          {errors.username && <p className="mt-1 text-[10px] text-terminal-red">{errors.username}</p>}
        </div>

        <div>
          <label className="label">Authentication</label>
          <select
            className="input"
            value={authMethod}
            onChange={(e) => setAuthMethod(e.target.value as AuthMethod)}
          >
            <option value="password">Password</option>
            <option value="key">Private key</option>
            <option value="cert">Certificate</option>
            <option value="agent">SSH agent (server)</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="label">Identity (optional)</label>
          <select
            className="input"
            value={identityId ?? ''}
            onChange={(e) => setIdentityId(e.target.value || undefined)}
          >
            <option value="">None — use manual credentials</option>
            {identities.map((i) => (
              <option key={i.id} value={i.id}>{i.label} ({i.username})</option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-slate-500/60">
            Link an identity to reuse username, password, and key across hosts.
          </p>
        </div>

        <div>
          <label className="label">Connection Mode</label>
          <select
            className="input"
            value={connectionMode}
            onChange={(e) => setConnectionMode(e.target.value as ConnectionMode)}
          >
            <option value="tailscale">Tailscale Tunnel</option>
            <option value="direct">Public/Direct</option>
            <option value="relay">Server Relay</option>
          </select>
          <div className="mt-2 rounded-md border border-neon/10 bg-neon/[0.03] p-2.5">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              <span className="text-neon font-medium">Tailscale Tunnel</span> — Route through your Tailscale network. Both client and host must be on Tailscale. Recommended for private networks.
            </p>
            <p className="mt-1.5 text-[10px] text-slate-400 leading-relaxed">
              <span className="text-neon font-medium">Public/Direct</span> — Connect to publicly reachable hosts. Web client routes through server relay. Native clients (Electron, iOS, Android) can connect directly.
            </p>
            <p className="mt-1.5 text-[10px] text-slate-400 leading-relaxed">
              <span className="text-neon font-medium">Server Relay</span> — Always route through the server. Use when direct connections are blocked or for maximum compatibility.
            </p>
          </div>
        </div>

        <div>
          <label className="label">Startup Snippet</label>
          <select
            className="input"
            value={startupSnippetId ?? ''}
            onChange={(e) => setStartupSnippetId(e.target.value || undefined)}
          >
            <option value="">None</option>
            {snippets.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-slate-500/60">
            Runs automatically when you connect to this host.
          </p>
        </div>

        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoAttachTmux}
              onChange={(e) => setAutoAttachTmux(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-ink-800 text-neon focus:ring-neon/50"
            />
            <span className="text-sm text-slate-300">Auto-attach tmux session</span>
          </label>
          <p className="mt-1 text-[10px] text-slate-500/60 ml-6">
            Automatically attach to tmux session "novossh" on connect. Preserves shell state across disconnects.
          </p>
        </div>

        {authMethod === 'password' && !identityId && (
          <div className="col-span-2">
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
            />
            <p className="mt-1 text-[10px] text-slate-500/60 font-mono">stored locally in browser</p>
          </div>
        )}

        {authMethod === 'key' && !identityId && (
          <div className="col-span-2">
            <label className="label">Private key</label>
            <select className="input" value={keyId ?? ''} onChange={(e) => setKeyId(e.target.value || undefined)}>
              <option value="">Select a key...</option>
              {keys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            {keys.length === 0 && (
              <p className="mt-1 text-[10px] text-terminal-amber/60">
                No keys yet. Add one in Keychain.
              </p>
            )}
          </div>
        )}

        {authMethod === 'cert' && !identityId && (
          <>
            <div className="col-span-2">
              <label className="label">Private key</label>
              <select className="input" value={keyId ?? ''} onChange={(e) => setKeyId(e.target.value || undefined)}>
                <option value="">Select a key...</option>
                {keys.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              {keys.length === 0 && (
                <p className="mt-1 text-[10px] text-terminal-amber/60">
                  No keys yet. Add one in Keychain.
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="label">Certificate</label>
              <textarea
                className="input min-h-[80px] font-mono text-[11px]"
                value={certificate}
                onChange={(e) => setCertificate(e.target.value)}
                placeholder="ssh-ed25519-cert-v01@openssh.com AAAA..."
              />
              <p className="mt-1 text-[10px] text-slate-500/60">
                Paste your OpenSSH certificate (*-cert.pub). The private key signs; the cert authorizes.
              </p>
            </div>
          </>
        )}

        <div className="col-span-2">
          <label className="label">Jump Hosts (Host Chaining)</label>
          <select
            multiple
            className="input min-h-[80px]"
            value={jumpHostIds}
            onChange={(e) => setJumpHostIds(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {hosts.filter((h) => h.id !== initial?.id).map((h) => (
              <option key={h.id} value={h.id}>{h.label} ({h.address})</option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-slate-500/60">
            Hold Ctrl/Cmd to select multiple. Traffic routes through these hosts in order.
          </p>
        </div>

        <div className="col-span-2">
          <label className="label">Proxy</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              className="input"
              value={proxyType}
              onChange={(e) => setProxyType(e.target.value as ProxyType)}
            >
              <option value="none">No proxy</option>
              <option value="socks5">SOCKS5</option>
              <option value="http">HTTP</option>
            </select>
            {proxyType !== 'none' && (
              <>
                <input
                  className="input"
                  value={proxyHost}
                  onChange={(e) => setProxyHost(e.target.value)}
                  placeholder="proxy host"
                />
                <input
                  type="number"
                  className="input"
                  value={proxyPort}
                  onChange={(e) => setProxyPort(Number(e.target.value) || 1080)}
                  placeholder="port"
                />
              </>
            )}
          </div>
          {proxyType !== 'none' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                className="input"
                value={proxyUsername}
                onChange={(e) => setProxyUsername(e.target.value)}
                placeholder="Proxy username (optional)"
              />
              <input
                type="password"
                className="input"
                value={proxyPassword}
                onChange={(e) => setProxyPassword(e.target.value)}
                placeholder="Proxy password (optional)"
              />
            </div>
          )}
        </div>

        <div className="col-span-2">
          <label className="label">Tags</label>
          <input
            className="input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="prod, web, eu-west"
          />
        </div>

        <div className="col-span-2">
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ background: c }}
                className={`h-6 w-6 rounded-md ring-1 transition-all duration-150 ${
                  color === c ? 'ring-neon shadow-glow-sm scale-110' : 'ring-white/[0.06]'
                }`}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[56px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
          />
        </div>
      </div>
    </Dialog>
  );
}
export default HostFormDialog;
