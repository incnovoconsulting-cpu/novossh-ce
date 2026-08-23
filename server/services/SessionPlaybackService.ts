import { getDb } from '../db/connection.js';
import { SessionCommand } from './SessionService.js';
import { escapeForBash, analyzeCommandSafety, getBashScriptHeader, validateBashScript } from '../lib/bashEscaping.js';

export interface PlaybackFrame {
  type: 'command' | 'output' | 'sync';
  timestamp: number; // milliseconds since session start
  command?: string;
  output?: string;
  userId?: string;
  exitCode?: number;
}

export interface SessionPlaybackData {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalDuration: number; // milliseconds
  commandCount: number;
  participantCount: number;
  frames: PlaybackFrame[];
}

export class SessionPlaybackService {
  private db = getDb();
  private playbackCache = new Map<string, { data: SessionPlaybackData; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 60 seconds

  /**
   * Get playback data for a session
   * Reconstructs the session timeline with proper timing and sequencing
   * Includes in-memory caching for frequently accessed sessions
   */
  async getPlaybackData(sessionId: string): Promise<SessionPlaybackData | null> {
    // Check cache for non-active sessions (ended sessions don't change)
    const cached = this.playbackCache.get(sessionId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Get session info and commands in parallel for better performance
    const [sessionResult, commands, participantResult] = await Promise.all([
      this.db`SELECT id, created_at, ended_at FROM sessions WHERE id = ${sessionId}`,
      this.db`SELECT * FROM session_commands WHERE session_id = ${sessionId} ORDER BY executed_at ASC`,
      this.db`SELECT COUNT(*) as count FROM session_participants WHERE session_id = ${sessionId}`,
    ]);

    if (sessionResult.length === 0) {
      return null;
    }

    const session = sessionResult[0] as any;
    const startTime = new Date(session.created_at);
    const endTime = session.ended_at ? new Date(session.ended_at) : new Date();
    const totalDuration = endTime.getTime() - startTime.getTime();
    const participantCount = Number((participantResult[0] as any).count);

    // Build frames from commands
    const frames = this.buildPlaybackFrames(commands as unknown as SessionCommand[], startTime);

    const data: SessionPlaybackData = {
      sessionId,
      startTime,
      endTime: session.ended_at ? endTime : undefined,
      totalDuration,
      commandCount: commands.length,
      participantCount,
      frames,
    };

    // Cache ended sessions indefinitely, active sessions for 60s
    if (session.ended_at) {
      this.playbackCache.set(sessionId, { data, timestamp: Date.now() });
    }

    return data;
  }

  /**
   * Invalidate cached playback data when session changes
   */
  invalidatePlaybackCache(sessionId: string): void {
    this.playbackCache.delete(sessionId);
  }

  /**
   * Build playback frames from commands with proper timing
   * Optimized for large command sets (1000+ commands)
   */
  private buildPlaybackFrames(commands: SessionCommand[], sessionStart: Date): PlaybackFrame[] {
    const startTime = sessionStart.getTime();

    // Pre-allocate array to avoid repeated resizing
    const frames: PlaybackFrame[] = [];
    frames.length = commands.length * 2; // Maximum possible frames (command + output for each)
    let frameCount = 0;

    for (const command of commands) {
      const timestamp = new Date(command.executed_at).getTime() - startTime;

      // Add command execution frame
      frames[frameCount++] = {
        type: 'command',
        timestamp: Math.max(0, timestamp),
        command: command.command,
        userId: command.user_id,
      };

      // Add output frame if available
      if (command.output) {
        frames[frameCount++] = {
          type: 'output',
          timestamp: Math.max(timestamp, timestamp + 50),
          output: command.output,
          exitCode: command.exit_code || 0,
        };
      }
    }

    // Trim array to actual size and sort by timestamp
    frames.length = frameCount;
    frames.sort((a, b) => a.timestamp - b.timestamp);

    return frames;
  }

  /**
   * Get a specific command from session history
   */
  async getCommand(sessionId: string, commandId: string): Promise<SessionCommand | null> {
    const result = await this.db`
      SELECT * FROM session_commands
      WHERE id = ${commandId} AND session_id = ${sessionId}
    `;
    return result.length > 0 ? (result[0] as SessionCommand) : null;
  }

  /**
   * Get session commands within a time range
   */
  async getCommandsInRange(
    sessionId: string,
    startTime: Date,
    endTime: Date
  ): Promise<SessionCommand[]> {
    const result = await this.db`
      SELECT * FROM session_commands
      WHERE session_id = ${sessionId}
        AND executed_at >= ${startTime}
        AND executed_at <= ${endTime}
      ORDER BY executed_at ASC
    `;
    return result as unknown as SessionCommand[];
  }

  /**
   * Get session timeline statistics
   */
  async getSessionTimeline(sessionId: string): Promise<{
    startTime: Date;
    endTime?: Date;
    commandCount: number;
    avgCommandInterval: number; // milliseconds
    lastCommandTime?: Date;
  } | null> {
    const sessionResult = await this.db`
      SELECT created_at, ended_at FROM sessions WHERE id = ${sessionId}
    `;

    if (sessionResult.length === 0) {
      return null;
    }

    const session = sessionResult[0] as any;
    const startTime = new Date(session.created_at);
    const endTime = session.ended_at ? new Date(session.ended_at) : undefined;

    const commandResult = await this.db`
      SELECT
        COUNT(*) as count,
        MAX(executed_at) as last_command_time
      FROM session_commands
      WHERE session_id = ${sessionId}
    `;

    const command = commandResult[0] as any;
    const commandCount = command.count || 0;
    const lastCommandTime = command.last_command_time ? new Date(command.last_command_time) : undefined;

    // Calculate average command interval
    let avgCommandInterval = 0;
    if (commandCount > 1 && lastCommandTime) {
      const totalDuration = lastCommandTime.getTime() - startTime.getTime();
      avgCommandInterval = totalDuration / (commandCount - 1);
    }

    return {
      startTime,
      endTime,
      commandCount,
      avgCommandInterval,
      lastCommandTime,
    };
  }

  /**
   * Export session as a replay script
   * Returns a shell script that can be executed to replay the session
   *
   * Security features:
   * - All commands escaped with escapeForBash() to prevent injection
   * - Commands analyzed for dangerous patterns and warnings added
   * - Script validated before returning
   * - Set -e and -u options enabled for safety
   */
  async exportAsScript(
    sessionId: string,
    format: 'bash' | 'json' = 'bash',
    options?: {
      skipDangerousCommands?: boolean;
      includeWarnings?: boolean;
    }
  ): Promise<string> {
    const playbackData = await this.getPlaybackData(sessionId);
    if (!playbackData) {
      throw new Error('Session not found');
    }

    if (format === 'json') {
      return JSON.stringify(playbackData, null, 2);
    }

    // Generate bash script with security header
    let script = getBashScriptHeader();
    script += `# Session Recording Replay\n`;
    script += `# Session ID: ${sessionId}\n`;
    script += `# Duration: ${Math.round(playbackData.totalDuration / 1000)}s\n`;
    script += `# Commands: ${playbackData.commandCount}\n`;
    script += `# Generated: ${new Date().toISOString()}\n`;
    script += `# WARNING: This script replays recorded commands. Review before executing.\n\n`;

    let lastTimestamp = 0;
    const skippedCommands: string[] = [];
    const commandWarnings: Map<string, string[]> = new Map();

    for (const frame of playbackData.frames) {
      if (frame.type === 'command' && frame.command) {
        // Analyze command for dangerous patterns
        const analysis = analyzeCommandSafety(frame.command);

        // Skip if dangerous and option set
        if (options?.skipDangerousCommands && !analysis.isSafe) {
          skippedCommands.push(frame.command);
          if (options.includeWarnings) {
            script += `# SKIPPED (unsafe): ${frame.command}\n`;
            script += `# Reasons: ${analysis.warnings.join('; ')}\n\n`;
          }
          continue;
        }

        // Calculate delay from last command
        const delay = Math.max(0, frame.timestamp - lastTimestamp);
        if (delay > 0) {
          const delaySec = (delay / 1000).toFixed(1);
          script += `sleep ${delaySec}\n`;
        }

        // Add command with warnings if requested
        if (options?.includeWarnings && analysis.warnings.length > 0) {
          commandWarnings.set(frame.command, analysis.warnings);
          script += `# Warnings: ${analysis.warnings.join('; ')}\n`;
        }

        // Securely escape and execute command
        const escapedCmd = escapeForBash(frame.command);
        script += `echo ${escapedCmd}\n`;
        script += `eval ${escapedCmd}\n\n`;

        lastTimestamp = frame.timestamp;
      }
    }

    // Validate final script
    const validation = validateBashScript(script);
    if (!validation.valid) {
      // Log errors but still return script (with warnings)
      script = `# VALIDATION ERRORS:\n${validation.errors.map((e) => `# ERROR: ${e}`).join('\n')}\n\n` + script;
    }

    // Add summary comment at end if there were skipped commands
    if (skippedCommands.length > 0) {
      script += `\n# SUMMARY\n`;
      script += `# Skipped ${skippedCommands.length} unsafe commands\n`;
      script += `# To view: enable --include-warnings in export options\n`;
    }

    return script;
  }
}
