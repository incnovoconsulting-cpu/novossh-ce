import { apiFetch } from './apiFetch';

function getToken(): string {
  try {
    const stored = JSON.parse(localStorage.getItem('novossh-auth') || '{}');
    return stored.accessToken || '';
  } catch {
    return '';
  }
}

const BASE = '/api/admin';

export const adminApi = {
  me: () => apiFetch(`${BASE}/me`, getToken()),
  stats: () => apiFetch(`${BASE}/stats`, getToken()),
  users: (params?: Record<string, string>) =>
    apiFetch(`${BASE}/users?${new URLSearchParams(params || {})}`, getToken()),
  user: (id: string) => apiFetch(`${BASE}/user/${id}`, getToken()),
  setUserPlan: (id: string, plan: string) =>
    apiFetch(`${BASE}/user/${id}/plan`, getToken(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    }),
  dbTables: () => apiFetch(`${BASE}/db/tables`, getToken()),
  dbTable: (name: string, offset = 0, limit = 50) =>
    apiFetch(`${BASE}/db/table/${name}?offset=${offset}&limit=${limit}`, getToken()),
  features: () => apiFetch(`${BASE}/features`, getToken()),
  toggleFeature: (key: string, enabled: boolean) =>
    apiFetch(`${BASE}/features/${key}`, getToken(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }),
  health: () => apiFetch(`${BASE}/health`, getToken()),
  releases: () => apiFetch(`${BASE}/releases`, getToken()),
  security: () => apiFetch(`${BASE}/security`, getToken()),
};
