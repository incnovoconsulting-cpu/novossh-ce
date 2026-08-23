import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionService, Session, SessionParticipant, SessionCommand } from '../SessionService';

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(() => mockDb),
}));

const mockDb = vi.fn();

describe('SessionService', () => {
  let service: SessionService;
  const testVaultId = 'vault-1';
  const testTeamId = 'team-1';
  const testUserId = 'user-1';
  const testUserId2 = 'user-2';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SessionService();
  });

  describe('Session Creation', () => {
    it('should create a new session', async () => {
      const mockSession: Session = {
        id: 'session-1',
        vault_id: testVaultId,
        team_id: testTeamId,
        created_by: testUserId,
        name: 'Debug Session',
        description: 'Debugging production issue',
        is_active: true,
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockSession]);

      const result = await service.createSession(
        testVaultId,
        testTeamId,
        testUserId,
        'Debug Session',
        'Debugging production issue'
      );

      expect(result.id).toBe('session-1');
      expect(result.vault_id).toBe(testVaultId);
      expect(result.team_id).toBe(testTeamId);
      expect(result.created_by).toBe(testUserId);
      expect(result.is_active).toBe(true);
    });

    it('should create session without name and description', async () => {
      const mockSession: Session = {
        id: 'session-2',
        vault_id: testVaultId,
        team_id: testTeamId,
        created_by: testUserId,
        is_active: true,
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockSession]);

      const result = await service.createSession(testVaultId, testTeamId, testUserId);

      expect(result.name).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it('should support multiple sessions per vault', async () => {
      const sessions: Session[] = [
        {
          id: 'session-1',
          vault_id: testVaultId,
          team_id: testTeamId,
          created_by: testUserId,
          is_active: true,
          created_at: new Date(),
        },
        {
          id: 'session-2',
          vault_id: testVaultId,
          team_id: testTeamId,
          created_by: testUserId,
          is_active: true,
          created_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce([sessions[0]]);
      mockDb.mockResolvedValueOnce([sessions[1]]);

      const result1 = await service.createSession(testVaultId, testTeamId, testUserId);
      const result2 = await service.createSession(testVaultId, testTeamId, testUserId);

      expect(result1.id).toBe('session-1');
      expect(result2.id).toBe('session-2');
    });
  });

  describe('Session Retrieval', () => {
    it('should retrieve session by id', async () => {
      const mockSession: Session = {
        id: 'session-1',
        vault_id: testVaultId,
        team_id: testTeamId,
        created_by: testUserId,
        name: 'Active Session',
        is_active: true,
        created_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockSession]);

      const result = await service.getSession('session-1');

      expect(result?.id).toBe('session-1');
      expect(result?.name).toBe('Active Session');
    });

    it('should return null for non-existent session', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getSession('non-existent');

      expect(result).toBeNull();
    });

    it('should not return inactive sessions', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getSession('ended-session');

      expect(result).toBeNull();
    });

    it('should list sessions for vault', async () => {
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          vault_id: testVaultId,
          team_id: testTeamId,
          created_by: testUserId,
          is_active: true,
          created_at: new Date(),
        },
        {
          id: 'session-2',
          vault_id: testVaultId,
          team_id: testTeamId,
          created_by: testUserId,
          is_active: true,
          created_at: new Date(),
        },
      ];

      mockDb.mockResolvedValue(mockSessions);

      const result = await service.listSessions(testVaultId);

      expect(result).toHaveLength(2);
    });

    it('should list sessions for team', async () => {
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          vault_id: testVaultId,
          team_id: testTeamId,
          created_by: testUserId,
          is_active: true,
          created_at: new Date(),
        },
      ];

      mockDb.mockResolvedValue(mockSessions);

      const result = await service.listSessions(undefined, testTeamId);

      expect(result).toHaveLength(1);
    });

    it('should list all sessions', async () => {
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          vault_id: 'vault-1',
          team_id: testTeamId,
          created_by: testUserId,
          is_active: true,
          created_at: new Date(),
        },
        {
          id: 'session-2',
          vault_id: 'vault-2',
          team_id: 'team-2',
          created_by: testUserId,
          is_active: true,
          created_at: new Date(),
        },
      ];

      mockDb.mockResolvedValue(mockSessions);

      const result = await service.listSessions();

      expect(result).toHaveLength(2);
    });
  });

  describe('Session Updates', () => {
    it('should update session name', async () => {
      const mockSession: Session = {
        id: 'session-1',
        vault_id: testVaultId,
        team_id: testTeamId,
        created_by: testUserId,
        name: 'Updated Session',
        is_active: true,
        created_at: new Date(),
      };

      mockDb.mockResolvedValue([mockSession]);

      const result = await service.updateSession('session-1', { name: 'Updated Session' });

      expect(result.name).toBe('Updated Session');
    });

    it('should update session description', async () => {
      const mockSession: Session = {
        id: 'session-1',
        vault_id: testVaultId,
        team_id: testTeamId,
        created_by: testUserId,
        description: 'New description',
        is_active: true,
        created_at: new Date(),
      };

      mockDb.mockResolvedValue([mockSession]);

      const result = await service.updateSession('session-1', { description: 'New description' });

      expect(result.description).toBe('New description');
    });
  });

  describe('Session Termination', () => {
    it('should end session', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.endSession('session-1');

      expect(mockDb).toHaveBeenCalled();
    });

    it('should set ended_at timestamp', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.endSession('session-1');

      expect(mockDb).toHaveBeenCalled();
    });
  });

  describe('Participant Management', () => {
    it('should add participant to session', async () => {
      const mockParticipant: SessionParticipant = {
        id: 'participant-1',
        session_id: 'session-1',
        user_id: testUserId,
        is_observer: false,
        joined_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockParticipant]);

      const result = await service.addParticipant('session-1', testUserId, false);

      expect(result.user_id).toBe(testUserId);
      expect(result.is_observer).toBe(false);
    });

    it('should add observer to session', async () => {
      const mockParticipant: SessionParticipant = {
        id: 'participant-2',
        session_id: 'session-1',
        user_id: testUserId2,
        is_observer: true,
        joined_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockParticipant]);

      const result = await service.addParticipant('session-1', testUserId2, true);

      expect(result.is_observer).toBe(true);
    });

    it('should get participant details', async () => {
      const mockParticipant: SessionParticipant = {
        id: 'participant-1',
        session_id: 'session-1',
        user_id: testUserId,
        is_observer: false,
        joined_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockParticipant]);

      const result = await service.getParticipant('session-1', testUserId);

      expect(result?.user_id).toBe(testUserId);
    });

    it('should return null for non-existent participant', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getParticipant('session-1', 'non-member');

      expect(result).toBeNull();
    });

    it('should list all participants', async () => {
      const mockParticipants: SessionParticipant[] = [
        {
          id: 'participant-1',
          session_id: 'session-1',
          user_id: testUserId,
          is_observer: false,
          joined_at: new Date(),
        },
        {
          id: 'participant-2',
          session_id: 'session-1',
          user_id: testUserId2,
          is_observer: true,
          joined_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockParticipants);

      const result = await service.listParticipants('session-1');

      expect(result).toHaveLength(2);
    });

    it('should remove participant from session', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.removeParticipant('session-1', testUserId);

      expect(mockDb).toHaveBeenCalled();
    });

    it('should count active participants', async () => {
      mockDb.mockResolvedValueOnce([{ count: 3 }]);

      const result = await service.getParticipantCount('session-1');

      expect(result).toBe(3);
    });

    it('should check participant membership', async () => {
      const mockParticipant: SessionParticipant = {
        id: 'participant-1',
        session_id: 'session-1',
        user_id: testUserId,
        is_observer: false,
        joined_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockParticipant]);

      const result = await service.isSessionParticipant('session-1', testUserId);

      expect(result).toBe(true);
    });

    it('should return false for non-participant', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.isSessionParticipant('session-1', 'non-member');

      expect(result).toBe(false);
    });

    it('should check observer status', async () => {
      const mockParticipant: SessionParticipant = {
        id: 'participant-1',
        session_id: 'session-1',
        user_id: testUserId,
        is_observer: true,
        joined_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockParticipant]);

      const result = await service.isSessionObserver('session-1', testUserId);

      expect(result).toBe(true);
    });
  });

  describe('Command Recording', () => {
    it('should record command execution', async () => {
      const mockCommand: SessionCommand = {
        id: 'cmd-1',
        session_id: 'session-1',
        user_id: testUserId,
        command: 'ls -la',
        output: 'total 42\ndrwxr-xr-x',
        exit_code: 0,
        executed_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockCommand]);

      const result = await service.recordCommand(
        'session-1',
        testUserId,
        'ls -la',
        'total 42\ndrwxr-xr-x',
        0
      );

      expect(result.command).toBe('ls -la');
      expect(result.exit_code).toBe(0);
    });

    it('should record command without output initially', async () => {
      const mockCommand: SessionCommand = {
        id: 'cmd-2',
        session_id: 'session-1',
        user_id: testUserId,
        command: 'sleep 10',
        executed_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockCommand]);

      const result = await service.recordCommand('session-1', testUserId, 'sleep 10');

      expect(result.command).toBe('sleep 10');
      expect(result.output).toBeUndefined();
      expect(result.exit_code).toBeUndefined();
    });

    it('should get command details', async () => {
      const mockCommand: SessionCommand = {
        id: 'cmd-1',
        session_id: 'session-1',
        user_id: testUserId,
        command: 'pwd',
        output: '/home/user',
        exit_code: 0,
        executed_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockCommand]);

      const result = await service.getCommand('cmd-1');

      expect(result?.command).toBe('pwd');
    });

    it('should update command with output and exit code', async () => {
      const mockCommand: SessionCommand = {
        id: 'cmd-2',
        session_id: 'session-1',
        user_id: testUserId,
        command: 'npm test',
        output: 'All tests passed',
        exit_code: 0,
        executed_at: new Date(),
        completed_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockCommand]);

      const result = await service.updateCommand('cmd-2', 'All tests passed', 0);

      expect(result.output).toBe('All tests passed');
      expect(result.exit_code).toBe(0);
    });

    it('should list commands in session', async () => {
      const mockCommands: SessionCommand[] = [
        {
          id: 'cmd-1',
          session_id: 'session-1',
          user_id: testUserId,
          command: 'cd /app',
          executed_at: new Date(),
        },
        {
          id: 'cmd-2',
          session_id: 'session-1',
          user_id: testUserId,
          command: 'ls -la',
          executed_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockCommands);

      const result = await service.listCommands('session-1');

      expect(result).toHaveLength(2);
    });

    it('should get session history in order', async () => {
      const mockCommands: SessionCommand[] = [
        {
          id: 'cmd-1',
          session_id: 'session-1',
          user_id: testUserId,
          command: 'cd /app',
          executed_at: new Date(Date.now() - 10000),
        },
        {
          id: 'cmd-2',
          session_id: 'session-1',
          user_id: testUserId,
          command: 'npm test',
          executed_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockCommands);

      const result = await service.getSessionHistory('session-1');

      expect(result).toHaveLength(2);
      expect(result[0].command).toBe('cd /app');
    });

    it('should count commands in session', async () => {
      mockDb.mockResolvedValueOnce([{ count: 42 }]);

      const result = await service.getSessionCommandCount('session-1');

      expect(result).toBe(42);
    });
  });

  describe('Session Queries', () => {
    it('should get active sessions for team', async () => {
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          vault_id: 'vault-1',
          team_id: testTeamId,
          created_by: testUserId,
          is_active: true,
          created_at: new Date(),
        },
        {
          id: 'session-2',
          vault_id: 'vault-2',
          team_id: testTeamId,
          created_by: testUserId,
          is_active: true,
          created_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockSessions);

      const result = await service.getActiveSessions(testTeamId);

      expect(result).toHaveLength(2);
      expect(result.every(s => s.is_active)).toBe(true);
    });

    it('should get sessions by vault', async () => {
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          vault_id: testVaultId,
          team_id: testTeamId,
          created_by: testUserId,
          is_active: true,
          created_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockSessions);

      const result = await service.getSessionsByVault(testVaultId);

      expect(result).toHaveLength(1);
      expect(result[0].vault_id).toBe(testVaultId);
    });
  });

  describe('Multi-User Scenarios', () => {
    it('should support multiple participants with different roles', async () => {
      const participant1: SessionParticipant = {
        id: 'p1',
        session_id: 'session-1',
        user_id: testUserId,
        is_observer: false,
        joined_at: new Date(),
      };

      const participant2: SessionParticipant = {
        id: 'p2',
        session_id: 'session-1',
        user_id: testUserId2,
        is_observer: true,
        joined_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([participant1]);
      mockDb.mockResolvedValueOnce([participant2]);

      const result1 = await service.addParticipant('session-1', testUserId, false);
      const result2 = await service.addParticipant('session-1', testUserId2, true);

      expect(result1.is_observer).toBe(false);
      expect(result2.is_observer).toBe(true);
    });

    it('should support multiple commands from different users', async () => {
      const cmd1: SessionCommand = {
        id: 'cmd-1',
        session_id: 'session-1',
        user_id: testUserId,
        command: 'echo "User 1"',
        output: 'User 1',
        exit_code: 0,
        executed_at: new Date(),
      };

      const cmd2: SessionCommand = {
        id: 'cmd-2',
        session_id: 'session-1',
        user_id: testUserId2,
        command: 'echo "User 2"',
        output: 'User 2',
        exit_code: 0,
        executed_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([cmd1]);
      mockDb.mockResolvedValueOnce([cmd2]);

      const result1 = await service.recordCommand('session-1', testUserId, 'echo "User 1"', 'User 1', 0);
      const result2 = await service.recordCommand('session-1', testUserId2, 'echo "User 2"', 'User 2', 0);

      expect(result1.user_id).toBe(testUserId);
      expect(result2.user_id).toBe(testUserId2);
    });

    it('should handle large sessions with many participants', async () => {
      const participants: SessionParticipant[] = Array.from({ length: 50 }, (_, i) => ({
        id: `p-${i}`,
        session_id: 'session-1',
        user_id: `user-${i}`,
        is_observer: i > 40,
        joined_at: new Date(),
      }));

      mockDb.mockResolvedValueOnce(participants);

      const result = await service.listParticipants('session-1');

      expect(result).toHaveLength(50);
    });
  });

  describe('Command History & Audit', () => {
    it('should preserve command execution order', async () => {
      const now = Date.now();
      const commands: SessionCommand[] = [
        {
          id: 'cmd-1',
          session_id: 'session-1',
          user_id: testUserId,
          command: 'cd /app',
          executed_at: new Date(now - 3000),
        },
        {
          id: 'cmd-2',
          session_id: 'session-1',
          user_id: testUserId,
          command: 'npm install',
          executed_at: new Date(now - 2000),
        },
        {
          id: 'cmd-3',
          session_id: 'session-1',
          user_id: testUserId,
          command: 'npm test',
          executed_at: new Date(now - 1000),
        },
      ];

      mockDb.mockResolvedValueOnce(commands);

      const result = await service.getSessionHistory('session-1');

      expect(result[0].command).toBe('cd /app');
      expect(result[1].command).toBe('npm install');
      expect(result[2].command).toBe('npm test');
    });

    it('should track command output and exit codes', async () => {
      const cmd: SessionCommand = {
        id: 'cmd-1',
        session_id: 'session-1',
        user_id: testUserId,
        command: 'test -f file.txt && echo "exists" || echo "missing"',
        output: 'missing',
        exit_code: 1,
        executed_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([cmd]);

      const result = await service.recordCommand(
        'session-1',
        testUserId,
        'test -f file.txt && echo "exists" || echo "missing"',
        'missing',
        1
      );

      expect(result.output).toBe('missing');
      expect(result.exit_code).toBe(1);
    });
  });
});
