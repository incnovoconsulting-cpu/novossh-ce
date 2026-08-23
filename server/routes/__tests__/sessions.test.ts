import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { sessionRouter, sessionService, permissionService, playbackService } from '../sessions';

let app: express.Application;

beforeEach(() => {
  app = express();
  app.use(express.json());
  app.use('/api/sessions', sessionRouter);

  vi.spyOn(sessionService, 'createSession');
  vi.spyOn(sessionService, 'listSessions');
  vi.spyOn(sessionService, 'getSession');
  vi.spyOn(sessionService, 'endSession');
  vi.spyOn(sessionService, 'addParticipant');
  vi.spyOn(sessionService, 'removeParticipant');
  vi.spyOn(sessionService, 'listParticipants');
  vi.spyOn(sessionService, 'recordCommand');
  vi.spyOn(sessionService, 'getSessionHistory');
  vi.spyOn(sessionService, 'updateCommand');
  vi.spyOn(sessionService, 'updateSession');
  vi.spyOn(permissionService, 'checkPermission');
  vi.spyOn(playbackService, 'getPlaybackData');
  vi.spyOn(playbackService, 'getSessionTimeline');
  vi.spyOn(playbackService, 'exportAsScript');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Sessions Routes', () => {
  describe('POST /api/sessions', () => {
    it('should create session with valid input', async () => {
      const mockSession = {
        id: 'session-1',
        vault_id: 'vault-1',
        team_id: 'team-1',
        creator_id: 'user-1',
        name: 'SSH Session',
        description: 'Production server',
        started_at: new Date(),
      };

      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (sessionService.createSession as any).mockResolvedValueOnce(mockSession);
      (sessionService.addParticipant as any).mockResolvedValueOnce({
        session_id: 'session-1',
        user_id: 'user-1',
        is_observer: false,
      });

      const response = await request(app)
        .post('/api/sessions')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          vaultId: 'vault-1',
          teamId: 'team-1',
          name: 'SSH Session',
          description: 'Production server',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('session-1');
      expect(response.body.name).toBe('SSH Session');
    });

    it('should return 400 when vaultId is missing', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ teamId: 'team-1' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Vault ID and Team ID are required');
    });

    it('should return 500 on service error', async () => {
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (sessionService.createSession as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/sessions')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({
          vaultId: 'vault-1',
          teamId: 'team-1',
          name: 'SSH Session',
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create session');
    });
  });

  describe('GET /api/sessions', () => {
    it('should list sessions', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          vault_id: 'vault-1',
          team_id: 'team-1',
          creator_id: 'user-1',
          name: 'SSH Session',
          started_at: new Date(),
        },
      ];

      (sessionService.listSessions as any).mockResolvedValueOnce(mockSessions);

      const response = await request(app)
        .get('/api/sessions')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe('session-1');
    });

    it('should return 500 on service error', async () => {
      (sessionService.listSessions as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/sessions')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to list sessions');
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should get session details', async () => {
      const mockSession = {
        id: 'session-1',
        vault_id: 'vault-1',
        team_id: 'team-1',
        creator_id: 'user-1',
        name: 'SSH Session',
        started_at: new Date(),
      };

      (sessionService.getSession as any).mockResolvedValueOnce(mockSession);

      const response = await request(app)
        .get('/api/sessions/session-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('session-1');
      expect(response.body.name).toBe('SSH Session');
    });

    it('should return 404 when session not found', async () => {
      (sessionService.getSession as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/sessions/session-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Session not found');
    });

    it('should return 500 on service error', async () => {
      (sessionService.getSession as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/sessions/session-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get session');
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should end session', async () => {
      const session = {
        id: 'session-1',
        vault_id: 'vault-1',
        team_id: 'team-1',
        creator_id: 'user-1',
        name: 'SSH Session',
        started_at: new Date(),
      };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (sessionService.endSession as any).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete('/api/sessions/session-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(204);
    });

    it('should return 404 when session not found', async () => {
      (sessionService.getSession as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/sessions/session-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Session not found');
    });

    it('should return 500 on service error', async () => {
      const session = {
        id: 'session-1',
        vault_id: 'vault-1',
        team_id: 'team-1',
        creator_id: 'user-1',
        name: 'SSH Session',
        started_at: new Date(),
      };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (sessionService.endSession as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .delete('/api/sessions/session-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to end session');
    });
  });

  describe('PUT /api/sessions/:id', () => {
    it('should update session', async () => {
      const session = {
        id: 'session-1',
        vault_id: 'vault-1',
        team_id: 'team-1',
        name: 'SSH Session',
      };

      const updated = {
        id: 'session-1',
        vault_id: 'vault-1',
        team_id: 'team-1',
        name: 'Updated Session',
      };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (sessionService.updateSession as any).mockResolvedValueOnce(updated);

      const response = await request(app)
        .put('/api/sessions/session-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ name: 'Updated Session' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Session');
    });

    it('should return 403 without permission', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const response = await request(app)
        .put('/api/sessions/session-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ name: 'Updated' });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/sessions/:id/join', () => {
    it('should join session', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const participant = { id: 'p-1', user_id: 'user-1', is_observer: false };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (sessionService.addParticipant as any).mockResolvedValueOnce(participant);

      const response = await request(app)
        .post('/api/sessions/session-1/join')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ isObserver: false });

      expect(response.status).toBe(201);
      expect(response.body.user_id).toBe('user-1');
    });

    it('should return 403 without permission', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/sessions/session-1/join')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ isObserver: false });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/sessions/:id/leave', () => {
    it('should leave session', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (sessionService.removeParticipant as any).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete('/api/sessions/session-1/leave')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(204);
    });

    it('should return 404 when session not found', async () => {
      (sessionService.getSession as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/sessions/session-1/leave')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/sessions/:id/participants', () => {
    it('should list participants', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const participants = [
        { id: 'p-1', user_id: 'user-1', is_observer: false },
        { id: 'p-2', user_id: 'user-2', is_observer: true },
      ];

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (sessionService.listParticipants as any).mockResolvedValueOnce(participants);

      const response = await request(app)
        .get('/api/sessions/session-1/participants')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should return 403 without permission', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const response = await request(app)
        .get('/api/sessions/session-1/participants')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/sessions/:id/commands', () => {
    it('should record command', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const command = { id: 'cmd-1', command: 'ls', output: 'file.txt', exit_code: 0 };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (sessionService.recordCommand as any).mockResolvedValueOnce(command);

      const response = await request(app)
        .post('/api/sessions/session-1/commands')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ command: 'ls', output: 'file.txt', exitCode: 0 });

      expect(response.status).toBe(201);
      expect(response.body.command).toBe('ls');
    });

    it('should return 400 without command', async () => {
      const response = await request(app)
        .post('/api/sessions/session-1/commands')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ output: 'test' });

      expect(response.status).toBe(400);
    });

    it('should return 403 without permission', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/sessions/session-1/commands')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ command: 'ls' });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/sessions/:id/commands', () => {
    it('should get command history', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const commands = [
        { id: 'cmd-1', command: 'ls', output: 'file.txt' },
        { id: 'cmd-2', command: 'pwd', output: '/home' },
      ];

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (sessionService.getSessionHistory as any).mockResolvedValueOnce(commands);

      const response = await request(app)
        .get('/api/sessions/session-1/commands')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should return 403 without permission', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const response = await request(app)
        .get('/api/sessions/session-1/commands')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/sessions/:id/commands/:cmdId', () => {
    it('should update command output', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const updated = { id: 'cmd-1', output: 'updated', exit_code: 1 };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (sessionService.updateCommand as any).mockResolvedValueOnce(updated);

      const response = await request(app)
        .put('/api/sessions/session-1/commands/cmd-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({ output: 'updated', exitCode: 1 });

      expect(response.status).toBe(200);
      expect(response.body.output).toBe('updated');
    });

    it('should return 400 without output and exitCode', async () => {
      const response = await request(app)
        .put('/api/sessions/session-1/commands/cmd-1')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/sessions/:id/playback', () => {
    it('should get playback data', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const playbackData = {
        sessionId: 'session-1',
        startTime: new Date(),
        totalDuration: 10000,
        commandCount: 2,
        participantCount: 1,
        frames: [
          { type: 'command', timestamp: 1000, command: 'ls' },
          { type: 'output', timestamp: 1050, output: 'file.txt' },
        ],
      };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.getPlaybackData as any).mockResolvedValueOnce(playbackData);

      const response = await request(app)
        .get('/api/sessions/session-1/playback')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.body.commandCount).toBe(2);
      expect(response.body.frames).toHaveLength(2);
    });

    it('should return 404 when session not found', async () => {
      (sessionService.getSession as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/sessions/session-1/playback')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(404);
    });

    it('should return 403 without permission', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const response = await request(app)
        .get('/api/sessions/session-1/playback')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/sessions/:id/timeline', () => {
    it('should get timeline statistics', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const timeline = {
        startTime: new Date(),
        endTime: new Date(),
        commandCount: 5,
        avgCommandInterval: 2000,
        lastCommandTime: new Date(),
      };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.getSessionTimeline as any).mockResolvedValueOnce(timeline);

      const response = await request(app)
        .get('/api/sessions/session-1/timeline')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.body.commandCount).toBe(5);
      expect(response.body.avgCommandInterval).toBe(2000);
    });

    it('should return 403 without permission', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const response = await request(app)
        .get('/api/sessions/session-1/timeline')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/sessions/:id/export', () => {
    it('should export as bash script', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const bashScript = '#!/bin/bash\necho "test"\n./test\n';

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.exportAsScript as any).mockResolvedValueOnce(bashScript);

      const response = await request(app)
        .get('/api/sessions/session-1/export?format=bash')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.text).toContain('#!/bin/bash');
      expect(response.headers['content-type']).toContain('text/plain');
    });

    it('should export as JSON', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const jsonData = JSON.stringify({ sessionId: 'session-1', frames: [] });

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.exportAsScript as any).mockResolvedValueOnce(jsonData);

      const response = await request(app)
        .get('/api/sessions/session-1/export?format=json')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should return 400 for invalid format', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);

      const response = await request(app)
        .get('/api/sessions/session-1/export?format=invalid')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(400);
    });

    it('should return 403 without permission', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(false);

      const response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(403);
    });

    it('should return 404 when session not found', async () => {
      (sessionService.getSession as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(404);
    });

    it('should set correct content disposition header for bash export', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const bashScript = '#!/bin/bash\necho "test"\n';

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.exportAsScript as any).mockResolvedValueOnce(bashScript);

      const response = await request(app)
        .get('/api/sessions/session-1/export?format=bash')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('session-replay.sh');
    });

    it('should set correct content disposition header for json export', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const jsonData = JSON.stringify({ sessionId: 'session-1', frames: [] });

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.exportAsScript as any).mockResolvedValueOnce(jsonData);

      const response = await request(app)
        .get('/api/sessions/session-1/export?format=json')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('session-playback.json');
    });

    it('should return 500 on export service error', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.exportAsScript as any).mockRejectedValueOnce(new Error('Export failed'));

      const response = await request(app)
        .get('/api/sessions/session-1/export?format=bash')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to export session');
    });

    it('should default to bash format when format not specified', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const bashScript = '#!/bin/bash\necho test\n';

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.exportAsScript as any).mockResolvedValueOnce(bashScript);

      const response = await request(app)
        .get('/api/sessions/session-1/export')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toContain('session-replay.sh');
      expect((playbackService.exportAsScript as any).mock.calls[0][1]).toBe('bash');
    });
  });

  describe('GET /api/sessions/:id/playback - additional tests', () => {
    it('should return playback data with frame information', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const playbackData = {
        sessionId: 'session-1',
        startTime: new Date('2024-01-01T12:00:00Z'),
        endTime: new Date('2024-01-01T12:00:30Z'),
        totalDuration: 30000,
        commandCount: 5,
        participantCount: 2,
        frames: [
          { type: 'command', timestamp: 1000, command: 'ls -la', userId: 'user-1' },
          { type: 'output', timestamp: 1050, output: 'total 24', exitCode: 0 },
          { type: 'command', timestamp: 5000, command: 'pwd', userId: 'user-2' },
          { type: 'output', timestamp: 5050, output: '/home/user', exitCode: 0 },
        ],
      };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.getPlaybackData as any).mockResolvedValueOnce(playbackData);

      const response = await request(app)
        .get('/api/sessions/session-1/playback')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe('session-1');
      expect(response.body.commandCount).toBe(5);
      expect(response.body.participantCount).toBe(2);
      expect(response.body.frames).toHaveLength(4);
    });

    it('should return 500 on playback service error', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.getPlaybackData as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/sessions/session-1/playback')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get playback data');
    });
  });

  describe('GET /api/sessions/:id/timeline - additional tests', () => {
    it('should return timeline with all statistics', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };
      const startTime = new Date('2024-01-01T12:00:00Z');
      const timeline = {
        startTime,
        endTime: new Date('2024-01-01T12:02:00Z'),
        commandCount: 10,
        avgCommandInterval: 12000,
        lastCommandTime: new Date('2024-01-01T12:01:48Z'),
      };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.getSessionTimeline as any).mockResolvedValueOnce(timeline);

      const response = await request(app)
        .get('/api/sessions/session-1/timeline')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(200);
      expect(response.body.commandCount).toBe(10);
      expect(response.body.avgCommandInterval).toBe(12000);
      expect(response.body.lastCommandTime).toBeDefined();
    });

    it('should return 404 when session not found', async () => {
      (sessionService.getSession as any).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/sessions/session-1/timeline')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(404);
    });

    it('should return 500 on timeline service error', async () => {
      const session = { id: 'session-1', team_id: 'team-1' };

      (sessionService.getSession as any).mockResolvedValueOnce(session);
      (permissionService.checkPermission as any).mockResolvedValueOnce(true);
      (playbackService.getSessionTimeline as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/sessions/session-1/timeline')
        .set('x-user-id', 'user-1')
        .set('x-org-id', 'org-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get timeline');
    });
  });
});
