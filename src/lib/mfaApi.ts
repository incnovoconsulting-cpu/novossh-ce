import { apiFetch } from './apiFetch';
import { csrfFetch } from './csrfFetch';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export async function getRegisterOptions(accessToken: string) {
  const res = await apiFetch('/api/webauthn/register-options', accessToken);
  if (!res.ok) throw new Error('Failed to get registration options');
  return res.json() as Promise<{ options: any; challenge: string }>;
}

export async function verifyRegistration(
  accessToken: string,
  payload: { response: any; name?: string },
) {
  const res = await apiFetch('/api/webauthn/register-verify', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Credential registration failed');
  return res.json() as Promise<{ id: string; name: string; created_at: string }>;
}

export async function getAuthOptions(userId?: string) {
  const url = new URL(`${API_BASE}/api/auth/webauthn/authenticate-options`);
  if (userId) url.searchParams.set('userId', userId);
  const res = await csrfFetch(url.toString(), { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to get authentication options');
  return res.json() as Promise<{ options: any; challenge: string }>;
}

export async function verifyAuthentication(payload: { userId: string; response: any }) {
  const res = await csrfFetch(`${API_BASE}/api/auth/webauthn/authenticate-verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Authentication failed');
  return res.json() as Promise<{ verified: boolean; userId: string; credentialId: string }>;
}

export async function getCredentials(accessToken: string) {
  const res = await apiFetch('/api/webauthn/credentials', accessToken);
  if (!res.ok) throw new Error('Failed to fetch credentials');
  return res.json() as Promise<{
    credentials: Array<{
      id: string;
      name: string;
      created_at: string;
      last_used_at?: string;
      transports?: string[];
    }>;
  }>;
}

export async function deleteCredential(accessToken: string, credentialId: string) {
  const res = await apiFetch(`/api/webauthn/credentials/${credentialId}`, accessToken, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete credential');
  return res.json() as Promise<{ message: string }>;
}

export async function renameCredential(accessToken: string, credentialId: string, name: string) {
  const res = await apiFetch(`/api/webauthn/credentials/${credentialId}`, accessToken, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to rename credential');
  return res.json() as Promise<{ id: string; name: string }>;
}

export async function getMFASettings(accessToken: string) {
  const res = await apiFetch('/api/webauthn/mfa-settings', accessToken);
  if (!res.ok) throw new Error('Failed to fetch MFA settings');
  return res.json() as Promise<{
    mfaSettings: {
      webauthn_enabled: boolean;
      webauthn_required: boolean;
    };
  }>;
}

export async function updateMFASettings(
  accessToken: string,
  settings: { webauthn_enabled?: boolean; webauthn_required?: boolean },
) {
  const res = await apiFetch('/api/webauthn/mfa-settings', accessToken, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update MFA settings');
  return res.json() as Promise<{ webauthn_enabled: boolean; webauthn_required: boolean }>;
}

export async function generateBackupCodes(accessToken: string) {
  const res = await apiFetch('/api/webauthn/backup-codes', accessToken, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to generate backup codes');
  return res.json() as Promise<{ backupCodes: string[]; message: string }>;
}

export async function verifyBackupCode(accessToken: string, code: string) {
  const res = await apiFetch('/api/webauthn/verify-backup-code', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error('Invalid or expired backup code');
  return res.json() as Promise<{ verified: boolean }>;
}
