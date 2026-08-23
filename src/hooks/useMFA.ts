import { useCallback, useEffect, useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { useStore } from '../lib/store';
import * as mfaApi from '../lib/mfaApi';

export interface MFACredential {
  id: string;
  name: string;
  created_at: string;
  last_used_at?: string;
  transports?: string[];
}

export interface MFASettingsState {
  webauthn_enabled: boolean;
  webauthn_required: boolean;
}

export interface UseMFA {
  settings: MFASettingsState;
  credentials: MFACredential[];
  loading: boolean;
  error: string | null;
  updateSettings: (s: Partial<MFASettingsState>) => Promise<void>;
  registerDevice: (name?: string) => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
  renameDevice: (id: string, name: string) => Promise<void>;
  refreshCredentials: () => Promise<void>;
  startAuth: (userId?: string) => Promise<{ userId: string; response: any }>;
  verifyAuth: (data: { userId: string; response: any }) => Promise<boolean>;
  generateBackupCodes: () => Promise<string[]>;
  verifyBackupCode: (code: string) => Promise<boolean>;
}

export function useMFA(): UseMFA {
  const auth = useStore((s) => s.auth);
  const [settings, setSettings] = useState<MFASettingsState>({
    webauthn_enabled: false,
    webauthn_required: false,
  });
  const [credentials, setCredentials] = useState<MFACredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = auth.accessToken;

  const refreshSettings = useCallback(async () => {
    if (!token) return;
    try {
      const data = await mfaApi.getMFASettings(token);
      setSettings(data.mfaSettings);
    } catch {
      // MFA settings unavailable — silently keep defaults
    }
  }, [token]);

  const refreshCredentials = useCallback(async () => {
    if (!token) return;
    try {
      const data = await mfaApi.getCredentials(token);
      setCredentials(data.credentials);
    } catch {
      // Credentials unavailable — silently keep empty list
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    Promise.all([refreshSettings(), refreshCredentials()]).then(() => setLoading(false));
  }, [token, refreshSettings, refreshCredentials]);

  const updateSettings = useCallback(
    async (patch: Partial<MFASettingsState>) => {
      if (!token) return;
      setError(null);
      const data = await mfaApi.updateMFASettings(token, patch);
      setSettings({ webauthn_enabled: data.webauthn_enabled, webauthn_required: data.webauthn_required });
    },
    [token],
  );

  const registerDevice = useCallback(
    async (name?: string) => {
      if (!token) return;
      setError(null);

      const { options } = await mfaApi.getRegisterOptions(token);
      const response = await startRegistration({ optionsJSON: options });
      await mfaApi.verifyRegistration(token, { response, name });
      await refreshCredentials();
    },
    [token, refreshCredentials],
  );

  const deleteDevice = useCallback(
    async (id: string) => {
      if (!token) return;
      setError(null);
      await mfaApi.deleteCredential(token, id);
      await refreshCredentials();
    },
    [token, refreshCredentials],
  );

  const renameDevice = useCallback(
    async (id: string, name: string) => {
      if (!token) return;
      setError(null);
      await mfaApi.renameCredential(token, id, name);
      await refreshCredentials();
    },
    [token, refreshCredentials],
  );

  const startAuth = useCallback(async (userId?: string) => {
    const resolvedUserId = userId || auth.user?.userId;
    if (!resolvedUserId) throw new Error('No user to authenticate');

    const { options } = await mfaApi.getAuthOptions(resolvedUserId);
    const response = await startAuthentication({ optionsJSON: options });
    return { userId: resolvedUserId, response };
  }, [auth.user?.userId]);

  const verifyAuth = useCallback(
    async (data: { userId: string; response: any }) => {
      const result = await mfaApi.verifyAuthentication(data);
      return result.verified;
    },
    [],
  );

  const generateBackupCodes = useCallback(async () => {
    if (!token) throw new Error('Not authenticated');
    const data = await mfaApi.generateBackupCodes(token);
    return data.backupCodes;
  }, [token]);

  const verifyBackupCode = useCallback(
    async (code: string) => {
      if (!token) throw new Error('Not authenticated');
      const data = await mfaApi.verifyBackupCode(token, code);
      return data.verified;
    },
    [token],
  );

  return {
    settings,
    credentials,
    loading,
    error,
    updateSettings,
    registerDevice,
    deleteDevice,
    renameDevice,
    refreshCredentials,
    startAuth,
    verifyAuth,
    generateBackupCodes,
    verifyBackupCode,
  };
}
