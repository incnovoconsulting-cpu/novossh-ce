/**
 * Authenticated fetch wrapper.
 * On 401, attempts a token refresh (using the httpOnly refresh-token cookie)
 * and retries the original request once. Updates localStorage and the Zustand
 * store so the rest of the app picks up the new token automatically.
 * Also handles CSRF double-submit cookie token capture and injection.
 */

import { captureCsrfToken, csrfHeaders } from './csrf';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

// Mutex to prevent concurrent token refreshes
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in-flight, wait for it
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.accessToken) return null;

      // Persist updated token
      const stored = JSON.parse(localStorage.getItem('novossh-auth') || '{}');
      localStorage.setItem('novossh-auth', JSON.stringify({
        ...stored,
        accessToken: data.accessToken,
        expiresIn: data.expiresIn,
        expiresAt: Date.now() + data.expiresIn * 1000,
      }));

      // Update Zustand store so components using auth.accessToken get fresh value
      try {
        const { useStore } = await import('./store');
        const { auth } = useStore.getState();
        useStore.getState().setAuth({
          ...auth,
          accessToken: data.accessToken,
          expiresIn: data.expiresIn,
          isAuthenticated: true,
        });
      } catch { /* store may not be available in all contexts */ }

      return data.accessToken;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function apiFetch(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const doFetch = (token: string) => {
    const method = (init.method || 'GET').toUpperCase();
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    return fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${token}`,
        ...(isStateChanging ? csrfHeaders() : {}),
      },
    }).then((response) => {
      captureCsrfToken(response);
      return response;
    });
  };

  const res = await doFetch(accessToken);

  if (res.status !== 401) return res;

  // Token expired — try refresh once
  const newToken = await refreshAccessToken();
  if (!newToken) return res; // return the 401 so callers can handle logout

  return doFetch(newToken);
}
