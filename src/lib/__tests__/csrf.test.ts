import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureCsrfToken, getCsrfToken, csrfHeaders, clearCsrfToken } from '../csrf.js';

function mockResponse(headers: Record<string, string> = {}): Response {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Response;
}

describe('CSRF Token Manager', () => {
  beforeEach(() => {
    clearCsrfToken();
    // Reset document.cookie mock
    Object.defineProperty(document, 'cookie', {
      value: '',
      writable: true,
      configurable: true,
    });
  });

  describe('captureCsrfToken', () => {
    it('should cache token from response header', () => {
      const res = mockResponse({ 'x-csrf-token': 'abc123' });
      captureCsrfToken(res);
      expect(getCsrfToken()).toBe('abc123');
    });

    it('should update cached token when new one arrives', () => {
      captureCsrfToken(mockResponse({ 'x-csrf-token': 'token1' }));
      expect(getCsrfToken()).toBe('token1');

      captureCsrfToken(mockResponse({ 'x-csrf-token': 'token2' }));
      expect(getCsrfToken()).toBe('token2');
    });

    it('should not clear cache when response has no CSRF header', () => {
      captureCsrfToken(mockResponse({ 'x-csrf-token': 'token1' }));
      captureCsrfToken(mockResponse({}));
      expect(getCsrfToken()).toBe('token1');
    });
  });

  describe('getCsrfToken', () => {
    it('should return null when no token is cached or in cookie', () => {
      expect(getCsrfToken()).toBeNull();
    });

    it('should return cached token when available', () => {
      captureCsrfToken(mockResponse({ 'x-csrf-token': 'cached' }));
      expect(getCsrfToken()).toBe('cached');
    });

    it('should fall back to document.cookie when cache is empty', () => {
      document.cookie = 'csrf_token=from-cookie; path=/';
      expect(getCsrfToken()).toBe('from-cookie');
    });

    it('should prefer cached token over cookie', () => {
      captureCsrfToken(mockResponse({ 'x-csrf-token': 'from-header' }));
      document.cookie = 'csrf_token=from-cookie; path=/';
      expect(getCsrfToken()).toBe('from-header');
    });

    it('should decode URI-encoded cookie values', () => {
      document.cookie = 'csrf_token=hello%20world; path=/';
      expect(getCsrfToken()).toBe('hello world');
    });
  });

  describe('csrfHeaders', () => {
    it('should return empty object when no token available', () => {
      expect(csrfHeaders()).toEqual({});
    });

    it('should return headers with token when available', () => {
      captureCsrfToken(mockResponse({ 'x-csrf-token': 'my-token' }));
      expect(csrfHeaders()).toEqual({ 'X-CSRF-Token': 'my-token' });
    });
  });

  describe('clearCsrfToken', () => {
    it('should clear cached token', () => {
      captureCsrfToken(mockResponse({ 'x-csrf-token': 'token1' }));
      expect(getCsrfToken()).toBe('token1');

      clearCsrfToken();
      expect(getCsrfToken()).toBeNull();
    });
  });
});
