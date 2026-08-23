import { getDb } from '../db/connection.js';

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  platform: string | null;
  last_seen_at: Date;
  created_at: Date;
}

export interface PeerInfo {
  id: string;
  name: string;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  lastSyncedAt: number | null;
}

const ONLINE_WINDOW_MS = 60 * 1000; // heartbeat within the last minute = online
const CONNECTING_WINDOW_MS = 5 * 60 * 1000; // within 5 minutes = recently seen

export class DeviceService {
  private db = getDb();

  async heartbeat(
    userId: string,
    deviceId: string,
    deviceName: string,
    platform?: string
  ): Promise<void> {
    await this.db`
      INSERT INTO devices (id, user_id, device_name, platform, last_seen_at)
      VALUES (${deviceId}, ${userId}, ${deviceName}, ${platform || null}, NOW())
      ON CONFLICT (id) DO UPDATE
      SET device_name = ${deviceName}, platform = ${platform || null}, last_seen_at = NOW()
    `;
  }

  async listPeers(userId: string, currentDeviceId: string): Promise<PeerInfo[]> {
    const devices = await this.db`
      SELECT * FROM devices
      WHERE user_id = ${userId} AND id != ${currentDeviceId}
      ORDER BY last_seen_at DESC
    `;

    const peers: PeerInfo[] = [];
    for (const device of devices as unknown as Device[]) {
      const lastSync = await this.db`
        SELECT synced_at FROM device_syncs
        WHERE (device_id = ${currentDeviceId} AND peer_device_id = ${device.id})
           OR (device_id = ${device.id} AND peer_device_id = ${currentDeviceId})
        ORDER BY synced_at DESC LIMIT 1
      `;

      const ageMs = Date.now() - new Date(device.last_seen_at).getTime();
      const connectionStatus: PeerInfo['connectionStatus'] =
        ageMs <= ONLINE_WINDOW_MS ? 'connected' : ageMs <= CONNECTING_WINDOW_MS ? 'connecting' : 'disconnected';

      peers.push({
        id: device.id,
        name: device.device_name,
        connectionStatus,
        lastSyncedAt: lastSync.length > 0 ? new Date(lastSync[0].synced_at as unknown as string).getTime() : null,
      });
    }

    return peers;
  }

  async getDevice(deviceId: string): Promise<Device | null> {
    const result = await this.db`SELECT * FROM devices WHERE id = ${deviceId}`;
    return result.length > 0 ? (result[0] as Device) : null;
  }

  async recordSync(deviceId: string, peerDeviceId: string): Promise<void> {
    await this.db`
      INSERT INTO device_syncs (device_id, peer_device_id, synced_at)
      VALUES (${deviceId}, ${peerDeviceId}, NOW())
    `;
  }
}
