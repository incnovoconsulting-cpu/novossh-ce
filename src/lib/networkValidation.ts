export function isPrivateIPRange(address: string): boolean {
  if (!address) return false;

  const ipv4Pattern = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
  const match = address.match(ipv4Pattern);

  if (match) {
    const [, a, b] = match.map(Number);

    // 10.0.0.0/8
    if (a === 10) return true;

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;

    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
  }

  // IPv6 loopback
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

export function isTailscaleIP(address: string): boolean {
  if (!address) return false;

  // Tailscale IPv4: 100.x.x.x range
  const ipv4Pattern = /^100\.\d+\.\d+\.\d+$/;
  if (ipv4Pattern.test(address)) return true;

  // Tailscale hostname: *.ts.net
  if (address.includes('.ts.net')) return true;

  // Tailscale IPv6: fd7a:115c:a1e0:ab12:4843:cd96:624d:xxxx (starts with fd7a:115c)
  if (address.startsWith('fd7a:115c:')) return true;

  return false;
}

export function isPublicRouteable(address: string): boolean {
  if (!address) return false;

  // Not private and not loopback
  if (isPrivateIPRange(address)) return false;

  // Tailscale is considered routable for web (user has access)
  if (isTailscaleIP(address)) return true;

  // Check for localhost names
  if (address === 'localhost' || address === '127.0.0.1' || address === '::1') return false;

  // Everything else is assumed public if it's a valid hostname or IP
  return true;
}

export function validateWebConnectionMode(address: string, connectionMode: string): {
  valid: boolean;
  reason?: string;
} {
  if (connectionMode !== 'direct') {
    return { valid: true };
  }

  if (isPrivateIPRange(address)) {
    return {
      valid: false,
      reason: 'Direct connections to private IPs are only supported in native clients (Electron, iOS, Android). Use Tailscale or connect from a client on the same network.',
    };
  }

  if (!isPublicRouteable(address)) {
    return {
      valid: false,
      reason: 'Address is not publicly routable. Ensure the host is reachable from this network.',
    };
  }

  return { valid: true };
}

export type ClientType = 'web' | 'electron' | 'ios' | 'android';

export function supportsDirectConnection(clientType: ClientType): boolean {
  return clientType !== 'web';
}
