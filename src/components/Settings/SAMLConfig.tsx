import { useState } from 'react';
import { Shield, Save, TestTube, Loader, Check, X, AlertTriangle, Copy, CheckCircle, XCircle } from '@/lib/icons';
import clsx from 'clsx';
import { useSAML } from '../../hooks/useSAML';

export function SAMLConfig() {
  const saml = useSAML();
  const [entityId, setEntityId] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [sloUrl, setSloUrl] = useState('');
  const [certificate, setCertificate] = useState('');
  const [nameIdFormat, setNameIdFormat] = useState('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress');
  const [acsUrl, setAcsUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (!initialized && saml.config && !saml.loading) {
    setEntityId(saml.config.entity_id || '');
    setSsoUrl(saml.config.sso_url || '');
    setNameIdFormat(saml.config.name_id_format || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress');
    setInitialized(true);
  }

  const handleSave = async () => {
    await saml.saveConfig({
      entity_id: entityId,
      sso_url: ssoUrl,
      slo_url: sloUrl || undefined,
      certificate,
      name_id_format: nameIdFormat,
      assertion_consumer_service_url: acsUrl,
    });
  };

  const handleCopySpEntityId = () => {
    navigator.clipboard.writeText(saml.spEntityId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (saml.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">SAML Configuration</h2>
        <p className="text-sm text-slate-400">
          Configure SAML 2.0 single sign-on with your identity provider.
        </p>
      </div>

      {saml.error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="mb-1 inline h-4 w-4" />
          {saml.error}
        </div>
      )}

      {saml.testResult && (
        <div
          className={clsx(
            'rounded-lg border px-4 py-3 text-sm',
            saml.testResult.success
              ? 'border-green-500/20 bg-green-500/10 text-green-400'
              : 'border-red-500/20 bg-red-500/10 text-red-400',
          )}
        >
          {saml.testResult.success ? (
            <CheckCircle className="mb-1 inline h-4 w-4" />
          ) : (
            <XCircle className="mb-1 inline h-4 w-4" />
          )}
          {saml.testResult.message}
          <button onClick={saml.clearTest} className="ml-2 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-200">Service Provider (SP) Details</h3>
        <p className="mb-3 text-xs text-slate-400">
          Configure these values in your identity provider.
        </p>
        <div>
          <label className="label">SP Entity ID</label>
          <div className="flex items-center gap-2">
            <input
              className="input flex-1 font-mono text-xs"
              value={saml.spEntityId}
              readOnly
            />
            <button
              onClick={handleCopySpEntityId}
              className="rounded-md border border-white/[0.04] bg-ink-700 p-2 text-slate-400 hover:bg-ink-600 hover:text-slate-200"
              title="Copy"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="mt-3">
          <label className="label">ACS URL (Assertion Consumer Service)</label>
          <input
            type="url"
            className="input font-mono text-xs"
            placeholder="https://ssh.novossh.com/api/saml/acs"
            value={acsUrl}
            onChange={(e) => setAcsUrl(e.target.value)}
          />
        </div>
      </section>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-200">Identity Provider (IdP) Details</h3>
        <div className="space-y-4">
          <div>
            <label className="label">IdP Entity ID *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., https://idp.example.com/metadata"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            />
          </div>
          <div>
            <label className="label">SSO URL *</label>
            <input
              type="url"
              className="input"
              placeholder="e.g., https://idp.example.com/sso/saml"
              value={ssoUrl}
              onChange={(e) => setSsoUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="label">SLO URL (optional)</label>
            <input
              type="url"
              className="input"
              placeholder="e.g., https://idp.example.com/slo/saml"
              value={sloUrl}
              onChange={(e) => setSloUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Name ID Format</label>
            <select
              className="input"
              value={nameIdFormat}
              onChange={(e) => setNameIdFormat(e.target.value)}
            >
              <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
                Email Address
              </option>
              <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">
                Persistent
              </option>
              <option value="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">
                Transient
              </option>
              <option value="urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified">
                Unspecified
              </option>
            </select>
          </div>
          <div>
            <label className="label">X.509 Certificate *</label>
            <textarea
              className="input min-h-[120px] resize-y font-mono text-xs leading-relaxed"
              placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDp...&#10;-----END CERTIFICATE-----"
              value={certificate}
              onChange={(e) => setCertificate(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Paste the PEM-encoded certificate from your IdP.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saml.saving || !entityId || !ssoUrl || !certificate || !acsUrl}
          className="btn-primary flex items-center gap-2"
        >
          {saml.saving ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Configuration
            </>
          )}
        </button>
        <button
          onClick={saml.testConnection}
          disabled={saml.testing || !saml.config}
          className="btn-secondary flex items-center gap-2"
        >
          {saml.testing ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <TestTube className="h-4 w-4" />
              Test Connection
            </>
          )}
        </button>
      </div>
    </div>
  );
}
