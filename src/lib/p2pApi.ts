import { apiFetch } from './apiFetch';
import type { PeerInfo } from './types';

const DEVICE_ID_KEY = 'novossh-p2p-device-id';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceName(): string {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';
  if (/iPhone|iPad/.test(ua)) return 'iOS device';
  if (/Mac/.test(platform)) return 'Mac (browser)';
  if (/Win/.test(platform)) return 'Windows (browser)';
  if (/Linux/.test(platform)) return 'Linux (browser)';
  return 'Browser';
}

export async function heartbeat(accessToken: string): Promise<void> {
  const res = await apiFetch('/api/p2p/heartbeat', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      platform: navigator.platform,
    }),
  });
  if (!res.ok) throw new Error('Failed to register device');
}

export async function listPeers(accessToken: string): Promise<PeerInfo[]> {
  const res = await apiFetch(`/api/p2p/peers?deviceId=${getDeviceId()}`, accessToken);
  if (!res.ok) throw new Error('Failed to load peers');
  const data = await res.json();
  return data.peers || [];
}

export async function syncWithPeer(accessToken: string, peerId: string): Promise<void> {
  const res = await apiFetch('/api/p2p/sync', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: getDeviceId(), peerId }),
  });
  if (!res.ok) throw new Error('Sync failed');
}
