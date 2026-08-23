import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { teamRouter, teamService, permissionService } from '../teams';

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
  app.use('/api/teams', teamRouter);

  vi.spyOn(teamService, 'createTeam');
  vi.spyOn(teamService, 'listTeams');
  vi.spyOn(teamService, 'getTeam');
  vi.spyOn(teamService, 'updateTeam');
  vi.spyOn(teamService, 'deleteTeam');
  vi.spyOn(teamService, 'addTeamMember');
  vi.spyOn(permissionService, 'checkPermission');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Teams Routes', () => {
  describe('POST /api/teams', () => {
    it('should create team with valid input', async () => {
      const mockTeam = {
        id: 'team-1',
        organization_id: 'org-1',
        name: 'Engineering',
        description: 'Engineering team',
        created_at: new Date(),
      };

      (teamService.createTeam as any).mockResolvedValueOnce(mockTeam);
      (teamService.addTeamMember as any).mockResolvedValueOnce({
        team_id: 'team-1',
        user_id: 'user-1',
        role: 'owner',
      });

      const response = await request(app)
        .post('/api/teams')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ name: 'Engineering', description: 'Engineering team' });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('team-1');
      expect(response.body.name).toBe('Engineering');
    });

    it('should return 400 when team name is missing', async () => {
      const response = await request(app)
        .post('/api/teams')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ description: 'Missing name' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Team name is required');
    });

    it('should return 500 on service error', async () => {
      (teamService.createTeam as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/teams')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ name: 'Engineering' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create team');
    });
  });

  describe('GET /api/teams', () => {
    it('should list teams', async () => {
      const mockTeams = [
        {
          id: 'team-1',
          organization_id: 'org-1',
          name: 'Engineering',
          created_at: new Date(),
        },
      ];

      (teamService.listTeams as any).mockResolvedValueOnce(mockTeams);

      const response = await request(app)
        .get('/api/teams')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('team-1');
    });

    it('should return 500 on service error', async () => {
      (teamService.listTeams as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/teams')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to list teams');
    });
  });

  describe('GET /api/teams/:id', () => {
    it('should get team details', async () => {
      const mockTeam = {
        id: 'team-1',
        organization_id: 'org-1',
        name: 'Engineering',
        created_at: new Date(),
      };

      (teamService.getTeam as any).mockResolvedValueOnce(mockTeam);

      const response = await request(app)
        .get('/api/teams/team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('team-1');
      expect(response.body.name).toBe('Engineering');
    });

    it('should return 404 when team not found', async () => {
      (teamService.getTeam as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/teams/team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Team not found');
    });

    it('should return 500 on service error', async () => {
      (teamService.getTeam as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/teams/team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get team');
    });
  });

  describe('PUT /api/teams/:id', () => {
    it('should update team', async () => {
      const existingTeam = {
        id: 'team-1',
        organization_id: 'org-1',
        name: 'Engineering',
        created_at: new Date(),
      };

      const updatedTeam = {
        ...existingTeam,
        name: 'Product',
      };

      (teamService.getTeam as any).mockResolvedValueOnce(existingTeam);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (teamService.updateTeam as any).mockResolvedValueOnce(updatedTeam);

      const response = await request(app)
        .put('/api/teams/team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ name: 'Product' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Product');
    });

    it('should return 404 when team not found', async () => {
      (teamService.getTeam as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/teams/team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Team not found');
    });

    it('should return 500 on service error', async () => {
      const team = {
        id: 'team-1',
        organization_id: 'org-1',
        name: 'Engineering',
        created_at: new Date(),
      };

      (teamService.getTeam as any).mockResolvedValueOnce(team);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (teamService.updateTeam as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .put('/api/teams/team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to update team');
    });
  });

  describe('DELETE /api/teams/:id', () => {
    it('should delete team', async () => {
      const team = {
        id: 'team-1',
        organization_id: 'org-1',
        name: 'Engineering',
        created_at: new Date(),
      };

      (teamService.getTeam as any).mockResolvedValueOnce(team);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (teamService.deleteTeam as any).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete('/api/teams/team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(204);
    });

    it('should return 404 when team not found', async () => {
      (teamService.getTeam as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/teams/team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Team not found');
    });

    it('should return 500 on service error', async () => {
      const team = {
        id: 'team-1',
        organization_id: 'org-1',
        name: 'Engineering',
        created_at: new Date(),
      };

      (teamService.getTeam as any).mockResolvedValueOnce(team);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (teamService.deleteTeam as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .delete('/api/teams/team-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete team');
    });
  });
});
