import { useState, useEffect } from 'react';
import { Plus, Command, Github, BookOpen, Zap, Lock, Shield, Wifi, Globe, Server } from '@/lib/icons';
import { AppLogo } from '../AppLogo';
import { useStore } from '../../lib/store';
import { colorFor, initials, timeAgo } from '../../lib/format';
import { useSubscription } from '../../hooks/useSubscription';

function SkeletonCard() {
  return (
    <div className="rounded-lg bg-ink-800/60 border border-white/[0.04] p-4 animate-pulse">
      <div className="h-4 bg-ink-700 rounded w-1/3 mb-3" />
      <div className="h-3 bg-ink-700 rounded w-2/3 mb-2" />
      <div className="h-3 bg-ink-700 rounded w-1/2" />
    </div>
  )
}

export function HostsHomeView() {
  const hosts = useStore((s) => s.hosts);
  const openTab = useStore((s) => s.openTab);
  const setView = useStore((s) => s.setView);
  const { checkLimit } = useSubscription();
  const hostLimit = checkLimit('hosts');

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const recent = [...hosts]
    .filter((h) => h.lastConnectedAt)
    .sort((a, b) => (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0))
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center">
          <AppLogo className="h-10 w-10" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
            <span className="text-neon">~</span>/novossh-terminal
          </h1>
          <p className="text-xs text-slate-500 font-mono">Secure Terminal Client</p>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {!loading && hosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Server className="h-12 w-12 text-slate-600 mb-4" />
          <h2 className="text-lg text-slate-400 font-medium mb-1">No hosts configured</h2>
          <p className="text-sm text-slate-500 mb-4">Add your first SSH host to get started</p>
          <button
            onClick={() => {
              const evt = new KeyboardEvent('keydown', { key: 'N', shiftKey: true, ctrlKey: true });
              window.dispatchEvent(evt);
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> Add host
          </button>
        </div>
      )}

      {!loading && hosts.length > 0 && (<>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
        {hostLimit.allowed ? (
          <ActionCard
            icon={<Plus className="h-4 w-4" />}
            title="New host"
            desc="Save a server connection"
            shortcut="⇧⌘N"
            onClick={() => {
              const evt = new KeyboardEvent('keydown', { key: 'N', shiftKey: true, ctrlKey: true });
              window.dispatchEvent(evt);
            }}
          />
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-terminal-amber/20 bg-terminal-amber/[0.04] p-3 text-left">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-terminal-amber/10 text-terminal-amber">
              <Lock className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1">
              <span className="text-sm font-medium text-terminal-amber">Host limit reached</span>
              <span className="mt-0.5 block text-xs text-terminal-amber/60">
                {hostLimit.current}/{hostLimit.limit} hosts
                <button onClick={() => { useStore.getState().setView('settings'); useStore.getState().setSettingsTab('subscription'); }} className="ml-1 underline hover:text-terminal-amber">Upgrade</button>
              </span>
            </span>
          </div>
        )}
        <ActionCard
          icon={<Command className="h-4 w-4" />}
          title="Command palette"
          desc="Search and run actions"
          shortcut="⌘K"
          onClick={() => {
            const evt = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
            window.dispatchEvent(evt);
          }}
          compact
        />
        <ActionCard
          icon={<AppLogo className="h-4 w-4" />}
          title="Local shell"
          desc="Open a terminal tab"
          onClick={() => openTab()}
          compact
        />
      </div>

      <section className="mt-8 rounded-lg border border-white/[0.04] bg-ink-800/40 p-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-[0.08em] mb-4">Quick start</h3>
        <div className="flex flex-col gap-0">
          <GuideStep
            number={1}
            icon={<Wifi className="h-3.5 w-3.5 text-neon" />}
            title="Install Tailscale"
            desc="Install Tailscale on both this device and your target server. Sign in with the same account."
          />
          <div className="ml-2.5 w-px h-3 bg-white/[0.06]" />
          <GuideStep
            number={2}
            icon={<Shield className="h-3.5 w-3.5 text-neon" />}
            title="Copy Tailscale IP"
            desc="Run <code class='text-neon/80 bg-neon/5 rounded px-1'>tailscale ip -4</code> on your server to get its Tailscale IP."
          />
          <div className="ml-2.5 w-px h-3 bg-white/[0.06]" />
          <GuideStep
            number={3}
            icon={<Globe className="h-3.5 w-3.5 text-neon" />}
            title="Add host"
            desc="Click New host, paste the Tailscale IP, set username &amp; auth method. Connection mode defaults to Tailscale."
          />
        </div>
        <p className="mt-4 text-xs text-slate-500/60 border-t border-white/[0.04] pt-3">
          Don't have Tailscale? Use <span className="text-slate-400">Direct via Server</span> mode for any publicly reachable host.
        </p>
      </section>

      {recent.length > 0 && (
        <section className="mt-8">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500/60">
              Recently connected
            </h2>
            <button
              onClick={() => setView('history')}
              className="text-xs text-neon/60 hover:text-neon transition-colors font-mono"
            >
              history &rarr;
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((h) => {
              const color = h.color ?? colorFor(h.label);
              return (
                <button
                  key={h.id}
                  onClick={() => openTab(h.id)}
                  className="flex items-center gap-2.5 rounded-lg border border-white/[0.04] bg-ink-800/60 p-2.5 text-left transition-all duration-150 hover:bg-ink-800 hover:border-white/[0.08] hover:shadow-glow-sm group"
                >
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-bold text-white/90 ring-1 ring-white/[0.06]"
                    style={{ background: color }}
                  >
                    {initials(h.label)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-200">{h.label}</div>
                    <div className="truncate text-xs text-slate-500/60 font-mono">
                      {h.username}@{h.address}
                      <span className="text-slate-700/50 mx-1">/</span>
                      {timeAgo(h.lastConnectedAt)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr_200px]">
        <FeatureCard
          icon={<Zap className="h-3.5 w-3.5 text-terminal-amber" />}
          title="Snippets"
          desc="Save and reuse commands across hosts"
        />
        <FeatureCard
          icon={<BookOpen className="h-3.5 w-3.5 text-terminal-green" />}
          title="Keychain"
          desc="Manage SSH keys with passphrase support"
        />
        <FeatureCard
          icon={<Github className="h-3.5 w-3.5 text-slate-400" />}
          title="Secure"
          desc="Credentials stay local"
        />
      </section>
      </>
      )}
    </div>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  shortcut,
  onClick,
  compact,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  shortcut?: string;
  onClick?: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="group flex flex-col items-center justify-center gap-1.5 rounded-lg border border-white/[0.04] bg-ink-800/60 px-4 py-3 text-center transition-all duration-150 hover:bg-ink-800 hover:border-white/[0.08] hover:shadow-glow-sm min-w-[80px]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neon/[0.08] text-neon/80 group-hover:text-neon">
          {icon}
        </span>
        <span className="text-xs font-medium text-slate-300 whitespace-nowrap">{title}</span>
        {shortcut && (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">{shortcut}</span>
        )}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-2.5 rounded-lg border border-white/[0.04] bg-ink-800/60 p-3 text-left transition-all duration-150 hover:bg-ink-800 hover:border-white/[0.08] hover:shadow-glow-sm"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neon/[0.08] text-neon/80 group-hover:text-neon">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-200">{title}</span>
          {shortcut && (
            <span className="flex-shrink-0 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">{shortcut}</span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-slate-500/60">{desc}</span>
      </span>
    </button>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-white/[0.04] bg-ink-800/40 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
        {icon} {title}
      </div>
      <p className="mt-1 text-sm text-slate-500/60 leading-relaxed">{desc}</p>
    </div>
  );
}

function renderSafeHtml(html: string): string {
  const codeRegex = /<code class='([^']*)'>([^<]*)<\/code>/g;
  const codes: { cls: string; text: string }[] = [];
  let match;
  while ((match = codeRegex.exec(html)) !== null) {
    codes.push({ cls: match[1], text: match[2] });
  }
  let safe = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  codes.forEach((code) => {
    const escaped = `&lt;code class='${code.cls}'&gt;${code.text}&lt;/code&gt;`;
    safe = safe.replace(escaped, `<code class="${code.cls}">${code.text}</code>`);
  });
  return safe;
}

function GuideStep({
  number,
  icon,
  title,
  desc,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-2.5">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-neon/10 text-[10px] font-bold text-neon">
        {number}
      </div>
      <div className="min-w-0">
        <p
          className="text-sm text-slate-400 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderSafeHtml(desc) }}
        />
      </div>
    </div>
  );
}

function FeatureTip({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/[0.04] bg-ink-850/50 p-5">
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-300">
        {icon} {title}
      </div>
      <p
        className="mt-0.5 text-sm text-slate-500/60 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderSafeHtml(desc) }}
      />
    </div>
  );
}
