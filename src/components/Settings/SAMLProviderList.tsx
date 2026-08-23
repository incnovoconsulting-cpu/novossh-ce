import { useState } from 'react';
import { Shield, ShieldCheck, ShieldOff, Trash2, Check, X, Loader, Clock, ExternalLink } from '@/lib/icons';
import clsx from 'clsx';
import { useSAML } from '../../hooks/useSAML';

function formatDate(iso?: string) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SAMLProviderList() {
  const saml = useSAML();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleToggleActive = async () => {
    if (!saml.config) return;
    await saml.saveConfig({
      entity_id: saml.config.entity_id,
      sso_url: saml.config.sso_url,
      slo_url: saml.config.slo_url || '',
      certificate: '---',
      name_id_format: saml.config.name_id_format,
      assertion_consumer_service_url: '',
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await saml.saveConfig({
        entity_id: '',
        sso_url: '',
        certificate: '',
        assertion_consumer_service_url: '',
      });
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (saml.loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!saml.config) {
    return (
      <div className="rounded-lg border border-dashed border-white/[0.08] bg-ink-900/50 px-4 py-8 text-center">
        <Shield className="mx-auto mb-3 h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-400">No SAML providers configured</p>
        <p className="mt-1 text-xs text-slate-500">
          Configure SAML in the Configuration tab to enable SSO
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">SAML Providers</h2>
        <p className="text-sm text-slate-400">Manage configured SAML identity providers.</p>
      </div>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded-lg',
                saml.config.is_active ? 'bg-green-500/15' : 'bg-ink-700',
              )}
            >
              {saml.config.is_active ? (
                <ShieldCheck className="h-5 w-5 text-green-400" />
              ) : (
                <ShieldOff className="h-5 w-5 text-slate-500" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                {saml.config.entity_id || 'SAML Provider'}
              </h3>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                    saml.config.is_active
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-slate-500/15 text-slate-400',
                  )}
                >
                  {saml.config.is_active ? (
                    <>
                      <Check className="h-2.5 w-2.5" />
                      Active
                    </>
                  ) : (
                    'Inactive'
                  )}
                </span>
                <span className="text-slate-700">|</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Last login: {formatDate(saml.config.last_login_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-lg border border-white/[0.04] bg-ink-900 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">SSO URL</span>
            <span className="flex items-center gap-1 font-mono text-slate-300">
              {saml.config.sso_url}
              <a
                href={saml.config.sso_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-300"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Entity ID</span>
            <span className="font-mono text-slate-300">{saml.config.entity_id}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Name ID Format</span>
            <span className="font-mono text-slate-300">
              {saml.config.name_id_format?.includes('emailAddress')
                ? 'Email'
                : saml.config.name_id_format?.includes('persistent')
                ? 'Persistent'
                : saml.config.name_id_format?.includes('transient')
                ? 'Transient'
                : 'Unspecified'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handleToggleActive}
            disabled={saml.saving}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              saml.config.is_active
                ? 'bg-ink-700 text-slate-300 hover:bg-ink-600'
                : 'bg-green-500/15 text-green-400 hover:bg-green-500/25',
            )}
          >
            {saml.saving ? (
              <Loader className="h-3.5 w-3.5 animate-spin" />
            ) : saml.config.is_active ? (
              <>
                <ShieldOff className="h-3.5 w-3.5" />
                Disable
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                Enable
              </>
            )}
          </button>
          <button
            onClick={() => saml.initiateLogin()}
            className="btn-ghost flex items-center gap-2 text-xs"
          >
            <Shield className="h-3.5 w-3.5" />
            Test SSO Login
          </button>

          <div className="flex-1" />

          {confirmDelete ? (
            <div className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1">
              <span className="text-[11px] text-red-400">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded p-0.5 text-red-400 hover:bg-red-500/20"
              >
                {deleting ? (
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded p-0.5 text-slate-400 hover:bg-white/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
