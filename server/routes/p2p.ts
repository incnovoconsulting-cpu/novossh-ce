import express from 'express';
import crypto from 'crypto';
import { DeviceService } from '../services/DeviceService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const deviceService = new DeviceService();

// In-memory store for signaling data (in production, use Redis or similar)
interface SignalingMessage {
  id: string;
  from: string;
  to: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  createdAt: Date;
  expiresAt: Date;
}

const signalingMessages = new Map<string, SignalingMessage>();

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// POST /api/p2p/signal - Send signaling message (offer, answer, ICE candidate)
router.post('/signal', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { to, type, data } = req.body;

    if (!to || !type || !data) {
      res.status(400).json({ error: 'Missing required fields: to, type, data' });
      return;
    }

    if (!['offer', 'answer', 'ice-candidate'].includes(type)) {
      res.status(400).json({ error: 'Invalid signaling message type' });
      return;
    }

    // Generate unique message ID
    const messageId = crypto.randomUUID();

    // Create signaling message with 5-minute expiration
    const now = new Date();
    const message: SignalingMessage = {
      id: messageId,
      from: user.id,
      to,
      type,
      data,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes
    };

    // Store message
    signalingMessages.set(messageId, message);

    // Auto-cleanup expired messages
    setTimeout(() => {
      signalingMessages.delete(messageId);
    }, 5 * 60 * 1000);

    res.status(201).json({
      messageId,
      expiresAt: message.expiresAt,
    });
  } catch (error) {
    console.error('P2P signaling error:', error);
    res.status(500).json({ error: 'Failed to send signaling message' });
  }
});

// GET /api/p2p/signal/:messageId - Retrieve signaling message
router.get('/signal/:messageId', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { messageId } = req.params;

    const message = signalingMessages.get(messageId);

    if (!message) {
      res.status(404).json({ error: 'Message not found or expired' });
      return;
    }

    // Check if this user is the intended recipient
    if (message.to !== user.id) {
      res.status(403).json({ error: 'Not authorized to retrieve this message' });
      return;
    }

    // Check if message is expired
    if (new Date() > message.expiresAt) {
      signalingMessages.delete(messageId);
      res.status(404).json({ error: 'Message expired' });
      return;
    }

    res.json({
      id: message.id,
      from: message.from,
      type: message.type,
      data: message.data,
      createdAt: message.createdAt,
    });

    // Delete after retrieval (one-time use)
    signalingMessages.delete(messageId);
  } catch (error) {
    console.error('P2P message retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve signaling message' });
  }
});

// GET /api/p2p/messages - Poll for pending messages for current user
router.get('/messages', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const now = new Date();

    // Find all messages for this user that aren't expired
    const messages = Array.from(signalingMessages.values())
      .filter(msg => msg.to === user.id && now <= msg.expiresAt)
      .map(msg => ({
        id: msg.id,
        from: msg.from,
        type: msg.type,
        data: msg.data,
        createdAt: msg.createdAt,
      }));

    res.json({
      messages,
      count: messages.length,
    });

    // Delete retrieved messages (one-time use)
    messages.forEach(msg => {
      signalingMessages.delete(msg.id);
    });
  } catch (error) {
    console.error('Failed to retrieve messages:', error);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// DELETE /api/p2p/signal/:messageId - Delete/revoke signaling message
router.delete('/signal/:messageId', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { messageId } = req.params;

    const message = signalingMessages.get(messageId);

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Check if this user is the sender (can only revoke own messages)
    if (message.from !== user.id) {
      res.status(403).json({ error: 'Not authorized to delete this message' });
      return;
    }

    signalingMessages.delete(messageId);
    res.status(204).send();
  } catch (error) {
    console.error('P2P message deletion error:', error);
    res.status(500).json({ error: 'Failed to delete signaling message' });
  }
});

// POST /api/p2p/discover - Discover peers in local network (simplified for MVP)
// In production, this would use mDNS, SSDP, or similar discovery mechanisms
router.post('/discover', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { peerId } = req.body;

    if (!peerId) {
      res.status(400).json({ error: 'Missing peerId' });
      return;
    }

    // Register peer availability
    // In production, this would broadcast to other peers or use a discovery service
    res.json({
      peerId,
      userId: user.id,
      discoveredAt: new Date(),
      ttl: 300, // Time to live in seconds
    });
  } catch (error) {
    console.error('P2P discovery error:', error);
    res.status(500).json({ error: 'Failed to register peer' });
  }
});

// POST /api/p2p/heartbeat - Register/update this device's presence
router.post('/heartbeat', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { deviceId, deviceName, platform } = req.body;

    if (!deviceId || !deviceName) {
      res.status(400).json({ error: 'Missing required fields: deviceId, deviceName' });
      return;
    }

    await deviceService.heartbeat(user.id, deviceId, deviceName, platform);
    res.json({ ok: true });
  } catch (error) {
    console.error('P2P heartbeat error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// GET /api/p2p/peers - List this user's other known devices
router.get('/peers', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const deviceId = req.query.deviceId as string;

    if (!deviceId) {
      res.status(400).json({ error: 'Missing required query param: deviceId' });
      return;
    }

    const peers = await deviceService.listPeers(user.id, deviceId);
    res.json({ peers });
  } catch (error) {
    console.error('P2P peers error:', error);
    res.status(500).json({ error: 'Failed to list peers' });
  }
});

// POST /api/p2p/sync - Trigger a sync with a peer device
router.post('/sync', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { deviceId, peerId } = req.body;

    if (!deviceId || !peerId) {
      res.status(400).json({ error: 'Missing required fields: deviceId, peerId' });
      return;
    }

    const peerDevice = await deviceService.getDevice(peerId);
    if (!peerDevice || peerDevice.user_id !== user.id) {
      res.status(404).json({ error: 'Peer device not found' });
      return;
    }

    // Vault/session data already lives centrally in Postgres, so "sync" here
    // notifies the peer to refresh rather than transferring data directly.
    const messageId = crypto.randomUUID();
    const now = new Date();
    const message: SignalingMessage = {
      id: messageId,
      from: deviceId,
      to: peerId,
      type: 'sync-request' as any,
      data: {},
      createdAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    };
    signalingMessages.set(messageId, message);
    setTimeout(() => signalingMessages.delete(messageId), 5 * 60 * 1000);

    await deviceService.recordSync(deviceId, peerId);

    res.json({ ok: true, syncedAt: now });
  } catch (error) {
    console.error('P2P sync error:', error);
    res.status(500).json({ error: 'Failed to sync with peer' });
  }
});

// GET /api/p2p/health - Health check for P2P connectivity
router.get('/health', authMiddleware, async (_req, res) => {
  try {
    res.json({
      status: 'online',
      timestamp: new Date(),
      messageCount: signalingMessages.size,
    });
  } catch (error) {
    res.status(500).json({ error: 'P2P service unavailable' });
  }
});

export { router as p2pRouter };
