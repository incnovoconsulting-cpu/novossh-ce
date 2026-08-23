import type { PortForward, ForwardingTemplate, PortForwardingStatus } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

export const portForwardingApi = {
  listForwards(): Promise<PortForward[]> {
    return apiFetch<PortForward[]>('/api/forwarding');
  },

  getForward(id: string): Promise<PortForward> {
    return apiFetch<PortForward>(`/api/forwarding/${id}`);
  },

  createForward(data: Omit<PortForward, 'id' | 'createdAt' | 'updatedAt'>): Promise<PortForward> {
    return apiFetch<PortForward>('/api/forwarding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateForward(id: string, patch: Partial<PortForward>): Promise<PortForward> {
    return apiFetch<PortForward>(`/api/forwarding/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  deleteForward(id: string): Promise<void> {
    return apiFetch<void>(`/api/forwarding/${id}`, { method: 'DELETE' });
  },

  activateForward(id: string): Promise<PortForwardingStatus> {
    return apiFetch<PortForwardingStatus>(`/api/forwarding/${id}/activate`, { method: 'POST' });
  },

  deactivateForward(id: string): Promise<PortForwardingStatus> {
    return apiFetch<PortForwardingStatus>(`/api/forwarding/${id}/deactivate`, { method: 'POST' });
  },

  getStatus(id: string): Promise<PortForwardingStatus> {
    return apiFetch<PortForwardingStatus>(`/api/forwarding/${id}/status`);
  },

  listTemplates(): Promise<ForwardingTemplate[]> {
    return apiFetch<ForwardingTemplate[]>('/api/forwarding/templates');
  },

  saveTemplate(data: Omit<ForwardingTemplate, 'id'>): Promise<ForwardingTemplate> {
    return apiFetch<ForwardingTemplate>('/api/forwarding/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteTemplate(id: string): Promise<void> {
    return apiFetch<void>(`/api/forwarding/templates/${id}`, { method: 'DELETE' });
  },

  testForward(id: string): Promise<{ success: boolean; latency?: number; error?: string }> {
    return apiFetch(`/api/forwarding/${id}/test`, { method: 'POST' });
  },
};
