import { useState } from 'react';
import { Settings, Palette, Terminal, CreditCard, Info, Loader, Check, X, ExternalLink, AlertTriangle, Shield, KeyRound, Mail, Wifi } from '@/lib/icons';
import clsx from 'clsx';
import { useStore } from '../../lib/store';
import { terminalThemes } from '../../lib/themes';
import { useSubscription } from '../../hooks/useSubscription';
import { createCheckoutSession, createPortalSession } from '../../lib/billingApi';
import { MFASetup } from '../Settings/MFASetup';
import { SAMLConfig } from '../Settings/SAMLConfig';
import { SAMLProviderList } from '../Settings/SAMLProviderList';
import { PaywallGate } from '../PaywallGate';
import { DowngradePreview } from '../Billing/DowngradePreview';
import type { Settings as SettingsType, Plan } from '../../lib/types';

type Tab = 'appearance' | 'terminal' | 'network' | 'subscription' | 'security' | 'saml' | 'about';

const TABS: { key: Tab; label: string; icon: typeof Settings }[] = [
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'terminal', label: 'Terminal', icon: Terminal },
  { key: 'network', label: 'Network', icon: Wifi },
  { key: 'subscription', label: 'Subscription', icon: CreditCard },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'saml', label: 'SAML SSO', icon: KeyRound },
  { key: 'about', label: 'About', icon: Info },
];

const PLANS = [
  {
    name: 'Free',
    key: 'free' as Plan,
    monthlyPrice: 0,
    annualPrice: 0,
    features: ['3 hosts', '10 snippets', '1 vault', '2 SSH keys', '2 tabs', 'Terminal access'],
    limitations: ['No port forwarding', 'No SFTP browser', 'No MFA', 'No analytics'],
  },
  {
    name: 'Starter',
    key: 'starter' as Plan,
    monthlyPrice: 4.99,
    annualPrice: 3.33,
    features: ['25 hosts', 'Unlimited snippets, vaults & keys', '10 tabs', 'Port forwarding', 'SFTP browser', 'MFA / security keys', 'Analytics', 'Command palette'],
    limitations: ['No session recording', 'No P2P sync'],
    popular: true,
  },
  {
    name: 'Pro',
    key: 'pro' as Plan,
    monthlyPrice: 9.99,
    annualPrice: 6.67,
    features: ['Unlimited hosts & tabs', 'Session recording & playback', 'Audit logs', 'P2P sync', 'Priority support', 'Everything in Starter'],
    limitations: [],
  },
];

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const { auth } = useStore();
  const subscription = useSubscription();
  const activeTab = useStore((s) => s.settingsTab) as Tab;
  const setActiveTab = useStore((s) => s.setSettingsTab);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<Plan | null>(null);

  const handleUpgrade = async (plan: Plan) => {
    if (!auth.accessToken || plan === 'free') return;
    setCheckoutLoading(plan);
    try {
      const { url } = await createCheckoutSession(auth.accessToken, plan, billing);
      window.location.href = url;
    } catch (err) {
      console.error('Checkout failed:', err);
      setCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!auth.accessToken) return;
    setPortalLoading(true);
    try {
      const { url } = await createPortalSession(auth.accessToken);
      window.location.href = url;
    } catch (err: any) {
      console.error('Failed to open billing portal:', err);
      alert(err?.message || 'Failed to open billing portal. Apple/Google IAP subscriptions are managed through the App Store / Play Store.');
      setPortalLoading(false);
    }
  };

  return (
    <div className="flex h-full overflow-y-auto px-8 py-8">
      {activeTab === 'appearance' && (
        <AppearanceTab settings={settings} update={update} />
      )}
      {activeTab === 'terminal' && (
        <TerminalTab settings={settings} update={update} />
      )}
      {activeTab === 'network' && (
        <NetworkTab settings={settings} update={update} />
      )}
      {activeTab === 'subscription' && (
        <SubscriptionTab
          subscription={subscription}
          billing={billing}
          setBilling={setBilling}
          checkoutLoading={checkoutLoading}
          portalLoading={portalLoading}
          onUpgrade={handleUpgrade}
          onDowngrade={setDowngradeTarget}
          onManageBilling={handleManageBilling}
        />
      )}

      {downgradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md">
            <DowngradePreview
              targetPlan={downgradeTarget}
              onCancel={() => setDowngradeTarget(null)}
              onConfirm={() => {
                setDowngradeTarget(null);
                window.location.reload();
              }}
            />
          </div>
        </div>
      )}
      {activeTab === 'security' && <PaywallGate feature="mfa"><MFASetup /></PaywallGate>}
      {activeTab === 'saml' && <PaywallGate feature="teams"><SAMLTab /></PaywallGate>}
      {activeTab === 'about' && <AboutTab />}
    </div>
  );
}

function AppearanceTab({ settings, update }: { settings: SettingsType; update: (p: Partial<SettingsType>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Appearance</h2>
        <p className="text-sm text-slate-400">Customize the look and feel of your terminal.</p>
      </div>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Terminal theme</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(terminalThemes).map(([key, theme]) => (
            <button
              key={key}
              onClick={() => update({ theme: key as SettingsType['theme'] })}
              className={clsx(
                'flex items-center gap-3 rounded-md border p-3 text-left transition-colors',
                settings.theme === key
                  ? 'border-accent bg-accent/10'
                  : 'border-white/[0.04] bg-ink-900 hover:bg-ink-750',
              )}
            >
              <div
                className="h-10 w-16 rounded border border-white/[0.04]"
                style={{ background: theme.background }}
              >
                <div className="flex h-full items-center justify-center gap-1">
                  <span style={{ color: theme.red }}>●</span>
                  <span style={{ color: theme.green }}>●</span>
                  <span style={{ color: theme.blue }}>●</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-100">{theme.name}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Font</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Font size</label>
            <input
              type="number"
              min={9}
              max={32}
              className="input"
              value={settings.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) || 13 })}
            />
          </div>
          <div>
            <label className="label">Cursor style</label>
            <select
              className="input"
              value={settings.cursorStyle}
              onChange={(e) => update({ cursorStyle: e.target.value as 'block' | 'underline' | 'bar' })}
            >
              <option value="block">Block</option>
              <option value="underline">Underline</option>
              <option value="bar">Bar</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Font family</label>
            <input
              className="input font-mono"
              value={settings.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Primary: {settings.fontFamily.split(',')[0].trim().replace(/['"]/g, '')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function TerminalTab({ settings, update }: { settings: SettingsType; update: (p: Partial<SettingsType>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Terminal</h2>
        <p className="text-sm text-slate-400">Configure terminal behavior and performance.</p>
      </div>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Behavior</h3>
        <div className="space-y-3">
          <Toggle
            label="Cursor blink"
            checked={settings.cursorBlink}
            onChange={(v) => update({ cursorBlink: v })}
          />
          <Toggle
            label="Copy on selection"
            checked={settings.copyOnSelect}
            onChange={(v) => update({ copyOnSelect: v })}
          />
          <Toggle
            label="Paste on right-click"
            checked={settings.pasteOnRightClick}
            onChange={(v) => update({ pasteOnRightClick: v })}
          />
          <Toggle
            label="Bell sound"
            checked={settings.bellSound}
            onChange={(v) => update({ bellSound: v })}
          />
        </div>
      </section>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Performance</h3>
        <div className="space-y-3">
          <div>
            <label className="label">Scrollback (lines)</label>
            <input
              type="number"
              className="input"
              value={settings.scrollback}
              onChange={(e) => update({ scrollback: Number(e.target.value) || 1000 })}
            />
          </div>
          <div>
            <label className="label">Keepalive interval (seconds)</label>
            <input
              type="number"
              className="input"
              value={settings.keepAliveSeconds}
              onChange={(e) => update({ keepAliveSeconds: Number(e.target.value) || 30 })}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function NetworkTab({ settings, update }: { settings: SettingsType; update: (p: Partial<SettingsType>) => void }) {
  const [networkKey, setNetworkKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateKey = async () => {
    setLoading(true);
    setError(null);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const stored = JSON.parse(localStorage.getItem('novossh-auth') || '{}');
      const res = await fetch(`${API_BASE}/api/tailscale/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${stored.accessToken}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.authKey) {
        setNetworkKey(data.authKey);
      } else {
        setError(data.error || 'Failed to generate key');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Network</h2>
        <p className="text-sm text-slate-400">Configure network and connection settings.</p>
      </div>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Network Key</h3>
        <p className="mb-3 text-[12px] text-slate-400">
          Generate a key to connect your machine to the NovoSSH network. Use this key with the Network Client installer to enable direct P2P connections.
        </p>
        {networkKey ? (
          <div className="rounded-lg border border-[#00e5ff]/20 bg-[#00e5ff]/5 p-3">
            <p className="mb-2 text-[11px] font-medium text-[#00e5ff]">Your Network Key</p>
            <code className="block break-all font-mono text-[12px] text-slate-200">{networkKey}</code>
            <p className="mt-2 text-[11px] text-slate-500">This key expires in 1 hour. Use it with the installer: novossh-network --authkey {networkKey}</p>
          </div>
        ) : (
          <button
            onClick={generateKey}
            disabled={loading}
            className="rounded-lg bg-[#00e5ff] px-4 py-2 text-[13px] font-semibold text-ink-950 transition-colors hover:bg-[#00e5ff]/90 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Network Key'}
          </button>
        )}
        {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
      </section>
    </div>
  );
}

interface SubscriptionTabProps {
  subscription: ReturnType<typeof useSubscription>;
  billing: 'monthly' | 'annual';
  setBilling: (b: 'monthly' | 'annual') => void;
  checkoutLoading: string | null;
  portalLoading: boolean;
  onUpgrade: (plan: Plan) => void;
  onDowngrade: (plan: Plan) => void;
  onManageBilling: () => void;
}

function SubscriptionTab({
  subscription,
  billing,
  setBilling,
  checkoutLoading,
  portalLoading,
  onUpgrade,
  onDowngrade,
  onManageBilling,
}: SubscriptionTabProps) {
  const planOrder: Plan[] = ['free', 'starter', 'pro'];

  const enterpriseFeatures = [
    'Unlimited everything',
    'SAML / SSO',
    'Tailscale self-hosted server',
    'Organization & team management',
    'Dedicated account manager',
    'Custom SLA & retention',
    'Priority support',
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Subscription</h2>
        <p className="text-sm text-slate-400">Manage your plan, billing, and usage.</p>
      </div>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Current plan</h3>
            <p className="mt-1 text-2xl font-bold text-white capitalize">{subscription.plan}</p>
          </div>
          <div className="text-right">
            {subscription.isTrialing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-medium text-yellow-400">
                <AlertTriangle className="h-3 w-3" />
                Trial: {subscription.trialDaysLeft} days left
              </span>
            )}
            {subscription.status === 'active' && !subscription.isTrialing && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-3 py-1 text-xs font-medium text-green-400">
                <Check className="h-3 w-3" />
                Active
              </span>
            )}
            {subscription.status === 'past_due' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400">
                <X className="h-3 w-3" />
                Past due
              </span>
            )}
            {subscription.status === 'canceled' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-3 py-1 text-xs font-medium text-slate-400">
                Canceled
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-white/[0.04] pt-4">
          <h4 className="mb-3 text-sm font-medium text-slate-300">Usage</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(['hosts', 'snippets', 'vaults', 'keys', 'tabs'] as const).map((resource) => {
              const { current, limit } = subscription.checkLimit(resource);
              const pct = limit >= 999999 ? 0 : Math.min(100, (current / limit) * 100);
              return (
                <div key={resource} className="rounded-md bg-ink-900 p-3">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    {resource}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {current}
                    <span className="text-sm font-normal text-slate-500">
                      {' / '}{limit >= 999999 ? '\u221e' : limit}
                    </span>
                  </div>
                  {limit < 999999 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-accent',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {subscription.plan !== 'free' && (
          <button
            onClick={onManageBilling}
            disabled={portalLoading}
            className="btn-secondary mt-4 w-full"
          >
            {portalLoading ? (
              <Loader className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                View billing portal
              </>
            )}
          </button>
        )}
      </section>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Change plan</h3>
          <div className="flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-ink-900 p-0.5">
            <button
              onClick={() => setBilling('monthly')}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                billing === 'monthly' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                billing === 'annual' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              Annual
              <span className="ml-1 text-[10px] text-terminal-green">-20%</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => {
            const isCurrent = subscription.plan === p.key;
            const isDowngrade = planOrder.indexOf(subscription.plan) > planOrder.indexOf(p.key);
            const price = billing === 'annual' ? p.annualPrice : p.monthlyPrice;

            return (
              <div
                key={p.key}
                className={clsx(
                  'relative rounded-xl border p-4 transition-colors',
                  isCurrent
                    ? 'border-accent bg-accent/5'
                    : p.popular
                    ? 'border-neon/50 bg-ink-800'
                    : 'border-white/[0.04] bg-ink-900 hover:border-white/10',
                )}
              >
                {p.popular && !isCurrent && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-neon px-2 py-0.5 text-[10px] font-medium text-ink-950">
                    Most popular
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-ink-950">
                    Current
                  </span>
                )}

                <h4 className="text-base font-bold text-white">{p.name}</h4>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-white">${price}</span>
                  <span className="text-sm text-slate-400">{p.key === 'free' ? ' forever' : '/mo'}</span>
                </div>
                {billing === 'annual' && p.key !== 'free' && (
                  <p className="text-[11px] text-green-400">${price * 12}/year</p>
                )}

                <ul className="mt-3 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Check className="h-3 w-3 flex-shrink-0 text-green-400" />
                      {f}
                    </li>
                  ))}
                  {p.limitations.map((l) => (
                    <li key={l} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <X className="h-3 w-3 flex-shrink-0 text-slate-600" />
                      {l}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => (isDowngrade ? onDowngrade(p.key) : onUpgrade(p.key))}
                  disabled={isCurrent || checkoutLoading !== null}
                  className={clsx(
                    'mt-4 w-full rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    isCurrent
                      ? 'cursor-default bg-slate-700 text-slate-400'
                      : p.popular
                      ? 'bg-neon text-white hover:bg-neon-600'
                      : 'bg-white/10 text-white hover:bg-white/20',
                  )}
                >
                  {checkoutLoading === p.key ? (
                    <Loader className="mx-auto h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    'Current plan'
                  ) : isDowngrade ? (
                    'Downgrade'
                  ) : p.key === 'free' ? (
                    'Current plan'
                  ) : (
                    'Upgrade'
                  )}
                </button>
              </div>
            );
          })}

          {/* Enterprise card */}
          <div className="relative rounded-xl border border-violet-500/30 bg-gradient-to-b from-violet-500/5 to-ink-900 p-4">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-medium text-white">
              Enterprise
            </span>
            <h4 className="text-base font-bold text-white">Enterprise</h4>
            <div className="mt-1">
              <span className="text-lg font-bold text-violet-300">Custom</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">pricing</p>

            <ul className="mt-3 space-y-1.5">
              {enterpriseFeatures.map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Check className="h-3 w-3 flex-shrink-0 text-violet-400" />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="mailto:support@novossh.com?subject=Enterprise%20Plan%20Inquiry"
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
            >
              <Mail className="h-3.5 w-3.5" />
              Contact sales
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function SAMLTab() {
  const [samlView, setSamlView] = useState<'providers' | 'config'>('providers');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">SAML Single Sign-On</h2>
          <p className="text-sm text-slate-400">Configure SAML 2.0 SSO for your organization.</p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-ink-900 p-0.5">
          <button
            onClick={() => setSamlView('providers')}
            className={clsx(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              samlView === 'providers' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
            )}
          >
            Providers
          </button>
          <button
            onClick={() => setSamlView('config')}
            className={clsx(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              samlView === 'config' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
            )}
          >
            Configuration
          </button>
        </div>
      </div>
      {samlView === 'providers' ? <SAMLProviderList /> : <SAMLConfig />}
    </div>
  );
}

function AboutTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">About</h2>
        <p className="text-sm text-slate-400">NovoSSH Terminal information and links.</p>
      </div>

      <section className="rounded-lg border border-white/[0.04] bg-ink-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 border border-neon/20 shadow-glow-sm">
            <Terminal className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">NovoSSH Terminal</h3>
            <p className="text-xs text-slate-400">Version {import.meta.env.VITE_APP_VERSION}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-300">
          A modern SSH terminal client for web and mobile with host management, port forwarding, vault, and cloud sync.
        </p>
        <div className="mt-4 flex gap-3">
          <a
            href="mailto:support@novossh.com"
            className="btn-ghost flex items-center gap-1.5 text-xs"
          >
            <ExternalLink className="h-3 w-3" />
            Contact support
          </a>
        </div>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex cursor-pointer items-center justify-between rounded-md px-1 py-1" onClick={() => onChange(!checked)}>
      <span className="text-sm text-slate-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
        className={clsx(
          'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          checked ? 'bg-accent' : 'bg-ink-600',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
