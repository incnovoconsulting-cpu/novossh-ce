import { useState, useEffect } from 'react';
import {
  Terminal, Shield, Zap, Globe, Key, FolderOpen,
  ArrowRight, Check, Wifi, ArrowRightLeft, Network,
  Monitor, Smartphone, FileCode, KeyRound,
  Lock, Database, Clock, Layers, X, Github, Twitter, Menu,
} from '@/lib/icons';

type Plan = 'free' | 'starter' | 'pro';

interface LandingPageProps {
  onLogin: () => void;
  onSignup: (plan: Plan) => void;
}

const features = [
  {
    icon: Terminal,
    title: 'Full-featured terminal',
    description: 'Split panes, tabs, and autocomplete. A terminal that keeps up with how you work.',
    wide: true,
  },
  {
    icon: FolderOpen,
    title: 'SFTP file browser',
    description: 'Drag-and-drop file transfers with a built-in SFTP browser. No extra tools needed.',
  },
  {
    icon: Key,
    title: 'Encrypted keychain',
    description: 'Generate, store, and share SSH keys and passwords across your team. Always encrypted.',
  },
  {
    icon: Layers,
    title: 'Port forwarding',
    description: 'Local and remote port forwarding with an intuitive visual configuration.',
  },
  {
    icon: Globe,
    title: 'Direct peer-to-peer connections',
    description: 'Connect directly to your servers using open-source WireGuard networking. No cloud proxy, no VPN required.',
  },
  {
    icon: Clock,
    title: 'Session persistence',
    description: 'Sessions survive network drops and sleep/wake cycles. Auto-reconnects with tmux integration.',
  },
];

const platformColors: Record<string, string> = {
  macOS:   'bg-slate-300',
  Linux:   'bg-terminal-amber',
  iOS:     'bg-neon',
  Android: 'bg-terminal-green',
};
const platforms = [
  { name: 'macOS', url: 'https://apps.apple.com/app/novossh/id6478876950' },
  { name: 'Linux', url: 'https://novossh.com' },
  { name: 'iOS', url: 'https://apps.apple.com/app/novossh/id6478876950' },
  { name: 'Android', url: 'https://play.google.com/store/apps/details?id=app.novossh.android' },
];

const testimonials: never[] = [];

const demoScript = [
  {
    prompt: '~ ',
    command: 'ssh user@10.0.0.15 -p 2201',
    output: [
      'Welcome to Ubuntu 22.04.4 LTS (GNU/Linux 5.15.0-105-generic x86_64)',
      'Last login: Mon Jun 10 11:12:43 2025 from 10.0.0.3',
    ],
  },
  {
    prompt: '~ ',
    command: 'docker ps --format "table {{.Names}}\\t{{.Status}}"',
    output: [
      'NAMES        STATUS',
      'nginx        running (3 days)',
      'app-server   running (3 days)',
      'redis        running (3 days)',
      'postgres     running (3 days)',
    ],
  },
  {
    prompt: '~ ',
    command: 'ls -la /var/log/nginx/',
    output: [
      'total 24576',
      'drwxr-xr-x 2 root root     4096 Jun 10 11:00 .',
      'drwxr-xr-x 3 root root     4096 Jun  8 09:15 ..',
      '-rw-r----- 1 root adm  12582912 Jun 10 12:00 access.log',
      '-rw-r----- 1 root adm  12288000 Jun 10 12:00 error.log',
    ],
  },
  {
    prompt: '~ ',
    command: 'cat /etc/nginx/nginx.conf | head -20',
    output: [
      'user www-data;',
      'worker_processes auto;',
      'pid /run/nginx.pid;',
      'include /etc/nginx/modules-enabled/*.conf;',
      '',
      'events {',
      '    worker_connections 1024;',
      '}',
    ],
  },
  {
    prompt: '~ ',
    command: 'uptime',
    output: [' 12:45:03 up 142 days,  3:32,  1 user,  load average: 0.42, 0.38, 0.35'],
  },
];

function TerminalDemo() {
  const [lines, setLines] = useState<Array<{ type: 'command' | 'output' | 'prompt'; text: string; prompt?: string }>>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const cursorInterval = setInterval(() => setShowCursor((c) => !c), 530);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    if (currentStep >= demoScript.length) {
      setIsTyping(false);
      return;
    }

    const step = demoScript[currentStep];

    if (currentChar < step.command.length) {
      const timeout = setTimeout(() => {
        setCurrentChar((c) => c + 1);
      }, 30 + Math.random() * 40);
      return () => clearTimeout(timeout);
    }

    const outputTimeout = setTimeout(() => {
      setLines((prev) => [
        ...prev,
        { type: 'command', text: step.command, prompt: step.prompt },
        ...step.output.map((line) => ({ type: 'output' as const, text: line })),
      ]);
      setCurrentChar(0);
      setCurrentStep((s) => s + 1);
    }, 400);

    return () => clearTimeout(outputTimeout);
  }, [currentStep, currentChar]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900 shadow-glow-lg ring-1 ring-white/[0.04]">
      <div className="flex items-center gap-2 border-b border-white/[0.04] bg-ink-850 px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-terminal-red/80" />
          <div className="h-3 w-3 rounded-full bg-terminal-amber/80" />
          <div className="h-3 w-3 rounded-full bg-terminal-green/80" />
        </div>
        <div className="ml-3 flex gap-1 text-[11px] text-slate-500">
          <span className="rounded bg-ink-700 px-2 py-0.5 text-slate-300">prod-web-01</span>
          <span className="rounded bg-ink-700 px-2 py-0.5">staging-db</span>
          <span className="rounded bg-ink-700 px-2 py-0.5">dev-api</span>
        </div>
      </div>
      <div className="p-5 font-mono text-[13px] leading-relaxed min-h-[280px]">
        {lines.map((line, i) => (
          <div key={i} className={line.type === 'command' ? 'text-terminal-green' : 'text-slate-400'}>
            {line.prompt && <span className="text-neon">{line.prompt}</span>}
            {line.text}
          </div>
        ))}
        {currentStep < demoScript.length && (
          <div className="text-terminal-green">
            <span className="text-neon">{demoScript[currentStep].prompt}</span>
            <span className="text-slate-200">{demoScript[currentStep].command.slice(0, currentChar)}</span>
            <span className={`inline-block h-4 w-2 bg-neon/60 ${showCursor ? 'opacity-100' : 'opacity-0'}`} />
          </div>
        )}
        {!isTyping && (
          <button
            onClick={() => {
              setLines([]);
              setCurrentStep(0);
              setCurrentChar(0);
              setIsTyping(true);
            }}
            className="mt-4 rounded-full border border-white/[0.12] bg-white/5 px-4 py-1.5 text-[11px] text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
          >
            Replay demo
          </button>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, wide }: { icon: any; title: string; description: string; wide?: boolean }) {
  return (
    <div className={`group rounded-xl border border-white/[0.04] bg-ink-850/50 p-6 transition-all duration-300 hover:border-neon/20 hover:bg-ink-800/80 hover:shadow-glow-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-neon/10 text-neon transition-colors group-hover:bg-neon/20">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-slate-100">{title}</h3>
      <p className="text-[13px] leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}

function PricingCard({
  name, price, period, features: feats, limitations, cta, trialNote, popular, proStyle, onSelect,
}: {
  name: string; price: number; period: string; features: string[]; limitations: string[];
  cta: string; trialNote?: string; popular?: boolean; proStyle?: boolean; onSelect: () => void;
}) {
  const ctaClass = popular
    ? 'bg-neon text-ink-950 hover:bg-neon-400 hover:shadow-glow active:scale-[0.98] active:translate-y-px'
    : proStyle
      ? 'border border-white/[0.20] bg-white/8 text-slate-100 hover:bg-white/14 hover:border-white/[0.30] active:scale-[0.98]'
      : 'border border-white/[0.08] bg-white/5 text-slate-200 hover:bg-white/10 hover:border-white/[0.12] active:scale-[0.98]';

  return (
    <div className={`relative flex flex-col rounded-xl border p-6 transition-all duration-300 ${
      popular
        ? 'border-neon/30 bg-ink-800/80 shadow-glow'
        : proStyle
          ? 'border-white/[0.08] bg-ink-850/50 hover:border-white/[0.12]'
          : 'border-white/[0.04] bg-ink-850/50 hover:border-white/[0.08]'
    }`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neon px-3 py-0.5 text-[11px] font-semibold text-ink-950">
          Most popular
        </div>
      )}
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-slate-100">{name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight text-white">${price}</span>
          <span className="text-sm text-slate-500">/{period}</span>
        </div>
      </div>
      <ul className="mb-6 flex-1 space-y-2.5">
        {feats.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[13px] text-slate-300">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon" />
            {f}
          </li>
        ))}
        {limitations.map((l) => (
          <li key={l} className="flex items-start gap-2.5 text-[13px] text-slate-500">
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
            {l}
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        className={`w-full rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ${ctaClass}`}
      >
        {cta}
      </button>
      {trialNote && (
        <p className="mt-2 text-center text-[11px] text-slate-500">{trialNote}</p>
      )}
    </div>
  );
}

export function LandingPage({ onLogin, onSignup }: LandingPageProps) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-fade-in');
          }
        });
      },
      { threshold: 0.08 }
    );
    document.querySelectorAll('[data-animate]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page min-h-[100dvh] bg-ink-950 text-slate-200 overflow-x-hidden">
      {/* Structured data for SEO */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "NovoSSH Terminal",
        "description": "Modern SSH terminal client for macOS, Windows, Linux, iOS, and Android. Manage hosts, transfer files, share credentials, and collaborate with your team.",
        "url": "https://novossh.com",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "macOS, Windows, Linux, iOS, Android",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free tier available"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "ratingCount": "150"
        }
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is NovoSSH?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "NovoSSH is a modern SSH terminal client available on macOS, Windows, Linux, iOS, and Android. It provides secure remote server access with SFTP, port forwarding, team collaboration, and encrypted credential storage."
            }
          },
          {
            "@type": "Question",
            "name": "Is NovoSSH free?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes, NovoSSH has a free tier with 3 hosts, 5 snippets, 1 vault, and 2 SSH keys. Paid plans start at $3.33/month."
            }
          },
          {
            "@type": "Question",
            "name": "How does NovoSSH compare to Termius?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "NovoSSH offers end-to-end encrypted vaults, direct peer-to-peer SSH connections, and a web client. It also has a generous free tier and supports SSH certificates on all platforms."
            }
          },
          {
            "@type": "Question",
            "name": "Is NovoSSH secure?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "All SSH credentials are encrypted on your device using AES-256. NovoSSH never transmits private keys or passwords to our servers."
            }
          },
          {
            "@type": "Question",
            "name": "What platforms does NovoSSH support?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "NovoSSH works on macOS, Windows, Linux (via web browser), iOS, and Android."
            }
          }
        ]
      }) }} />

      {/* Floating island nav */}
      <div className="fixed top-5 left-0 right-0 z-50 flex justify-center px-4">
        <nav className="flex w-full max-w-3xl items-center justify-between rounded-full border border-white/[0.08] bg-ink-900/90 px-4 py-2 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neon/15 text-neon">
              <Terminal className="h-3.5 w-3.5" />
            </div>
            <span className="text-[14px] font-bold tracking-tight text-white">NovoSSH</span>
          </div>
          <div className="hidden items-center gap-5 md:flex">
            <a href="#features" className="text-[13px] text-slate-400 transition-colors hover:text-white">Features</a>
            <a href="#security" className="text-[13px] text-slate-400 transition-colors hover:text-white">Security</a>
            <a href="#faq" className="text-[13px] text-slate-400 transition-colors hover:text-white">FAQ</a>
            <a href="#pricing" className="text-[13px] text-slate-400 transition-colors hover:text-white">Pricing</a>
            <button onClick={onLogin} className="text-[13px] text-slate-300 transition-colors hover:text-white">Log in</button>
            <button
              onClick={() => onSignup('free')}
              className="rounded-full bg-neon px-4 py-1.5 text-[13px] font-semibold text-ink-950 transition-all hover:bg-neon-400 hover:shadow-glow active:scale-[0.98]"
            >
              Start free
            </button>
          </div>
          <button
            className="md:hidden text-slate-400 hover:text-white transition-colors p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-ink-950/98 px-6 pt-24 backdrop-blur-xl">
          <div className="flex flex-col gap-6">
            <a href="#features" className="text-xl font-medium text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#security" className="text-xl font-medium text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Security</a>
            <a href="#faq" className="text-xl font-medium text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <a href="#pricing" className="text-xl font-medium text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <button onClick={() => { onLogin(); setMobileMenuOpen(false); }} className="text-left text-xl font-medium text-slate-300 hover:text-white">Log in</button>
            <button onClick={() => { onSignup('free'); setMobileMenuOpen(false); }} className="mt-2 w-full rounded-full bg-neon py-3 text-base font-semibold text-ink-950">Start free</button>
          </div>
        </div>
      )}

      {/* Hero — editorial split */}
      <section className="relative min-h-[100dvh] pt-24 pb-16 sm:pt-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_60%_30%,rgba(0,229,255,0.06),transparent)]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <div className="relative mx-auto flex min-h-[calc(100dvh-6rem)] max-w-6xl flex-col items-center justify-center gap-12 px-4 sm:px-6 lg:flex-row lg:gap-16">
          {/* Left column */}
          <div className={`flex max-w-lg flex-col lg:flex-1 transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-neon/20 bg-neon/5 px-3 py-1 text-[11px] font-medium text-neon tracking-wide">
              <Check className="h-3 w-3" />
              Free tier available
            </div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              Your infrastructure.<br />
              <span className="text-neon">One terminal.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-400">
              Manage hosts, transfer files, share credentials, and collaborate with your team — all from a single, secure SSH client with direct peer-to-peer connections.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => onSignup('free')}
                className="flex items-center justify-center gap-2 rounded-full bg-neon px-6 py-3 text-sm font-semibold text-ink-950 transition-all hover:bg-neon-400 hover:shadow-glow active:scale-[0.98] active:translate-y-px"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={onLogin}
                className="flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/4 px-6 py-3 text-sm font-medium text-slate-200 transition-all hover:bg-white/8 hover:border-white/[0.20] active:scale-[0.98]"
              >
                Log in
              </button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-slate-500">
              {platforms.map((p) => (
                <span key={p.name} className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${platformColors[p.name]}`} />
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">{p.name}</a>
                  ) : (
                    p.name
                  )}
                </span>
              ))}
            </div>
          </div>
          {/* Right column — terminal mockup */}
          <div className={`w-full lg:flex-1 transition-all duration-700 delay-150 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <TerminalDemo />
          </div>
        </div>
      </section>

      {/* Features — asymmetric bento */}
      <section id="features" className="py-16 sm:py-24" data-animate>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 lg:mb-16">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neon">Features</div>
            <h2 className="max-w-lg text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Everything you need. Nothing you don't.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
              A complete SSH toolkit built for speed, security, and collaboration.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* Features showcase */}
      <section className="border-y border-white/[0.04] bg-ink-900/30 py-16 sm:py-24" data-animate>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 lg:mb-16">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neon">Built for modern infrastructure</div>
            <h2 className="max-w-lg text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Built for modern infrastructure
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
              A complete SSH toolkit that runs anywhere — browser, desktop, or mobile.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'SSH Terminal',
                desc: 'Full xterm.js terminal with 256-color support, custom fonts, tabs, and tmux auto-attach. Connect to any server from any device.',
                icon: Terminal,
              },
              {
                title: 'SFTP Browser',
                desc: 'Drag-and-drop file transfers with a visual directory browser. Upload, download, rename, and manage files without leaving the terminal.',
                icon: FolderOpen,
              },
              {
                title: 'Encrypted Vaults',
                desc: 'End-to-end encrypted storage for hosts, credentials, and keys. Only you can decrypt — not even we can read your data.',
                icon: Lock,
              },
              {
                title: 'Peer-to-Peer SSH',
                desc: 'Direct WireGuard connections between your devices. No relay server, no bottleneck. Your traffic never touches our infrastructure.',
                icon: Wifi,
              },
              {
                title: 'Port Forwarding',
                desc: 'Local and remote port forwarding with a visual wizard. Tunnel database connections, web servers, or any TCP service through SSH.',
                icon: ArrowRightLeft,
              },
              {
                title: 'Team Collaboration',
                desc: 'Share vaults with granular permissions. Real-time session visibility, audit logs, and consolidated billing for teams of any size.',
                icon: Network,
              },
              {
                title: 'Session Recording',
                desc: 'Record and replay terminal sessions for compliance, debugging, or training. Search through command history across all sessions.',
                icon: Monitor,
              },
              {
                title: 'SSH Certificates',
                desc: 'Full certificate-based authentication. Sign keys with your CA and connect without managing authorized_keys on every server.',
                icon: Shield,
              },
              {
                title: 'Multi-Platform',
                desc: 'Web app in any browser, native apps for macOS, iOS, Android, and Windows. One account, every device, seamless sync.',
                icon: Smartphone,
              },
              {
                title: 'Host Groups',
                desc: 'Organize servers by environment, team, or project. Apply default credentials and settings at the group level.',
                icon: Layers,
              },
              {
                title: 'Command Snippets',
                desc: 'Save and reuse frequently-run commands. Execute across multiple tabs or share with your team.',
                icon: FileCode,
              },
              {
                title: 'WebAuthn & MFA',
                desc: 'Hardware security keys, biometrics, and TOTP two-factor authentication. SAML SSO for enterprise identity providers.',
                icon: KeyRound,
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/[0.06] bg-ink-850/50 p-5 transition-colors hover:border-neon/20 hover:bg-ink-800/50"
              >
                <feature.icon className="mb-3 h-5 w-5 text-neon" />
                <h3 className="mb-1.5 text-[14px] font-semibold text-white">{feature.title}</h3>
                <p className="text-[12px] leading-relaxed text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vault section — editorial split */}
      <section className="py-16 sm:py-24" data-animate>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_420px] lg:gap-20">
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neon">Encrypted vault</div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Your team's single source of truth
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
                Store hosts, credentials, and SSH keys in end-to-end encrypted vaults. Share selectively with granular permissions. Everything syncs across every device.
              </p>
              <ul className="mt-7 space-y-3.5">
                {[
                  'End-to-end encryption — only you can decrypt',
                  'Granular vault permissions per team member',
                  'Instant sync across macOS, Linux, iOS, Android',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-slate-300">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Double-bezel vault UI mockup */}
            <div className="relative">
              <div className="rounded-2xl border border-white/[0.08] bg-ink-900/80 p-1.5 ring-1 ring-white/[0.04] shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
                <div className="rounded-[calc(1rem-2px)] border border-white/[0.04] bg-ink-850 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                  <div className="mb-3 flex items-center gap-2 text-[11px] text-slate-500">
                    <Lock className="h-3 w-3" /> Team Vault
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { name: 'prod-web-01', tags: ['ssh', 'prod'], color: 'bg-terminal-green' },
                      { name: 'staging-db', tags: ['ssh', 'db'], color: 'bg-terminal-amber' },
                      { name: 'dev-api', tags: ['ssh', 'dev'], color: 'bg-neon' },
                      { name: 'backup-s3', tags: ['ssh', 'backup'], color: 'bg-terminal-red' },
                    ].map((h) => (
                      <div key={h.name} className="flex items-center justify-between rounded-lg bg-ink-800/60 px-3 py-2.5 transition-colors hover:bg-ink-750">
                        <div className="flex items-center gap-2">
                          <div className={`h-1.5 w-1.5 rounded-full ${h.color}`} />
                          <span className="text-[13px] text-slate-200">{h.name}</span>
                        </div>
                        <div className="flex gap-1">
                          {h.tags.map((t) => (
                            <span key={t} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">{t}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 h-32 w-32 rounded-full bg-neon/5 blur-3xl pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* Security — editorial layout, not 3 equal cards */}
      <section id="security" className="border-y border-white/[0.04] bg-ink-900/30 py-16 sm:py-24" data-animate>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[380px_1fr] lg:gap-20">
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neon">Security</div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Built for security-conscious teams
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">
                All connections protected with industry-standard encryption. Direct peer-to-peer connections powered by open-source networking. No cloud proxy, no data exposure.
              </p>
              <button
                onClick={() => onSignup('starter')}
                className="mt-8 flex items-center gap-2 text-[13px] font-medium text-neon transition-colors hover:text-neon-400"
              >
                See security docs <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Shield,
                  title: 'End-to-end encryption',
                  desc: 'Vault data is encrypted on your device. We never see your plaintext credentials or keys.',
                },
                {
                  icon: Lock,
                  title: 'Direct peer-to-peer connections',
                  desc: 'Connect directly to your servers using open-source WireGuard networking. No cloud proxy, no third-party VPN required.',
                },
                {
                  icon: Database,
                  title: 'Local-first architecture',
                  desc: 'Credentials stored locally with optional encrypted sync. Works offline without compromise.',
                },
                {
                  icon: Zap,
                  title: 'Zero-knowledge vault',
                  desc: 'Encryption keys never leave your device. Not even NovoSSH can read your stored credentials.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-white/[0.04] bg-ink-850/50 p-5 transition-all duration-200 hover:border-white/[0.08]">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-neon/10 text-neon">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <h3 className="mb-1.5 text-[14px] font-semibold text-slate-100">{item.title}</h3>
                  <p className="text-[12px] leading-relaxed text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works — SEO-rich content */}
      <section className="py-16 sm:py-24" data-animate>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 lg:mb-16">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neon">How it works</div>
            <h2 className="max-w-lg text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Connect to any server in three steps
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { step: '01', title: 'Add your host', desc: 'Enter the server address, port, and credentials. NovoSSH stores them encrypted on your device — never transmitted to our servers.' },
              { step: '02', title: 'Connect securely', desc: 'Tap to connect via SSH with end-to-end encryption. Install the Network Client for direct peer-to-peer connections, or use server relay for the web.' },
              { step: '03', title: 'Manage everything', desc: 'Transfer files with SFTP, set up port forwarding, run commands, and collaborate with your team — all from one terminal.' },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-white/[0.06] bg-ink-850/50 p-6">
                <div className="mb-3 text-[11px] font-semibold text-neon">{item.step}</div>
                <h3 className="mb-2 text-[15px] font-semibold text-white">{item.title}</h3>
                <p className="text-[13px] leading-relaxed text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases — SEO keyword-rich content */}
      <section className="border-y border-white/[0.04] bg-ink-900/30 py-16 sm:py-24" data-animate>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 lg:mb-16">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neon">Use cases</div>
            <h2 className="max-w-lg text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Built for every workflow
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'DevOps & SRE', desc: 'Manage production servers, monitor deployments, and respond to incidents from your phone. SSH terminal with full PTY support.' },
              { title: 'Cloud Infrastructure', desc: 'Connect to AWS, GCP, Azure, and Oracle Cloud instances. Manage Kubernetes clusters and Docker containers via SSH.' },
              { title: 'Security Teams', desc: 'Audit SSH access with session recording, enforce MFA with hardware keys, and manage credentials with end-to-end encryption.' },
              { title: 'Database Administration', desc: 'Port forwarding for MySQL, PostgreSQL, and Redis. SFTP for backup transfers. Secure tunneling for remote database access.' },
              { title: 'Freelancers & Consultants', desc: 'Access client servers securely from anywhere. Share credentials with team members using encrypted vaults.' },
              { title: 'Education & Training', desc: 'Teach server administration with live terminal sharing. Record sessions for training materials.' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-white/[0.06] bg-ink-850/50 p-5">
                <h3 className="mb-2 text-[14px] font-semibold text-white">{item.title}</h3>
                <p className="text-[12px] leading-relaxed text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — SEO-rich content */}
      <section id="faq" className="py-16 sm:py-24" data-animate>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-12">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neon">FAQ</div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-4">
            {[
              { q: 'What is NovoSSH?', a: 'NovoSSH is a modern SSH terminal client available on macOS, Windows, Linux, iOS, and Android. It provides secure remote server access with features like SFTP, port forwarding, team collaboration, and encrypted credential storage.' },
              { q: 'Is NovoSSH free?', a: 'Yes, NovoSSH has a free tier with 3 hosts, 5 snippets, 1 vault, and 2 SSH keys. Paid plans start at $3.33/month for more hosts, unlimited storage, and advanced features.' },
              { q: 'How does NovoSSH compare to Termius?', a: 'NovoSSH offers end-to-end encrypted vaults, direct peer-to-peer SSH connections, and a web client — features Termius lacks. NovoSSH also has a generous free tier.' },
              { q: 'Is my data secure?', a: 'All SSH credentials are encrypted on your device using AES-256. NovoSSH never transmits your private keys or passwords to our servers. Cloud sync uses end-to-end encryption.' },
              { q: 'What platforms are supported?', a: 'NovoSSH works on macOS, Windows, Linux (via web browser), iOS, and Android. Native apps are available for all mobile platforms and Windows via Tauri.' },
              { q: 'Can I use SSH certificates?', a: 'Yes, NovoSSH supports OpenSSH certificate-based authentication on all platforms. Sign keys with your CA and connect without managing authorized_keys.' },
            ].map((item) => (
              <details key={item.q} className="rounded-xl border border-white/[0.06] bg-ink-850/50 p-5">
                <summary className="cursor-pointer text-[14px] font-semibold text-white">{item.q}</summary>
                <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-white/[0.04] py-16 sm:py-24" data-animate>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 sm:mb-12">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-neon">Pricing</div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-sm text-slate-400 sm:text-base">
              Start free. Upgrade when you need more.
            </p>
            <div className="mt-6 inline-flex items-center gap-3">
              <div className="inline-flex items-center gap-1 rounded-full bg-ink-800 p-1">
                <button
                  onClick={() => setBilling('monthly')}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all ${
                    billing === 'monthly' ? 'bg-ink-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling('annual')}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all ${
                    billing === 'annual' ? 'bg-ink-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Annual
                </button>
              </div>
              {billing === 'annual' && (
                <span className="rounded-full border border-neon/30 bg-neon/10 px-2.5 py-0.5 text-[11px] font-semibold text-neon">
                  Save ~33%
                </span>
              )}
            </div>
          </div>
          <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-3">
            <PricingCard
              name="Free"
              price={0}
              period="mo"
              features={['3 hosts', '5 snippets', '1 vault', '1 SSH key', '2 tabs']}
              limitations={['No port forwarding', 'No P2P sync', 'No teams']}
              cta="Get started"
              onSelect={() => onSignup('free')}
            />
            <PricingCard
              name="Starter"
              price={billing === 'annual' ? 3.33 : 4.99}
              period="mo"
              features={['25 hosts', '50 snippets', '10 vaults', '10 SSH keys', '10 tabs', 'Port forwarding']}
              limitations={['No P2P sync', 'No teams']}
              cta="Start 7-day trial"
              trialNote="No card required"
              popular
              onSelect={() => onSignup('starter')}
            />
            <PricingCard
              name="Pro"
              price={billing === 'annual' ? 6.67 : 9.99}
              period="mo"
              features={[
                'Unlimited hosts',
                'Unlimited vaults & keys',
                'Unlimited snippets & tabs',
                'Port forwarding',
                'P2P sync',
                'Teams & collaboration',
                'Session recording',
                'Audit logs & compliance',
              ]}
              limitations={[]}
              cta="Start 7-day trial"
              trialNote="No card required"
              proStyle
              onSelect={() => onSignup('pro')}
            />
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-16 sm:py-24" data-animate>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-neon/15 bg-ink-850 px-8 py-16 sm:px-16 sm:py-20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_70%_50%,rgba(0,229,255,0.05),transparent)]" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Ready to upgrade your workflow?
                </h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
                  Join engineers at every scale who manage their infrastructure with NovoSSH.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <button
                  onClick={() => onSignup('free')}
                  className="flex items-center justify-center gap-2 rounded-full bg-neon px-6 py-3 text-sm font-semibold text-ink-950 transition-all hover:bg-neon-400 hover:shadow-glow active:scale-[0.98] active:translate-y-px"
                >
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={onLogin}
                  className="flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/4 px-6 py-3 text-sm font-medium text-slate-200 transition-all hover:bg-white/8 hover:border-white/[0.20] active:scale-[0.98]"
                >
                  Log in
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.04] bg-ink-950 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-neon/15 text-neon">
                <Terminal className="h-3.5 w-3.5" />
              </div>
              <span className="text-[13px] font-semibold text-white">NovoSSH</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-slate-500">
              <a href="#features" className="hover:text-slate-300 transition-colors">Features</a>
              <a href="#security" className="hover:text-slate-300 transition-colors">Security</a>
              <a href="#pricing" className="hover:text-slate-300 transition-colors">Pricing</a>
              <a href="mailto:support@novossh.com" className="hover:text-slate-300 transition-colors">Support</a>
              <a href="/privacy" className="hover:text-slate-300 transition-colors">Privacy policy</a>
              <a href="/terms" className="hover:text-slate-300 transition-colors">Terms of service</a>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://github.com/incnovoconsulting-cpu/NovoSSH" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 transition-colors">
                <Github className="h-4 w-4" />
              </a>
              <a href="https://twitter.com/novossh" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
              <span className="text-[12px] text-slate-600">&copy; 2026 NovoConsulting Inc.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
