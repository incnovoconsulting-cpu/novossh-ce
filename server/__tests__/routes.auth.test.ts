import { describe, it, expect, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import { optionalAuthMiddleware, getUser } from '../middleware/auth.js';
import { generateTokenPair } from '../auth.js';

/**
 * Tests for route handlers using JWT auth
 * Validates that routes can extract user info from JWT tokens
 */
describe('Route Handlers with JWT Auth', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(optionalAuthMiddleware);
  });

  describe('User extraction in routes', () => {
    beforeEach(() => {
      // Simple route that extracts user info
      app.get('/user-info', (req: Request, res: Response) => {
        const user = getUser(req);
        res.json({ user });
      });

      // Route that requires JWT (using getUser with fallback)
      app.get('/protected-operation', (req: Request, res: Response) => {
        const user = getUser(req);
        if (!user || user.id === 'user-1') {
          // user-1 is default, means no valid auth
          // In real app, you'd use authMiddleware instead
          res.status(401).json({ error: 'Not authenticated' });
          return;
        }
        res.json({ user });
      });
    });

    it('should extract user from JWT in route handler', async () => {
      const tokenPair = generateTokenPair('route-user', 'route-org');
      const req = {
        method: 'GET',
        path: '/user-info',
        headers: {
          authorization: `Bearer ${tokenPair.accessToken}`,
        },
        cookies: {},
      } as any as Request;

      const res = {} as any as Response;
      let responseData: any = null;
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data: any) => {
        responseData = data;
        return res;
      };

      optionalAuthMiddleware(req, res, () => {
        const user = getUser(req);
        expect(user.id).toBe('route-user');
        expect(user.organizationId).toBe('route-org');
      });
    });

    it('should handle route with optional JWT auth', () => {
      const tokenPair = generateTokenPair('test-user', 'test-org');

      // First request with token
      const req1 = {
        headers: {
          authorization: `Bearer ${tokenPair.accessToken}`,
        },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(req1, {} as Response, () => {
        const user = getUser(req1);
        expect(user.id).toBe('test-user');
      });

      // Second request without token — getUser() now throws
      const req2 = {
        headers: {},
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(req2, {} as Response, () => {
        expect(() => getUser(req2)).toThrow('Authentication required');
      });
    });
  });

  describe('CRUD operations with JWT auth', () => {
    beforeEach(() => {
      // Mock route: Create resource
      app.post('/resources', (req: Request, res: Response) => {
        const user = getUser(req);
        res.status(201).json({
          id: 'resource-1',
          name: req.body.name,
          owner: user.id,
          organizationId: user.organizationId,
        });
      });

      // Mock route: Read resource
      app.get('/resources/:id', (req: Request, res: Response) => {
        const user = getUser(req);
        res.json({
          id: req.params.id,
          accessedBy: user.id,
          organizationId: user.organizationId,
        });
      });

      // Mock route: Update resource
      app.put('/resources/:id', (req: Request, res: Response) => {
        const user = getUser(req);
        res.json({
          id: req.params.id,
          updatedBy: user.id,
          organizationId: user.organizationId,
        });
      });

      // Mock route: Delete resource
      app.delete('/resources/:id', (req: Request, res: Response) => {
        const user = getUser(req);
        res.status(204).send();
      });
    });

    it('should preserve user context across CRUD operations', () => {
      const tokenPair = generateTokenPair('crud-user', 'crud-org');

      // CREATE
      const createReq = {
        method: 'POST',
        path: '/resources',
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        cookies: {},
        body: { name: 'My Resource' },
      } as any as Request;

      optionalAuthMiddleware(createReq, {} as Response, () => {
        const user = getUser(createReq);
        expect(user.id).toBe('crud-user');
      });

      // READ
      const readReq = {
        method: 'GET',
        path: '/resources/1',
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(readReq, {} as Response, () => {
        const user = getUser(readReq);
        expect(user.id).toBe('crud-user');
      });

      // UPDATE
      const updateReq = {
        method: 'PUT',
        path: '/resources/1',
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(updateReq, {} as Response, () => {
        const user = getUser(updateReq);
        expect(user.id).toBe('crud-user');
      });

      // DELETE
      const deleteReq = {
        method: 'DELETE',
        path: '/resources/1',
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(deleteReq, {} as Response, () => {
        const user = getUser(deleteReq);
        expect(user.id).toBe('crud-user');
      });
    });
  });

  describe('Multi-org operations with JWT auth', () => {
    beforeEach(() => {
      app.post('/teams', (req: Request, res: Response) => {
        const user = getUser(req);
        res.status(201).json({
          id: 'team-1',
          name: req.body.name,
          organizationId: user.organizationId,
          createdBy: user.id,
        });
      });

      app.get('/teams', (req: Request, res: Response) => {
        const user = getUser(req);
        res.json({
          teams: [
            { id: 'team-1', organizationId: user.organizationId },
          ],
          requestedBy: user.id,
        });
      });
    });

    it('should isolate organizations using JWT organizationId', () => {
      const org1Tokens = generateTokenPair('user-org1', 'org-1');
      const org2Tokens = generateTokenPair('user-org2', 'org-2');

      // User 1 request
      const req1 = {
        headers: { authorization: `Bearer ${org1Tokens.accessToken}` },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(req1, {} as Response, () => {
        const user = getUser(req1);
        expect(user.organizationId).toBe('org-1');
      });

      // User 2 request
      const req2 = {
        headers: { authorization: `Bearer ${org2Tokens.accessToken}` },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(req2, {} as Response, () => {
        const user = getUser(req2);
        expect(user.organizationId).toBe('org-2');
      });
    });

    it('should not allow cross-organization access based on JWT isolation', () => {
      const org1Tokens = generateTokenPair('user-org1', 'org-1');
      const org2Tokens = generateTokenPair('user-org2', 'org-2');

      const users = new Map();

      // Record user 1
      const req1 = {
        headers: { authorization: `Bearer ${org1Tokens.accessToken}` },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(req1, {} as Response, () => {
        const user = getUser(req1);
        users.set('user1', user);
      });

      // Record user 2
      const req2 = {
        headers: { authorization: `Bearer ${org2Tokens.accessToken}` },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(req2, {} as Response, () => {
        const user = getUser(req2);
        users.set('user2', user);
      });

      // Verify they're in different orgs
      const user1 = users.get('user1');
      const user2 = users.get('user2');

      expect(user1.organizationId).not.toBe(user2.organizationId);
    });
  });

  describe('Route error handling', () => {
    it('should handle routes that don\'t extract user gracefully', () => {
      app.get('/no-user-extraction', (_req: Request, res: Response) => {
        // Route doesn't call getUser(), just responds with data
        res.json({ message: 'ok' });
      });

      const tokenPair = generateTokenPair('test-user', 'test-org');
      const req = {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        cookies: {},
      } as any as Request;

      let nextCalled = false;
      optionalAuthMiddleware(req, {} as Response, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.user).toBeDefined();
    });

    it('should handle routes with missing request properties', () => {
      const tokenPair = generateTokenPair('test-user', 'test-org');
      const req = {
        headers: { authorization: `Bearer ${tokenPair.accessToken}` },
        // Missing cookies property
      } as any as Request;

      let nextCalled = false;
      optionalAuthMiddleware(req, {} as Response, () => {
        nextCalled = true;
        const user = getUser(req);
        expect(user.id).toBe('test-user');
      });

      expect(nextCalled).toBe(true);
    });
  });

  describe('Legacy header migration scenarios', () => {
    it('should reject legacy header requests (no more header fallback)', () => {
      // Old-style request with headers — should now be rejected
      const legacyReq = {
        headers: {
          'x-user-id': 'legacy-user',
          'x-org-id': 'legacy-org',
        },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(legacyReq, {} as Response, () => {
        expect(() => getUser(legacyReq)).toThrow('Authentication required');
      });

      // New-style request with JWT should still work
      const newTokenPair = generateTokenPair('new-user', 'new-org');
      const newReq = {
        headers: {
          authorization: `Bearer ${newTokenPair.accessToken}`,
        },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(newReq, {} as Response, () => {
        const user = getUser(newReq);
        expect(user.id).toBe('new-user');
      });
    });

    it('should handle routes that check for JWT before falling back to headers', () => {
      const tokenPair = generateTokenPair('jwt-user', 'jwt-org');

      // Request with both JWT and legacy headers
      const req = {
        headers: {
          authorization: `Bearer ${tokenPair.accessToken}`,
          'x-user-id': 'legacy-user',
          'x-org-id': 'legacy-org',
        },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(req, {} as Response, () => {
        const user = getUser(req);
        // Should prefer JWT
        expect(user.id).toBe('jwt-user');
        // Should not use legacy headers
        expect(user.id).not.toBe('legacy-user');
      });
    });
  });

  describe('Request state isolation', () => {
    it('should not leak user state between requests', () => {
      const user1Tokens = generateTokenPair('user-1', 'org-1');
      const user2Tokens = generateTokenPair('user-2', 'org-2');

      const req1 = {
        headers: { authorization: `Bearer ${user1Tokens.accessToken}` },
        cookies: {},
      } as any as Request;

      const req2 = {
        headers: { authorization: `Bearer ${user2Tokens.accessToken}` },
        cookies: {},
      } as any as Request;

      optionalAuthMiddleware(req1, {} as Response, () => {
        const user = getUser(req1);
        expect(user.id).toBe('user-1');
      });

      optionalAuthMiddleware(req2, {} as Response, () => {
        const user = getUser(req2);
        expect(user.id).toBe('user-2');
      });

      // Verify first request still has correct user
      optionalAuthMiddleware(req1, {} as Response, () => {
        const user = getUser(req1);
        expect(user.id).toBe('user-1');
      });
    });
  });

  describe('Concurrent request handling', () => {
    it('should handle multiple concurrent requests with different users', async () => {
      const users = [
        generateTokenPair('user-1', 'org-1'),
        generateTokenPair('user-2', 'org-2'),
        generateTokenPair('user-3', 'org-3'),
      ];

      const results: Array<{ id: string; org: string }> = [];

      // Simulate concurrent requests
      for (const tokenPair of users) {
        const req = {
          headers: { authorization: `Bearer ${tokenPair.accessToken}` },
          cookies: {},
        } as any as Request;

        optionalAuthMiddleware(req, {} as Response, () => {
          const user = getUser(req);
          results.push({ id: user.id, org: user.organizationId });
        });
      }

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('user-1');
      expect(results[1].id).toBe('user-2');
      expect(results[2].id).toBe('user-3');
    });
  });
});
