-- Device registry: backs the P2P Sync feature (list of a user's other logged-in devices)
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  platform TEXT,
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- Sync history between a user's devices
CREATE TABLE IF NOT EXISTS device_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  peer_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  synced_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_syncs_device_id ON device_syncs(device_id);
CREATE INDEX IF NOT EXISTS idx_device_syncs_peer_device_id ON device_syncs(peer_device_id);
