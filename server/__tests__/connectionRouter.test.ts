import { describe, it, expect } from 'vitest';
import { resolveConnectionRoute } from '../connectionRouter.js';

describe('connectionRouter', () => {
  describe('resolveConnectionRoute', () => {
    it('allows direct to public IP on native clients', () => {
      const result = resolveConnectionRoute('electron', 'direct', '8.8.8.8');
      expect(result.clientType).toBe('electron');
      expect(result.connectionMode).toBe('direct');
      expect(result.requiresRelay).toBe(false);
    });

    it('allows direct to Tailscale on native clients', () => {
      const result = resolveConnectionRoute('electron', 'direct', '100.64.0.1');
      expect(result.clientType).toBe('electron');
      expect(result.connectionMode).toBe('direct');
      expect(result.requiresRelay).toBe(false);
    });

    it('allows direct to private IP on native direct request (relay cannot reach plain LAN hosts)', () => {
      const result = resolveConnectionRoute('electron', 'direct', '192.168.1.1');
      expect(result.connectionMode).toBe('direct');
      expect(result.requiresRelay).toBe(false);
    });

    it('supports tailscale mode on Tailscale addresses (native - direct)', () => {
      const result = resolveConnectionRoute('electron', 'tailscale', '100.64.0.1');
      expect(result.connectionMode).toBe('tailscale');
      expect(result.requiresRelay).toBe(false);
    });

    it('supports tailscale mode on Tailscale addresses (web - relay)', () => {
      const result = resolveConnectionRoute('web', 'tailscale', '100.64.0.1');
      expect(result.connectionMode).toBe('tailscale');
      expect(result.requiresRelay).toBe(true);
    });

    it('forces relay for web client with private IP', () => {
      const result = resolveConnectionRoute('web', 'direct', '192.168.1.1');
      expect(result.connectionMode).toBe('relay');
      expect(result.requiresRelay).toBe(true);
    });

    it('allows web client to public IP in direct mode', () => {
      const result = resolveConnectionRoute('web', 'direct', '8.8.8.8');
      expect(result.connectionMode).toBe('relay');
      expect(result.requiresRelay).toBe(true);
    });

    it('web client supports Tailscale routing', () => {
      const result = resolveConnectionRoute('web', 'tailscale', '100.64.0.1');
      expect(result.connectionMode).toBe('tailscale');
      expect(result.requiresRelay).toBe(true);
    });

    it('marks iOS as supporting direct connection', () => {
      const result = resolveConnectionRoute('ios', 'direct', '8.8.8.8');
      expect(result.supportsDirectConnection).toBe(true);
      expect(result.clientType).toBe('ios');
    });

    it('marks Android as supporting direct connection', () => {
      const result = resolveConnectionRoute('android', 'direct', '8.8.8.8');
      expect(result.supportsDirectConnection).toBe(true);
      expect(result.clientType).toBe('android');
    });

    it('web client does not support direct', () => {
      const result = resolveConnectionRoute('web', 'direct', '8.8.8.8');
      expect(result.supportsDirectConnection).toBe(false);
    });
  });
});
