import { getDb } from '../db/connection.js';

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  invited_by?: string;
  joined_at: Date;
  left_at?: Date;
  updated_at: Date;
}

export interface TeamMemberWithRole extends TeamMember {
  user_name?: string;
}

export class TeamService {
  private db = getDb();

  async createTeam(
    organizationId: string,
    name: string,
    description?: string
  ): Promise<Team> {
    const result = await this.db`
      INSERT INTO teams (organization_id, name, description)
      VALUES (${organizationId}, ${name}, ${description || null})
      RETURNING *
    `;
    return result[0] as Team;
  }

  async getTeam(teamId: string): Promise<Team | null> {
    const result = await this.db`
      SELECT * FROM teams WHERE id = ${teamId} AND is_active = true
    `;
    return result.length > 0 ? (result[0] as Team) : null;
  }

  async listTeams(organizationId: string): Promise<Team[]> {
    const result = await this.db`
      SELECT * FROM teams
      WHERE organization_id = ${organizationId} AND is_active = true
      ORDER BY created_at DESC
    `;
    return result as unknown as Team[];
  }

  async updateTeam(teamId: string, updates: Partial<Team>): Promise<Team> {
    const { name, description } = updates;
    const result = await this.db`
      UPDATE teams
      SET
        name = ${name || this.db`name`},
        description = ${description || this.db`description`},
        updated_at = NOW()
      WHERE id = ${teamId}
      RETURNING *
    `;
    return result[0] as Team;
  }

  async deleteTeam(teamId: string): Promise<void> {
    await this.db`
      UPDATE teams
      SET is_active = false, updated_at = NOW()
      WHERE id = ${teamId}
    `;
  }

  async addTeamMember(
    teamId: string,
    userId: string,
    role: string = 'viewer',
    invitedBy?: string
  ): Promise<TeamMember> {
    const result = await this.db`
      INSERT INTO team_members (team_id, user_id, role, invited_by)
      VALUES (${teamId}, ${userId}, ${role}, ${invitedBy || null})
      ON CONFLICT (team_id, user_id) WHERE is_active = true DO UPDATE
      SET is_active = true, role = ${role}, updated_at = NOW()
      RETURNING *
    `;
    return result[0] as TeamMember;
  }

  async getTeamMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const result = await this.db`
      SELECT * FROM team_members
      WHERE team_id = ${teamId} AND user_id = ${userId} AND is_active = true
    `;
    return result.length > 0 ? (result[0] as TeamMember) : null;
  }

  async listMembers(teamId: string): Promise<TeamMember[]> {
    const result = await this.db`
      SELECT * FROM team_members
      WHERE team_id = ${teamId} AND is_active = true
      ORDER BY joined_at DESC
    `;
    return result as unknown as TeamMember[];
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    await this.db`
      UPDATE team_members
      SET is_active = false, left_at = NOW(), updated_at = NOW()
      WHERE team_id = ${teamId} AND user_id = ${userId}
    `;
  }

  async updateMemberRole(teamId: string, userId: string, role: string): Promise<TeamMember> {
    const result = await this.db`
      UPDATE team_members
      SET role = ${role}, updated_at = NOW()
      WHERE team_id = ${teamId} AND user_id = ${userId} AND is_active = true
      RETURNING *
    `;
    return result[0] as TeamMember;
  }

  async getTeamMemberCount(teamId: string): Promise<number> {
    const result = await this.db`
      SELECT COUNT(*) as count FROM team_members
      WHERE team_id = ${teamId} AND is_active = true
    `;
    return (result[0] as { count: number }).count;
  }

  async isTeamMember(teamId: string, userId: string): Promise<boolean> {
    const member = await this.getTeamMember(teamId, userId);
    return member !== null;
  }

  async getMemberRole(teamId: string, userId: string): Promise<string | null> {
    const member = await this.getTeamMember(teamId, userId);
    return member ? member.role : null;
  }
}
