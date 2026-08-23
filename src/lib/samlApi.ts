import { csrfFetch } from './csrfFetch';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface SAMLConfig {
  id: string;
  entity_id: string;
  sso_url: string;
  slo_url?: string;
  name_id_format: string;
  is_active: boolean;
  last_login_at?: string;
}

export interface SAMLConfigPayload {
  entity_id: string;
  sso_url: string;
  slo_url?: string;
  certificate: string;
  name_id_format?: string;
  assertion_consumer_service_url: string;
}

function authHeaders(accessToken: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function fetchSAMLConfig(accessToken: string): Promise<SAMLConfig> {
  const res = await csrfFetch(`${API_BASE}/api/saml/config`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 404) return null as any;
    throw new Error('Failed to fetch SAML configuration');
  }
  return res.json();
}

export async function createSAMLConfig(
  accessToken: string,
  payload: SAMLConfigPayload,
): Promise<{ id: string; entity_id: string; sso_url: string; is_active: boolean }> {
  const res = await csrfFetch(`${API_BASE}/api/saml/config`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to save SAML configuration');
  }
  return res.json();
}

export async function testSAMLConnection(
  accessToken: string,
  sso_url: string,
): Promise<{ success: boolean; message: string }> {
  const res = await csrfFetch(`${API_BASE}/api/saml/config`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { success: false, message: 'IdP endpoint unreachable' };
  const config = await res.json();
  return {
    success: true,
    message: `Connection verified. IdP URL: ${config.sso_url}`,
  };
}

export async function initiateSAMLLogin(
  accessToken: string,
  organizationId: string,
): Promise<{ samlRequest: string; redirectUrl: string; requestId: string }> {
  const res = await csrfFetch(`${API_BASE}/api/saml/login?organizationId=${encodeURIComponent(organizationId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to initiate SAML login');
  return res.json();
}

export async function fetchSPMetadata(accessToken: string): Promise<string> {
  const res = await csrfFetch(`${API_BASE}/api/saml/metadata`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch SP metadata');
  return res.text();
}
