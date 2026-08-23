import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface VerificationStatus {
  verified: boolean;
  lastSentAt: string | null;
}

interface SendResult {
  success: boolean;
  error?: string;
  retryAfter?: number;
}

export function useEmailVerification() {
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const getAuthHeaders = useCallback(() => {
    let token: string | null = null;
    try {
      const stored = JSON.parse(localStorage.getItem('novossh-auth') || '{}');
      token = stored.accessToken || null;
    } catch {
      token = localStorage.getItem('accessToken');
    }
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-email/status`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data: VerificationStatus = await res.json();
        setStatus(data);
        return data;
      }
    } catch {
      // silent
    }
    return null;
  }, [getAuthHeaders]);

  const sendCode = useCallback(async (): Promise<SendResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json();

      if (!res.ok) {
        const errMsg = data.error || 'Failed to send code';
        setError(errMsg);
        if (data.retryAfter) {
          setCooldown(data.retryAfter);
        }
        return { success: false, error: errMsg, retryAfter: data.retryAfter };
      }

      setCooldown(60);
      return { success: true };
    } catch {
      setError('Network error');
      return { success: false, error: 'Network error' };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const confirmCode = useCallback(async (code: string): Promise<SendResult> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-email/confirm`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errMsg = data.error || 'Invalid code';
        setError(errMsg);
        return { success: false, error: errMsg };
      }

      setStatus({ verified: true, lastSentAt: null });
      return { success: true };
    } catch {
      setError('Network error');
      return { success: false, error: 'Network error' };
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    cooldown,
    sendCode,
    confirmCode,
    refreshStatus: fetchStatus,
  };
}
