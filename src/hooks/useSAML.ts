import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../lib/store';
import {
  fetchSAMLConfig,
  createSAMLConfig,
  testSAMLConnection,
  initiateSAMLLogin,
  fetchSPMetadata,
  type SAMLConfig,
  type SAMLConfigPayload,
} from '../lib/samlApi';

interface SAMLState {
  config: SAMLConfig | null;
  spEntityId: string;
  spMetadata: string;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  testResult: { success: boolean; message: string } | null;
  error: string | null;
  loadConfig: () => Promise<void>;
  saveConfig: (payload: SAMLConfigPayload) => Promise<void>;
  testConnection: () => Promise<void>;
  initiateLogin: () => Promise<void>;
  loadMetadata: () => Promise<void>;
  clearTest: () => void;
}

export function useSAML(): SAMLState {
  const { auth } = useStore();
  const [config, setConfig] = useState<SAMLConfig | null>(null);
  const [spMetadata, setSpMetadata] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spEntityId = auth.user
    ? `urn:novossh:${auth.user.organizationId}`
    : '';

  const loadConfig = useCallback(async () => {
    if (!auth.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSAMLConfig(auth.accessToken);
      setConfig(data);
    } catch (err: any) {
      if (err.message?.includes('404')) {
        setConfig(null);
      } else {
        setError(err.message || 'Failed to load SAML configuration');
      }
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken]);

  const saveConfig = useCallback(
    async (payload: SAMLConfigPayload) => {
      if (!auth.accessToken) return;
      setSaving(true);
      setError(null);
      try {
        const result = await createSAMLConfig(auth.accessToken, payload);
        setConfig({
          id: result.id,
          entity_id: result.entity_id,
          sso_url: result.sso_url,
          name_id_format: payload.name_id_format || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          is_active: result.is_active,
        });
      } catch (err: any) {
        setError(err.message || 'Failed to save SAML configuration');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [auth.accessToken],
  );

  const testConnection = useCallback(async () => {
    if (!auth.accessToken) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testSAMLConnection(auth.accessToken, config?.sso_url || '');
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  }, [auth.accessToken, config?.sso_url]);

  const initiateLogin = useCallback(async () => {
    if (!auth.accessToken || !auth.user) return;
    try {
      const result = await initiateSAMLLogin(auth.accessToken, auth.user.organizationId);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = result.redirectUrl;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'SAMLRequest';
      input.value = result.samlRequest;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate SAML login');
    }
  }, [auth.accessToken, auth.user]);

  const loadMetadata = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      const xml = await fetchSPMetadata(auth.accessToken);
      setSpMetadata(xml);
    } catch {
      setSpMetadata('');
    }
  }, [auth.accessToken]);

  const clearTest = useCallback(() => setTestResult(null), []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return {
    config,
    spEntityId,
    spMetadata,
    loading,
    saving,
    testing,
    testResult,
    error,
    loadConfig,
    saveConfig,
    testConnection,
    initiateLogin,
    loadMetadata,
    clearTest,
  };
}
