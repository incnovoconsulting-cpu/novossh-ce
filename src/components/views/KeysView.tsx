import { useState, useEffect, ChangeEvent } from 'react';
import { KeyRound, Plus, Trash2, Upload } from '@/lib/icons';
import { useStore } from '../../lib/store';
import { timeAgo } from '../../lib/format';

function SkeletonKey() {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-ink-800/60 border border-white/[0.04] p-3 animate-pulse">
      <div className="h-10 w-10 rounded-md bg-ink-700" />
      <div className="flex-1">
        <div className="h-4 bg-ink-700 rounded w-1/4 mb-2" />
        <div className="h-3 bg-ink-700 rounded w-1/3" />
      </div>
    </div>
  )
}

export function KeysView() {
  const keys = useStore((s) => s.keys);
  const addKey = useStore((s) => s.addKey);
  const deleteKey = useStore((s) => s.deleteKey);

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [hasPassphrase, setHasPassphrase] = useState(false);

  const submit = () => {
    if (!label || !privateKey) return;
    addKey({ label, privateKey, publicKey: publicKey || undefined, hasPassphrase });
    setLabel('');
    setPrivateKey('');
    setPublicKey('');
    setHasPassphrase(false);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setPrivateKey(text);
    if (!label) setLabel(f.name);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Keychain</h1>
            <p className="text-sm text-slate-400">
              Store SSH private keys locally. Keys never leave your browser except as part of authentication to your own backend.
            </p>
          </div>
        </div>
        <button onClick={() => setShowForm((f) => !f)} className="btn-secondary text-xs">
          <Plus className="h-3.5 w-3.5" /> {showForm ? 'Cancel' : 'Import key'}
        </button>
      </div>

      {showForm && <section className="mt-8 rounded-lg border border-white/[0.04] bg-ink-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Import private key</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 md:col-span-1">
            <label className="label">Label</label>
            <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="prod-deploy" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="label">Import from file</label>
            <label className="btn-secondary cursor-pointer">
              <Upload className="h-4 w-4" /> Choose file
              <input type="file" hidden onChange={onFile} accept=".pem,.key,.pub,*" />
            </label>
          </div>
          <div className="col-span-2">
            <label className="label">Private key</label>
            <textarea
              className="input min-h-[120px] font-mono text-[11px]"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            />
          </div>
          <div className="col-span-2">
            <label className="label">Public key (optional)</label>
            <textarea
              className="input min-h-[60px] font-mono text-[11px]"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              placeholder="ssh-ed25519 AAAA…"
            />
          </div>
          <label className="col-span-2 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={hasPassphrase}
              onChange={(e) => setHasPassphrase(e.target.checked)}
            />
            Key has a passphrase
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={submit} className="btn-primary" disabled={!label || !privateKey}>
            <Plus className="h-4 w-4" /> Add key
          </button>
        </div>
      </section>}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Stored keys ({keys.length})</h2>
        <div className="space-y-2">
          {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonKey key={i} />)}

          {!loading && keys.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <KeyRound className="h-12 w-12 text-slate-600 mb-4" />
              <h2 className="text-lg text-slate-400 font-medium mb-1">No keys imported</h2>
              <p className="text-sm text-slate-500">Import an SSH key to use for authentication</p>
            </div>
          )}

          {!loading && keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-ink-800 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-500/15 text-violet-300">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-100">{k.label}</div>
                <div className="text-xs text-slate-500">
                  {k.hasPassphrase ? 'Encrypted' : 'Unencrypted'} · added {timeAgo(k.createdAt)}
                </div>
              </div>
              <button
                onClick={() => deleteKey(k.id)}
                className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
