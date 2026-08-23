export type AuthMethod = 'password' | 'key' | 'agent' | 'cert';
export type ConnectionMode = 'direct' | 'tailscale' | 'relay';
export type ClientType = 'web' | 'electron' | 'ios' | 'android';
export type ProxyType = 'socks5' | 'http' | 'none';

export interface ConnectionMetadata {
  clientType: ClientType;
  connectionMode: ConnectionMode;
  supportsDirectConnection: boolean;
  requiresRelay: boolean;
}

export interface ProxyConfig {
  type: ProxyType;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface JumpHost {
  hostId: string;
  order: number;
}

export interface Host {
  id: string;
  label: string;
  address: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password?: string;
  keyId?: string;
  passphrase?: string;
  certificate?: string;
  groupId?: string;
  tags: string[];
  color?: string;
  notes?: string;
  connectionMode?: ConnectionMode;
  identityId?: string;
  jumpHosts?: JumpHost[];
  proxy?: ProxyConfig;
  startupSnippetId?: string;
  autoAttachTmux?: boolean;
  lastConnectedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Group {
  id: string;
  name: string;
  parentId?: string;
  color?: string;
  defaultAuthMethod?: AuthMethod;
  defaultKeyId?: string;
  defaultUsername?: string;
  defaultJumpHosts?: JumpHost[];
  defaultProxy?: ProxyConfig;
  defaultStartupSnippetId?: string;
  defaultTheme?: string;
  createdAt: number;
}

export interface IdentityKey {
  id: string;
  label: string;
  privateKey: string;
  publicKey?: string;
  hasPassphrase: boolean;
  createdAt: number;
}

export interface Identity {
  id: string;
  label: string;
  username: string;
  password?: string;
  keyId?: string;
  createdAt: number;
}

export interface SnippetPackage {
  id: string;
  label: string;
  createdAt: number;
}

export interface Snippet {
  id: string;
  label: string;
  command: string;
  description?: string;
  tags: string[];
  packageId?: string;
  createdAt: number;
  updatedAt: number;
}

export type ForwardingType = 'local' | 'remote' | 'dynamic';

export interface PortForward {
  id: string;
  label: string;
  hostId: string;
  type: 'local' | 'remote' | 'dynamic';
  bindAddress: string;
  bindPort: number;
  destinationHost?: string;
  destinationPort?: number;
  autoStart: boolean;
  active?: boolean;
  category?: string;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ForwardingTemplate {
  id: string;
  name: string;
  description: string;
  type: 'local' | 'remote' | 'dynamic';
  bindPort: number;
  destinationPort: number;
  icon: string;
  category: string;
}

export interface PortForwardingStatus {
  forwardId: string;
  active: boolean;
  connections: number;
  bytesIn: number;
  bytesOut: number;
  error?: string;
}

export type TerminalStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';

export interface VaultConnectParams {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  /** Set when this terminal is part of a recorded team vault session. */
  sessionId?: string;
  vaultId?: string;
}

export interface TerminalTab {
  id: string;
  hostId?: string;
  /** When set, TerminalPane connects using these params instead of looking up a saved host. */
  vaultConnect?: VaultConnectParams;
  title: string;
  status: TerminalStatus;
  createdAt: number;
}

export interface WorkspaceTemplate {
  id: string;
  name: string;
  tabNames: string[];
  hostIds: string[];
  splitView: boolean;
  createdAt: number;
}

export interface SessionLog {
  id: string;
  hostId: string;
  hostLabel: string;
  startedAt: number;
  endedAt?: number;
  commandCount: number;
  bookmarked: boolean;
  bookmarkComment?: string;
}

export type ViewKey = 'hosts' | 'snippets' | 'keys' | 'portforwarding' | 'sftp' | 'history' | 'settings' | 'analytics' | 'logs' | 'portal' | 'notifications' | 'organizations' | 'p2p' | 'security' | 'sessions' | 'vault' | 'wiki' | 'admin';

export interface Settings {
  theme: 'novo-dark' | 'novo-darker' | 'solarized-dark' | 'dracula' | 'one-dark';
  fontSize: number;
  fontFamily: string;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  bellSound: boolean;
  copyOnSelect: boolean;
  pasteOnRightClick: boolean;
  keepAliveSeconds: number;
  tailscaleServerAddress?: string;
}

export const defaultSettings: Settings = {
  theme: 'novo-dark',
  fontSize: 13,
  fontFamily: "'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 5000,
  bellSound: false,
  copyOnSelect: true,
  pasteOnRightClick: true,
  keepAliveSeconds: 30,
  tailscaleServerAddress: import.meta.env.VITE_TAILSCALE_IP,
};

export type PeerConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export interface PeerInfo {
  id: string;
  name: string;
  connectionStatus: PeerConnectionStatus;
  lastSyncedAt?: number;
}

// Mirrors server-side PlaybackFrame type (server/lib/types.ts)
export interface PlaybackFrame {
  type: 'command' | 'output' | 'sync';
  timestamp: number; // milliseconds since session start
  command?: string;
  output?: string;
  userId?: string;
  exitCode?: number;
}

export interface SessionPlaybackData {
  sessionId: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string
  totalDuration: number; // milliseconds
  commandCount: number;
  participantCount: number;
  frames: PlaybackFrame[];
}

// Mirrors server-side Plan type (server/lib/types.ts)
export type Plan = 'free' | 'starter' | 'pro';

export interface Subscription {
  plan: Plan;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  trialEnd?: string;
}

// Mirrors server-side PlanLimits type (server/lib/types.ts)
export interface PlanLimits {
  hosts: number;
  snippets: number;
  vaults: number;
  keys: number;
  tabs: number;
  portForwarding: boolean;
  sftpBrowser: boolean;
  commandPalette: boolean;
  mfa: boolean;
  analytics: boolean;
  p2pSync: boolean;
  sessionRecording: boolean;
  auditLogs: boolean;
  teams: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    hosts: 3, snippets: 10, vaults: 1, keys: 2, tabs: 2,
    portForwarding: false, sftpBrowser: false, commandPalette: false,
    mfa: false, analytics: false, p2pSync: false,
    sessionRecording: false, auditLogs: false, teams: false,
  },
  starter: {
    hosts: 25, snippets: 999999, vaults: 999999, keys: 999999, tabs: 10,
    portForwarding: true, sftpBrowser: true, commandPalette: true,
    mfa: true, analytics: true, p2pSync: false,
    sessionRecording: false, auditLogs: false, teams: false,
  },
  pro: {
    hosts: 999999, snippets: 999999, vaults: 999999, keys: 999999, tabs: 999999,
    portForwarding: true, sftpBrowser: true, commandPalette: true,
    mfa: true, analytics: true, p2pSync: true,
    sessionRecording: true, auditLogs: true, teams: true,
  },
};

export const PRICING = {
  starter: { monthly: 4.99, annual: 3.33 },
  pro: { monthly: 9.99, annual: 6.67 },
} as const;

export type InvoiceStatus = 'paid' | 'pending' | 'failed' | 'voided';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  amount: number;
  currency: string;
  dueDate: string;
  paidDate?: string;
  description?: string;
  invoiceUrl?: string;
  downloadUrl?: string;
  createdAt: string;
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

export interface PaymentMethod {
  id: string;
  brand: CardBrand;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  expMonth?: number;
  expYear?: number;
  holderName?: string;
  isDefault: boolean;
  createdAt: string;
}

export type PortalTab = 'invoices' | 'payment-methods' | 'billing-settings';
