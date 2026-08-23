import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock authMiddleware to accept x-user-id header-based auth in tests
vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
      req.user = { id: userId, organizationId: req.headers['x-org-id'] || 'org-1' };
      next();
    } else {
      _res.status(401).json({ error: 'Authentication required' });
    }
  },
}));

import { p2pRouter } from '../p2p';

let app: express.Application;

beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const userId = req.headers['x-user-id'] as string;
    const orgId = req.headers['x-org-id'] as string;
    if (userId) {
      req.user = { id: userId, organizationId: orgId || 'org-1' };
    }
    next();
  });
  app.use('/api/p2p', p2pRouter);
});

describe('P2P Routes', () => {
  describe('POST /signal - Send signaling message', () => {
    it('should send offer message successfully', async () => {
      const res = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'offer',
          data: { sdp: 'v=0\n...' },
        });

      expect(res.status).toBe(201);
      expect(res.body.messageId).toBeDefined();
      expect(res.body.expiresAt).toBeDefined();
    });

    it('should send answer message successfully', async () => {
      const res = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'answer',
          data: { sdp: 'v=0\n...' },
        });

      expect(res.status).toBe(201);
      expect(res.body.messageId).toBeDefined();
    });

    it('should send ICE candidate message successfully', async () => {
      const res = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'ice-candidate',
          data: { candidate: 'candidate:...' },
        });

      expect(res.status).toBe(201);
      expect(res.body.messageId).toBeDefined();
    });

    it('should reject missing recipient', async () => {
      const res = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          type: 'offer',
          data: { sdp: 'v=0\n...' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });

    it('should reject invalid message type', async () => {
      const res = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'invalid',
          data: {},
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid signaling message type');
    });

    it('should reject missing data', async () => {
      const res = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'offer',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing required fields');
    });
  });

  describe('GET /signal/:messageId - Retrieve signaling message', () => {
    it('should retrieve message as intended recipient', async () => {
      // First, send a message from user-1 to user-2
      const sendRes = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'offer',
          data: { sdp: 'v=0\n...' },
        });

      const messageId = sendRes.body.messageId;

      // Now retrieve it as user-2
      const getRes = await request(app)
        .get(`/api/p2p/signal/${messageId}`)
        .set('x-user-id', 'user-2')
        .set('x-org-id', 'org-1');

      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(messageId);
      expect(getRes.body.from).toBe('user-1');
      expect(getRes.body.type).toBe('offer');
      expect(getRes.body.data).toEqual({ sdp: 'v=0\n...' });
    });

    it('should reject unauthorized recipient', async () => {
      const sendRes = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'offer',
          data: { sdp: 'v=0\n...' },
        });

      const messageId = sendRes.body.messageId;

      // Try to retrieve as different user
      const getRes = await request(app)
        .get(`/api/p2p/signal/${messageId}`)
        .set('x-user-id', 'user-3')
        .set('x-org-id', 'org-1');

      expect(getRes.status).toBe(403);
      expect(getRes.body.error).toContain('Not authorized');
    });

    it('should return 404 for non-existent message', async () => {
      const res = await request(app)
        .get('/api/p2p/signal/non-existent-id')
        .set('x-user-id', 'user-2')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(404);
    });

    it('should delete message after retrieval (one-time use)', async () => {
      const sendRes = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'offer',
          data: { sdp: 'v=0\n...' },
        });

      const messageId = sendRes.body.messageId;

      // First retrieval should succeed
      const getRes1 = await request(app)
        .get(`/api/p2p/signal/${messageId}`)
        .set('x-user-id', 'user-2')
        .set('x-org-id', 'org-1');

      expect(getRes1.status).toBe(200);

      // Second retrieval should fail (already deleted)
      const getRes2 = await request(app)
        .get(`/api/p2p/signal/${messageId}`)
        .set('x-user-id', 'user-2')
        .set('x-org-id', 'org-1');

      expect(getRes2.status).toBe(404);
    });
  });

  describe('GET /messages - Poll for pending messages', () => {
    it('should return pending messages for user', async () => {
      // Send two messages to user-2
      const msg1 = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'offer',
          data: { sdp: 'v=0\n...' },
        });

      const msg2 = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-3')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'answer',
          data: { sdp: 'v=0\n...' },
        });

      // Poll as user-2
      const res = await request(app)
        .get('/api/p2p/messages')
        .set('x-user-id', 'user-2')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThanOrEqual(2);
      expect(res.body.messages.length).toBeGreaterThanOrEqual(2);

      // Find messages we just sent
      const msg1Found = res.body.messages.find((m: any) => m.id === msg1.body.messageId);
      const msg2Found = res.body.messages.find((m: any) => m.id === msg2.body.messageId);

      expect(msg1Found).toBeDefined();
      expect(msg2Found).toBeDefined();
      expect(msg1Found.from).toBe('user-1');
      expect(msg2Found.from).toBe('user-3');
    });

    it('should return empty for user with no messages', async () => {
      const res = await request(app)
        .get('/api/p2p/messages')
        .set('x-user-id', 'user-99')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.messages.length).toBe(0);
    });

    it('should delete messages after polling (one-time use)', async () => {
      await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'offer',
          data: { sdp: 'v=0\n...' },
        });

      // First poll
      const res1 = await request(app)
        .get('/api/p2p/messages')
        .set('x-user-id', 'user-2')
        .set('x-org-id', 'org-1');

      expect(res1.body.count).toBe(1);

      // Second poll should be empty
      const res2 = await request(app)
        .get('/api/p2p/messages')
        .set('x-user-id', 'user-2')
        .set('x-org-id', 'org-1');

      expect(res2.body.count).toBe(0);
    });
  });

  describe('DELETE /signal/:messageId - Delete signaling message', () => {
    it('should delete message as sender', async () => {
      const sendRes = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'offer',
          data: { sdp: 'v=0\n...' },
        });

      const messageId = sendRes.body.messageId;

      const deleteRes = await request(app)
        .delete(`/api/p2p/signal/${messageId}`)
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(deleteRes.status).toBe(204);
    });

    it('should reject delete as non-sender', async () => {
      const sendRes = await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'offer',
          data: { sdp: 'v=0\n...' },
        });

      const messageId = sendRes.body.messageId;

      const deleteRes = await request(app)
        .delete(`/api/p2p/signal/${messageId}`)
        .set('x-user-id', 'user-2')
        .set('x-org-id', 'org-1');

      expect(deleteRes.status).toBe(403);
    });

    it('should return 404 for non-existent message', async () => {
      const res = await request(app)
        .delete('/api/p2p/signal/non-existent-id')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /discover - Discover peers', () => {
    it('should register peer successfully', async () => {
      const res = await request(app)
        .post('/api/p2p/discover')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          peerId: 'peer-abc123',
        });

      expect(res.status).toBe(200);
      expect(res.body.peerId).toBe('peer-abc123');
      expect(res.body.userId).toBe('user-1');
      expect(res.body.ttl).toBe(300);
    });

    it('should reject missing peerId', async () => {
      const res = await request(app)
        .post('/api/p2p/discover')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing peerId');
    });
  });

  describe('GET /health - P2P health check', () => {
    it('should return online status', async () => {
      const res = await request(app)
        .get('/api/p2p/health')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('online');
      expect(res.body.timestamp).toBeDefined();
      expect(typeof res.body.messageCount).toBe('number');
    });

    it('should include message count in health check', async () => {
      // Send a message
      await request(app)
        .post('/api/p2p/signal')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          to: 'user-2',
          type: 'offer',
          data: { sdp: 'v=0\n...' },
        });

      const res = await request(app)
        .get('/api/p2p/health')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(res.status).toBe(200);
      expect(res.body.messageCount).toBeGreaterThan(0);
    });
  });
});
