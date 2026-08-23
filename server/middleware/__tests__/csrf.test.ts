import { describe, it, expect, beforeEach, vi } from 'vitest';
import { csrfProtection } from '../csrf.js';

function mockReq(overrides: Partial<{ method: string; path: string; cookies: Record<string, string>; headers: Record<string, string> }> = {}) {
  return {
    method: 'GET',
    path: '/api/data',
    cookies: {},
    headers: {},
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {
    _status: 200,
    _headers: {} as Record<string, string>,
    _cookie: null as any,
    status(code: number) { res._status = code; return res; },
    json(body: any) { res._body = body; return res; },
    setHeader(name: string, value: string) { res._headers[name.toLowerCase()] = value; },
    cookie(name: string, value: string, opts: any) { res._cookie = { name, value, opts }; },
  };
  return res;
}

describe('CSRF Middleware', () => {
  describe('Token generation', () => {
    it('should set csrf_token cookie on first request (no existing cookie)', () => {
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res._cookie).not.toBeNull();
      expect(res._cookie.name).toBe('csrf_token');
      expect(res._cookie.value).toMatch(/^[a-f0-9]{64}$/);
      expect(res._cookie.opts.httpOnly).toBe(false);
      expect(res._cookie.opts.sameSite).toBe('lax');
    });

    it('should expose token via X-CSRF-Token header on GET', () => {
      const req = mockReq({ method: 'GET' });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(res._headers['x-csrf-token']).toBeDefined();
      expect(res._headers['x-csrf-token']).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should expose rotated token header on POST (rotation)', () => {
      const req = mockReq({ method: 'POST', cookies: { csrf_token: 'abc', refreshToken: 'r' } });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      expect(res._headers['x-csrf-token']).toBeDefined();
      expect(res._headers['x-csrf-token']).not.toBe('abc');
    });

    it('should reuse existing cookie value instead of generating new one', () => {
      const req = mockReq({ cookies: { csrf_token: 'existing-token-value' } });
      const res = mockRes();
      const next = vi.fn();

      csrfProtection(req, res, next);

      // Should NOT set a new cookie
      expect(res._cookie).toBeNull();
      // Should expose existing token
      expect(res._headers['x-csrf-token']).toBe('existing-token-value');
    });
  });

  describe('Safe method exemptions', () => {
    it('should pass through GET without validation', () => {
      const req = mockReq({ method: 'GET' });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through HEAD without validation', () => {
      const req = mockReq({ method: 'HEAD' });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through OPTIONS without validation', () => {
      const req = mockReq({ method: 'OPTIONS' });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Path exemptions', () => {
    it('should pass through POST to /api/auth/login', () => {
      const req = mockReq({ method: 'POST', path: '/api/auth/login', cookies: { csrf_token: 'x' } });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through POST to /api/auth/local-login', () => {
      const req = mockReq({ method: 'POST', path: '/api/auth/local-login', cookies: { csrf_token: 'x' } });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through POST to /api/health', () => {
      const req = mockReq({ method: 'POST', path: '/api/health', cookies: { csrf_token: 'x' } });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Bearer-only client exemption', () => {
    it('should skip validation when Bearer auth header present and no session cookies', () => {
      const req = mockReq({
        method: 'POST',
        headers: { authorization: 'Bearer some-token' },
        cookies: {},
      });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('No-cookie exemption', () => {
    it('should skip validation when no cookies at all', () => {
      const req = mockReq({
        method: 'POST',
        cookies: undefined as any,
      });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('State-changing validation', () => {
    it('should reject POST when cookies present but no CSRF header', () => {
      const req = mockReq({
        method: 'POST',
        cookies: { csrf_token: 'valid-token', refreshToken: 'some-refresh' },
        headers: {},
      });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(403);
      expect(res._body.error).toContain('CSRF');
    });

    it('should reject POST when CSRF header does not match cookie', () => {
      const req = mockReq({
        method: 'POST',
        cookies: { csrf_token: 'correct-token', refreshToken: 'some-refresh' },
        headers: { 'x-csrf-token': 'wrong-token' },
      });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(403);
    });

    it('should accept POST when CSRF header matches cookie', () => {
      const token = 'matching-token-123';
      const req = mockReq({
        method: 'POST',
        cookies: { csrf_token: token, refreshToken: 'some-refresh' },
        headers: { 'x-csrf-token': token },
      });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res._status).toBe(200);
    });

    it('should accept PUT when token matches', () => {
      const token = 't';
      const req = mockReq({
        method: 'PUT',
        cookies: { csrf_token: token, refreshToken: 'r' },
        headers: { 'x-csrf-token': token },
      });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should accept PATCH when token matches', () => {
      const token = 't';
      const req = mockReq({
        method: 'PATCH',
        cookies: { csrf_token: token, refreshToken: 'r' },
        headers: { 'x-csrf-token': token },
      });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should accept DELETE when token matches', () => {
      const token = 't';
      const req = mockReq({
        method: 'DELETE',
        cookies: { csrf_token: token, refreshToken: 'r' },
        headers: { 'x-csrf-token': token },
      });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject DELETE when no CSRF header', () => {
      const req = mockReq({
        method: 'DELETE',
        cookies: { csrf_token: 't', refreshToken: 'r' },
        headers: {},
      });
      const res = mockRes();
      const next = vi.fn();
      csrfProtection(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(403);
    });
  });
});
