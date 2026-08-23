import { describe, it, expect } from 'vitest';
import {
  isPrivateIPRange,
  isTailscaleIP,
  isPublicRouteable,
  validateWebConnectionMode,
  supportsDirectConnection,
} from '../networkValidation';

describe('networkValidation', () => {
  describe('isPrivateIPRange', () => {
    describe('IPv4 private ranges', () => {
      it('detects 10.0.0.0/8', () => {
        expect(isPrivateIPRange('10.0.0.1')).toBe(true);
        expect(isPrivateIPRange('10.255.255.255')).toBe(true);
        expect(isPrivateIPRange('10.0.0.0')).toBe(true);
        expect(isPrivateIPRange('10.1.2.3')).toBe(true);
      });

      it('detects 172.16.0.0/12', () => {
        expect(isPrivateIPRange('172.16.0.0')).toBe(true);
        expect(isPrivateIPRange('172.31.255.255')).toBe(true);
        expect(isPrivateIPRange('172.20.10.5')).toBe(true);
      });

      it('rejects non-private 172.x', () => {
        expect(isPrivateIPRange('172.15.0.0')).toBe(false);
        expect(isPrivateIPRange('172.32.0.0')).toBe(false);
        expect(isPrivateIPRange('172.0.0.1')).toBe(false);
      });

      it('detects 192.168.0.0/16', () => {
        expect(isPrivateIPRange('192.168.0.1')).toBe(true);
        expect(isPrivateIPRange('192.168.255.255')).toBe(true);
        expect(isPrivateIPRange('192.168.1.100')).toBe(true);
      });

      it('rejects non-private 192.x', () => {
        expect(isPrivateIPRange('192.167.0.1')).toBe(false);
        expect(isPrivateIPRange('192.169.0.1')).toBe(false);
      });

      it('detects 127.0.0.0/8 (loopback)', () => {
        expect(isPrivateIPRange('127.0.0.1')).toBe(true);
        expect(isPrivateIPRange('127.255.255.255')).toBe(true);
        expect(isPrivateIPRange('127.0.0.2')).toBe(true);
      });

      it('detects 169.254.0.0/16 (link-local)', () => {
        expect(isPrivateIPRange('169.254.0.1')).toBe(true);
        expect(isPrivateIPRange('169.254.255.255')).toBe(true);
        expect(isPrivateIPRange('169.254.169.254')).toBe(true);
      });
    });

    describe('IPv6 private ranges', () => {
      it('detects ::1 (loopback)', () => {
        expect(isPrivateIPRange('::1')).toBe(true);
      });

      it('detects :: (unspecified)', () => {
        expect(isPrivateIPRange('::')).toBe(true);
      });

      it('detects fc00::/7 (Unique Local Address)', () => {
        expect(isPrivateIPRange('fc00::1')).toBe(true);
        expect(isPrivateIPRange('fd00::1')).toBe(true);
        expect(isPrivateIPRange('fd12:3456:789a::1')).toBe(true);
        expect(isPrivateIPRange('fc00::')).toBe(true);
      });

      it('detects fe80::/10 (link-local)', () => {
        expect(isPrivateIPRange('fe80::1')).toBe(true);
        expect(isPrivateIPRange('fe80::abcd:1234')).toBe(true);
        expect(isPrivateIPRange('fe80::1')).toBe(true);
        expect(isPrivateIPRange('fe9a::1')).toBe(true);
        expect(isPrivateIPRange('feb0::1')).toBe(true);
      });

      it('rejects non-private IPv6', () => {
        expect(isPrivateIPRange('2001:db8::1')).toBe(false);
        expect(isPrivateIPRange('2607:f8b0:4004:800::200e')).toBe(false);
        expect(isPrivateIPRange('ff02::1')).toBe(false);
      });
    });

    describe('IPv4-mapped IPv6 private ranges', () => {
      it('detects ::ffff:10.x.x.x', () => {
        expect(isPrivateIPRange('::ffff:10.0.0.1')).toBe(true);
        expect(isPrivateIPRange('::ffff:10.255.255.255')).toBe(true);
      });

      it('detects ::ffff:172.16-31.x.x', () => {
        expect(isPrivateIPRange('::ffff:172.16.0.1')).toBe(true);
        expect(isPrivateIPRange('::ffff:172.31.255.255')).toBe(true);
      });

      it('detects ::ffff:192.168.x.x', () => {
        expect(isPrivateIPRange('::ffff:192.168.1.1')).toBe(true);
      });

      it('detects ::ffff:127.x.x.x', () => {
        expect(isPrivateIPRange('::ffff:127.0.0.1')).toBe(true);
      });

      it('rejects non-private IPv4-mapped', () => {
        expect(isPrivateIPRange('::ffff:8.8.8.8')).toBe(false);
        expect(isPrivateIPRange('::ffff:172.15.0.1')).toBe(false);
        expect(isPrivateIPRange('::ffff:172.32.0.1')).toBe(false);
      });
    });

    describe('public IPs', () => {
      it('returns false for public IPs', () => {
        expect(isPrivateIPRange('8.8.8.8')).toBe(false);
        expect(isPrivateIPRange('1.1.1.1')).toBe(false);
        expect(isPrivateIPRange('203.0.113.1')).toBe(false);
        expect(isPrivateIPRange('198.51.100.1')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('returns false for empty string', () => {
        expect(isPrivateIPRange('')).toBe(false);
      });

      it('returns false for hostname', () => {
        expect(isPrivateIPRange('example.com')).toBe(false);
        expect(isPrivateIPRange('localhost')).toBe(false);
      });

      it('returns false for malformed IP', () => {
        expect(isPrivateIPRange('999.999.999.999')).toBe(false);
        expect(isPrivateIPRange('1.2.3')).toBe(false);
        expect(isPrivateIPRange('1.2.3.4.5')).toBe(false);
      });
    });
  });

  describe('isTailscaleIP', () => {
    describe('Tailscale IPv4 (100.x.x.x)', () => {
      it('detects Tailscale IPv4 addresses', () => {
        expect(isTailscaleIP('100.64.0.1')).toBe(true);
        expect(isTailscaleIP('100.127.255.255')).toBe(true);
        expect(isTailscaleIP('100.0.0.1')).toBe(true);
        expect(isTailscaleIP('100.255.255.255')).toBe(true);
      });
    });

    describe('Tailscale hostname (.ts.net)', () => {
      it('detects Tailscale hostnames', () => {
        expect(isTailscaleIP('myhost.ts.net')).toBe(true);
        expect(isTailscaleIP('example.ts.net')).toBe(true);
        expect(isTailscaleIP('a.ts.net')).toBe(true);
        expect(isTailscaleIP('my-machine.tail1234.ts.net')).toBe(true);
      });
    });

    describe('Tailscale IPv6 (fd7a:115c:)', () => {
      it('detects Tailscale IPv6 addresses', () => {
        expect(isTailscaleIP('fd7a:115c:1234:5678::1')).toBe(true);
        expect(isTailscaleIP('fd7a:115c:a1e0:ab12:4843:cd96:624d:abcd')).toBe(true);
      });
    });

    describe('non-Tailscale addresses', () => {
      it('returns false for non-Tailscale addresses', () => {
        expect(isTailscaleIP('192.168.1.1')).toBe(false);
        expect(isTailscaleIP('example.com')).toBe(false);
        expect(isTailscaleIP('8.8.8.8')).toBe(false);
        expect(isTailscaleIP('100.64.0.1.test')).toBe(false);
        expect(isTailscaleIP('fd7a:115d::1')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('returns false for empty string', () => {
        expect(isTailscaleIP('')).toBe(false);
      });
    });
  });

  describe('isPublicRouteable', () => {
    it('allows Tailscale addresses', () => {
      expect(isPublicRouteable('100.64.0.1')).toBe(true);
      expect(isPublicRouteable('example.ts.net')).toBe(true);
    });

    it('allows public IPs', () => {
      expect(isPublicRouteable('8.8.8.8')).toBe(true);
      expect(isPublicRouteable('1.1.1.1')).toBe(true);
    });

    it('rejects private IPs', () => {
      expect(isPublicRouteable('192.168.1.1')).toBe(false);
      expect(isPublicRouteable('10.0.0.1')).toBe(false);
      expect(isPublicRouteable('172.16.0.1')).toBe(false);
    });

    it('rejects localhost', () => {
      expect(isPublicRouteable('localhost')).toBe(false);
      expect(isPublicRouteable('127.0.0.1')).toBe(false);
      expect(isPublicRouteable('::1')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isPublicRouteable('')).toBe(false);
    });
  });

  describe('validateWebConnectionMode', () => {
    describe('direct mode', () => {
      it('allows direct to public IPs', () => {
        const result = validateWebConnectionMode('8.8.8.8', 'direct');
        expect(result.valid).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('allows direct to Tailscale', () => {
        const result = validateWebConnectionMode('100.64.0.1', 'direct');
        expect(result.valid).toBe(true);
      });

      it('rejects direct to private IPs', () => {
        const result = validateWebConnectionMode('192.168.1.1', 'direct');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Direct connections to private IPs');
      });

      it('rejects direct to loopback', () => {
        const result = validateWebConnectionMode('127.0.0.1', 'direct');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Direct connections to private IPs');
      });

      it('rejects direct to 10.x', () => {
        const result = validateWebConnectionMode('10.0.0.1', 'direct');
        expect(result.valid).toBe(false);
      });

      it('rejects direct to 172.16.x', () => {
        const result = validateWebConnectionMode('172.16.0.1', 'direct');
        expect(result.valid).toBe(false);
      });

      it('rejects direct to IPv6 link-local', () => {
        const result = validateWebConnectionMode('fe80::1', 'direct');
        expect(result.valid).toBe(false);
      });
    });

    describe('relay mode', () => {
      it('allows relay for any address', () => {
        expect(validateWebConnectionMode('192.168.1.1', 'relay').valid).toBe(true);
        expect(validateWebConnectionMode('8.8.8.8', 'relay').valid).toBe(true);
        expect(validateWebConnectionMode('10.0.0.1', 'relay').valid).toBe(true);
      });
    });

    describe('tailscale mode', () => {
      it('allows tailscale mode for any address', () => {
        const result = validateWebConnectionMode('192.168.1.1', 'tailscale');
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('supportsDirectConnection', () => {
    it('returns false for web client', () => {
      expect(supportsDirectConnection('web')).toBe(false);
    });

    it('returns true for electron', () => {
      expect(supportsDirectConnection('electron')).toBe(true);
    });

    it('returns true for iOS', () => {
      expect(supportsDirectConnection('ios')).toBe(true);
    });

    it('returns true for android', () => {
      expect(supportsDirectConnection('android')).toBe(true);
    });
  });
});
