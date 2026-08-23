import { getDb } from '../db/connection.js';

export interface Session {
  id: string;
  vault_id: string;
  team_id: string | null;
  created_by: string;
  name?: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  ended_at?: Date;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  is_observer: boolean;
  joined_at: Date;
  left_at?: Date;
}

export interface SessionCommand {
  id: string;
  session_id: string;
  user_id: string;
  command: string;
  output?: string;
  exit_code?: number;
  executed_at: Date;
  completed_at?: Date;
}

export class SessionService {
  private db = getDb();

  async createSession(
    vaultId: string,
    teamId: string | null,
    createdBy: string,
    name?: string,
    description?: string
  ): Promise<Session> {
    const result = await this.db`
      INSERT INTO sessions (vault_id, team_id, created_by, name, description)
      VALUES (${vaultId}, ${teamId}, ${createdBy}, ${name || null}, ${description || null})
      RETURNING *
    `;
    return result[0] as Session;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const result = await this.db`
      SELECT * FROM sessions WHERE id = ${sessionId} AND is_active = true
    `;
    return result.length > 0 ? (result[0] as Session) : null;
  }

  async listSessions(vaultId?: string, teamId?: string): Promise<Session[]> {
    // Unified query with conditional WHERE clauses for better query plan reuse
    const query = this.db`
      SELECT * FROM sessions
      WHERE is_active = true
        ${vaultId ? this.db`AND vault_id = ${vaultId}` : this.db``}
        ${teamId ? this.db`AND team_id = ${teamId}` : this.db``}
      ORDER BY created_at DESC
    `;

    return query as unknown as Promise<Session[]>;
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const { name, description } = updates;
    const result = await this.db`
      UPDATE sessions
      SET
        name = ${name || this.db`name`},
        description = ${description || this.db`description`}
      WHERE id = ${sessionId}
      RETURNING *
    `;
    return result[0] as Session;
  }

  async endSession(sessionId: string): Promise<void> {
    await this.db`
      UPDATE sessions
      SET is_active = false, ended_at = NOW()
      WHERE id = ${sessionId}
    `;
  }

  async addParticipant(
    sessionId: string,
    userId: string,
    isObserver: boolean = false
  ): Promise<SessionParticipant> {
    const result = await this.db`
      INSERT INTO session_participants (session_id, user_id, is_observer)
      VALUES (${sessionId}, ${userId}, ${isObserver})
      ON CONFLICT (session_id, user_id) WHERE left_at IS NULL DO UPDATE
      SET left_at = NULL
      RETURNING *
    `;
    return result[0] as SessionParticipant;
  }

  async getParticipant(sessionId: string, userId: string): Promise<SessionParticipant | null> {
    const result = await this.db`
      SELECT * FROM session_participants
      WHERE session_id = ${sessionId} AND user_id = ${userId} AND left_at IS NULL
    `;
    return result.length > 0 ? (result[0] as SessionParticipant) : null;
  }

  async listParticipants(sessionId: string): Promise<SessionParticipant[]> {
    const result = await this.db`
      SELECT * FROM session_participants
      WHERE session_id = ${sessionId} AND left_at IS NULL
      ORDER BY joined_at ASC
    `;
    return result as unknown as SessionParticipant[];
  }

  async removeParticipant(sessionId: string, userId: string): Promise<void> {
    await this.db`
      UPDATE session_participants
      SET left_at = NOW()
      WHERE session_id = ${sessionId} AND user_id = ${userId}
    `;
  }

  async getParticipantCount(sessionId: string): Promise<number> {
    const result = await this.db`
      SELECT COUNT(*) as count FROM session_participants
      WHERE session_id = ${sessionId} AND left_at IS NULL
    `;
    return (result[0] as { count: number }).count;
  }

  async recordCommand(
    sessionId: string,
    userId: string,
    command: string,
    output?: string,
    exitCode?: number
  ): Promise<SessionCommand> {
    const result = await this.db`
      INSERT INTO session_commands (session_id, user_id, command, output, exit_code, executed_at)
      VALUES (${sessionId}, ${userId}, ${command}, ${output || null}, ${exitCode || null}, NOW())
      RETURNING *
    `;
    return result[0] as SessionCommand;
  }

  async getCommand(commandId: string): Promise<SessionCommand | null> {
    const result = await this.db`
      SELECT * FROM session_commands WHERE id = ${commandId}
    `;
    return result.length > 0 ? (result[0] as SessionCommand) : null;
  }

  async listCommands(sessionId: string, limit: number = 100): Promise<SessionCommand[]> {
    const result = await this.db`
      SELECT * FROM session_commands
      WHERE session_id = ${sessionId}
      ORDER BY executed_at DESC
      LIMIT ${limit}
    `;
    return result as unknown as SessionCommand[];
  }

  async updateCommand(
    commandId: string,
    output: string,
    exitCode: number
  ): Promise<SessionCommand> {
    const result = await this.db`
      UPDATE session_commands
      SET output = ${output}, exit_code = ${exitCode}, completed_at = NOW()
      WHERE id = ${commandId}
      RETURNING *
    `;
    return result[0] as SessionCommand;
  }

  async getSessionHistory(sessionId: string, limit: number = 100): Promise<SessionCommand[]> {
    const result = await this.db`
      SELECT * FROM session_commands
      WHERE session_id = ${sessionId}
      ORDER BY executed_at ASC
      LIMIT ${limit}
    `;
    return result as unknown as SessionCommand[];
  }

  async getSessionCommandCount(sessionId: string): Promise<number> {
    const result = await this.db`
      SELECT COUNT(*) as count FROM session_commands
      WHERE session_id = ${sessionId}
    `;
    return (result[0] as { count: number }).count;
  }

  async isSessionParticipant(sessionId: string, userId: string): Promise<boolean> {
    // Direct query instead of loading full participant object
    const result = await this.db`
      SELECT 1 FROM session_participants
      WHERE session_id = ${sessionId} AND user_id = ${userId} AND left_at IS NULL
      LIMIT 1
    `;
    return result.length > 0;
  }

  async isSessionObserver(sessionId: string, userId: string): Promise<boolean> {
    // Direct query for is_observer flag only
    const result = await this.db`
      SELECT is_observer FROM session_participants
      WHERE session_id = ${sessionId} AND user_id = ${userId} AND left_at IS NULL
    `;
    return result.length > 0 ? (result[0] as { is_observer: boolean }).is_observer : false;
  }

  async getActiveSessions(teamId: string): Promise<Session[]> {
    const result = await this.db`
      SELECT * FROM sessions
      WHERE team_id = ${teamId} AND is_active = true
      ORDER BY created_at DESC
    `;
    return result as unknown as Session[];
  }

  async getSessionsByVault(vaultId: string): Promise<Session[]> {
    const result = await this.db`
      SELECT * FROM sessions
      WHERE vault_id = ${vaultId} AND is_active = true
      ORDER BY created_at DESC
    `;
    return result as unknown as Session[];
  }

  /**
   * Batch load participants for multiple sessions in a single query
   * Avoids N+1 problem when loading participants for many sessions
   */
  async batchLoadParticipants(sessionIds: string[]): Promise<Map<string, SessionParticipant[]>> {
    if (sessionIds.length === 0) {
      return new Map();
    }

    const result = await this.db`
      SELECT * FROM session_participants
      WHERE session_id = ANY(${sessionIds})
      AND left_at IS NULL
      ORDER BY joined_at ASC
    `;

    const map = new Map<string, SessionParticipant[]>();
    for (const sessionId of sessionIds) {
      map.set(sessionId, []);
    }

    for (const participant of result as unknown as SessionParticipant[]) {
      const participants = map.get(participant.session_id) || [];
      participants.push(participant);
      map.set(participant.session_id, participants);
    }

    return map;
  }

  /**
   * Batch load command counts for multiple sessions
   * More efficient than calling getSessionCommandCount() in a loop
   */
  async batchLoadCommandCounts(sessionIds: string[]): Promise<Map<string, number>> {
    if (sessionIds.length === 0) {
      return new Map();
    }

    const result = await this.db`
      SELECT session_id, COUNT(*) as count
      FROM session_commands
      WHERE session_id = ANY(${sessionIds})
      GROUP BY session_id
    `;

    const map = new Map<string, number>();
    for (const sessionId of sessionIds) {
      map.set(sessionId, 0);
    }

    for (const row of result as unknown as Array<{ session_id: string; count: number }>) {
      map.set(row.session_id, row.count);
    }

    return map;
  }
}
