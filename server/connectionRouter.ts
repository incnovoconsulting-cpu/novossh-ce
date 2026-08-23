import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

export type ClientType = 'web' | 'electron' | 'ios' | 'android';
export type ConnectionMode = 'direct' | 'tailscale' | 'relay';

export interface ConnectionMetadata {
  clientType: ClientType;
  connectionMode: ConnectionMode;
  supportsDirectConnection: boolean;
  requiresRelay: boolean;
}

function detectClientType(req: IncomingMessage): ClientType {
  const userAgent = req.headers['user-agent'] || '';
  const clientTypeHeader = req.headers['x-client-type'];

  if (clientTypeHeader === 'electron') return 'electron';
  if (clientTypeHeader === 'ios') return 'ios';
  if (clientTypeHeader === 'android') return 'android';

  if (userAgent.includes('ElectronNovoSSH')) return 'electron';
  if (userAgent.includes('NovoSSH/iOS')) return 'ios';
  if (userAgent.includes('NovoSSH/Android')) return 'android';

  return 'web';
}

function isTailscaleAddress(host: string): boolean {
  // Tailscale IPv4 range: 100.x.x.x
  if (/^100\.\d+\.\d+\.\d+$/.test(host)) return true;

  // Tailscale hostname: *.ts.net (exact suffix match to prevent SSRF)
  if (host.endsWith('.ts.net') && !host.includes('..')) return true;

  // Tailscale IPv6: fd7a:115c:...
  if (host.startsWith('fd7a:115c:')) return true;

  return false;
}

function isPrivateIPRange(address: string): boolean {
  if (!address) return false;

  const ipv4Pattern = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const match = address.match(ipv4Pattern);

  if (match) {
    const [, a, b] = match.map(Number);

    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
  }

  if (address === '::1' || address === '::') return true;

  // fc00::/7 (Unique Local Address)
  if (/^f[cd]/i.test(address)) return true;

  // fe80::/10 (Link-local)
  if (/^fe[89ab]/i.test(address)) return true;

  // ::ffff:10.x.x.x (IPv4-mapped private)
  const ipv4MappedMatch = address.match(/^::ffff:(\d+)\.(\d+)\.(\d+)\.(\d+)$/i);
  if (ipv4MappedMatch) {
    const [, aStr, bStr] = ipv4MappedMatch;
    const a = parseInt(aStr, 10);
    const b = parseInt(bStr, 10);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
  }

  return false;
}

export function resolveConnectionRoute(
  clientType: ClientType,
  requestedConnectionMode: string | undefined,
  hostAddress: string,
): ConnectionMetadata {
  const supportsDirectConnection = clientType !== 'web';
  const isTailscale = isTailscaleAddress(hostAddress);
  const isPrivate = isPrivateIPRange(hostAddress);

  let connectionMode: ConnectionMode = 'relay';
  let requiresRelay = true;

  if (requestedConnectionMode === 'direct' && supportsDirectConnection) {
    // Trust an explicit direct request even for a private, non-Tailscale address: this
    // relay is a cloud server with no route to a plain LAN IP that isn't Headscale-enrolled,
    // so forcing relay here just guarantees failure. The client is on the LAN (or not) and
    // is best positioned to judge reachability.
    connectionMode = 'direct';
    requiresRelay = false;
  } else if (requestedConnectionMode === 'tailscale' && isTailscale) {
    connectionMode = 'tailscale';
    // Native clients connect directly via Tailscale/WireGuard (no relay)
    // Web clients need the relay (browsers can't speak WireGuard)
    requiresRelay = !supportsDirectConnection;
  } else if (clientType === 'web' && isPrivate) {
    // Web client cannot connect to private IPs
    connectionMode = 'relay';
    requiresRelay = true;
  } else if (!isPrivate && !isTailscale) {
    // Public host can be direct for native clients
    if (supportsDirectConnection && requestedConnectionMode === 'direct') {
      connectionMode = 'direct';
      requiresRelay = false;
    }
  }

  return {
    clientType,
    connectionMode,
    supportsDirectConnection,
    requiresRelay,
  };
}

export function attachConnectionMetadata(
  ws: WebSocket,
  req: IncomingMessage,
): (hostAddress: string, requestedMode?: string) => ConnectionMetadata {
  const clientType = detectClientType(req);

  return (hostAddress: string, requestedMode?: string): ConnectionMetadata => {
    return resolveConnectionRoute(clientType, requestedMode, hostAddress);
  };
}
