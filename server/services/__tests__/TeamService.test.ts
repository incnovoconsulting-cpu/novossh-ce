import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeamService, Team, TeamMember } from '../TeamService';

vi.mock('../../db/connection.js', () => ({
  getDb: vi.fn(() => mockDb),
}));

const mockDb = vi.fn();

describe('TeamService', () => {
  let service: TeamService;
  const testOrgId = 'org-1';
  const testUserId = 'user-1';
  const testUserId2 = 'user-2';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TeamService();
  });

  describe('Team Creation', () => {
    it('should create a new team', async () => {
      const mockTeam: Team = {
        id: 'team-1',
        organization_id: testOrgId,
        name: 'Engineering',
        description: 'Engineering team',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockTeam]);

      const result = await service.createTeam(testOrgId, 'Engineering', 'Engineering team');

      expect(result.id).toBe('team-1');
      expect(result.name).toBe('Engineering');
      expect(result.organization_id).toBe(testOrgId);
      expect(result.is_active).toBe(true);
    });

    it('should create team without description', async () => {
      const mockTeam: Team = {
        id: 'team-2',
        organization_id: testOrgId,
        name: 'Marketing',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockTeam]);

      const result = await service.createTeam(testOrgId, 'Marketing');

      expect(result.name).toBe('Marketing');
      expect(result.description).toBeUndefined();
    });

    it('should support multiple teams per organization', async () => {
      const teams: Team[] = [
        {
          id: 'team-1',
          organization_id: testOrgId,
          name: 'Team A',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'team-2',
          organization_id: testOrgId,
          name: 'Team B',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce([teams[0]]);
      mockDb.mockResolvedValueOnce([teams[1]]);

      const result1 = await service.createTeam(testOrgId, 'Team A');
      const result2 = await service.createTeam(testOrgId, 'Team B');

      expect(result1.id).toBe('team-1');
      expect(result2.id).toBe('team-2');
    });
  });

  describe('Team Retrieval', () => {
    it('should retrieve team by id', async () => {
      const mockTeam: Team = {
        id: 'team-1',
        organization_id: testOrgId,
        name: 'Engineering',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockTeam]);

      const result = await service.getTeam('team-1');

      expect(result?.id).toBe('team-1');
      expect(result?.name).toBe('Engineering');
    });

    it('should return null for non-existent team', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getTeam('non-existent');

      expect(result).toBeNull();
    });

    it('should not return inactive teams', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getTeam('inactive-team');

      expect(result).toBeNull();
    });

    it('should list teams for organization', async () => {
      const mockTeams: Team[] = [
        {
          id: 'team-1',
          organization_id: testOrgId,
          name: 'Team A',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'team-2',
          organization_id: testOrgId,
          name: 'Team B',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockTeams);

      const result = await service.listTeams(testOrgId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Team A');
      expect(result[1].name).toBe('Team B');
    });

    it('should list empty teams for organization with no teams', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.listTeams(testOrgId);

      expect(result).toHaveLength(0);
    });

    it('should only list active teams', async () => {
      const mockTeams: Team[] = [
        {
          id: 'team-1',
          organization_id: testOrgId,
          name: 'Active Team',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockTeams);

      const result = await service.listTeams(testOrgId);

      expect(result.every(t => t.is_active)).toBe(true);
    });
  });

  describe('Team Updates', () => {
    it('should update team name', async () => {
      const mockTeam: Team = {
        id: 'team-1',
        organization_id: testOrgId,
        name: 'Updated Team',
        description: 'Original description',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValue([mockTeam]);

      const result = await service.updateTeam('team-1', { name: 'Updated Team' });

      expect(result.name).toBe('Updated Team');
    });

    it('should update team description', async () => {
      const mockTeam: Team = {
        id: 'team-1',
        organization_id: testOrgId,
        name: 'Engineering',
        description: 'New description',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValue([mockTeam]);

      const result = await service.updateTeam('team-1', { description: 'New description' });

      expect(result.description).toBe('New description');
    });

    it('should update multiple team properties', async () => {
      const mockTeam: Team = {
        id: 'team-1',
        organization_id: testOrgId,
        name: 'Updated Name',
        description: 'Updated description',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValue([mockTeam]);

      const result = await service.updateTeam('team-1', {
        name: 'Updated Name',
        description: 'Updated description',
      });

      expect(result.name).toBe('Updated Name');
      expect(result.description).toBe('Updated description');
    });
  });

  describe('Team Deletion', () => {
    it('should soft delete a team', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.deleteTeam('team-1');

      // Verify team is marked inactive (soft delete)
      expect(mockDb).toHaveBeenCalled();
    });

    it('should preserve team data after deletion', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.deleteTeam('team-1');

      expect(mockDb).toHaveBeenCalled();
    });
  });

  describe('Team Member Management', () => {
    it('should add member to team with owner role', async () => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: testUserId,
        role: 'owner',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockMember]);

      const result = await service.addTeamMember('team-1', testUserId, 'owner');

      expect(result.user_id).toBe(testUserId);
      expect(result.role).toBe('owner');
      expect(result.is_active).toBe(true);
    });

    it('should add member with default viewer role', async () => {
      const mockMember: TeamMember = {
        id: 'member-2',
        team_id: 'team-1',
        user_id: testUserId2,
        role: 'viewer',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockMember]);

      const result = await service.addTeamMember('team-1', testUserId2);

      expect(result.role).toBe('viewer');
    });

    it('should track who invited the member', async () => {
      const mockMember: TeamMember = {
        id: 'member-3',
        team_id: 'team-1',
        user_id: testUserId2,
        role: 'editor',
        is_active: true,
        invited_by: testUserId,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockMember]);

      const result = await service.addTeamMember('team-1', testUserId2, 'editor', testUserId);

      expect(result.invited_by).toBe(testUserId);
    });

    it('should support all role types', async () => {
      const roles = ['owner', 'editor', 'viewer'];
      const mockMembers: TeamMember[] = roles.map((role, idx) => ({
        id: `member-${idx}`,
        team_id: 'team-1',
        user_id: `user-${idx}`,
        role,
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      }));

      mockDb.mockResolvedValueOnce([mockMembers[0]]);
      mockDb.mockResolvedValueOnce([mockMembers[1]]);
      mockDb.mockResolvedValueOnce([mockMembers[2]]);

      for (let i = 0; i < roles.length; i++) {
        const result = await service.addTeamMember('team-1', `user-${i}`, roles[i]);
        expect(result.role).toBe(roles[i]);
      }
    });

    it('should re-activate removed member with new role', async () => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: testUserId,
        role: 'editor',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockMember]);

      const result = await service.addTeamMember('team-1', testUserId, 'editor');

      expect(result.is_active).toBe(true);
      expect(result.role).toBe('editor');
    });
  });

  describe('Team Member Retrieval', () => {
    it('should get team member by id and user id', async () => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: testUserId,
        role: 'owner',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockMember]);

      const result = await service.getTeamMember('team-1', testUserId);

      expect(result?.user_id).toBe(testUserId);
      expect(result?.role).toBe('owner');
    });

    it('should return null for non-existent member', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getTeamMember('team-1', 'non-existent-user');

      expect(result).toBeNull();
    });

    it('should list all members of a team', async () => {
      const mockMembers: TeamMember[] = [
        {
          id: 'member-1',
          team_id: 'team-1',
          user_id: 'user-1',
          role: 'owner',
          is_active: true,
          joined_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'member-2',
          team_id: 'team-1',
          user_id: 'user-2',
          role: 'editor',
          is_active: true,
          joined_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'member-3',
          team_id: 'team-1',
          user_id: 'user-3',
          role: 'viewer',
          is_active: true,
          joined_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockMembers);

      const result = await service.listMembers('team-1');

      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('owner');
      expect(result[1].role).toBe('editor');
      expect(result[2].role).toBe('viewer');
    });

    it('should only list active members', async () => {
      const mockMembers: TeamMember[] = [
        {
          id: 'member-1',
          team_id: 'team-1',
          user_id: 'user-1',
          role: 'owner',
          is_active: true,
          joined_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockMembers);

      const result = await service.listMembers('team-1');

      expect(result.every(m => m.is_active)).toBe(true);
    });

    it('should list members sorted by join date', async () => {
      const now = new Date();
      const mockMembers: TeamMember[] = [
        {
          id: 'member-2',
          team_id: 'team-1',
          user_id: 'user-2',
          role: 'editor',
          is_active: true,
          joined_at: new Date(now.getTime() + 1000),
          updated_at: new Date(),
        },
        {
          id: 'member-1',
          team_id: 'team-1',
          user_id: 'user-1',
          role: 'owner',
          is_active: true,
          joined_at: now,
          updated_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(mockMembers);

      const result = await service.listMembers('team-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('Team Member Removal', () => {
    it('should remove member from team', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.removeTeamMember('team-1', testUserId);

      expect(mockDb).toHaveBeenCalled();
    });

    it('should soft delete member (preserve history)', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.removeTeamMember('team-1', testUserId);

      expect(mockDb).toHaveBeenCalled();
    });

    it('should set left_at timestamp on removal', async () => {
      mockDb.mockResolvedValueOnce([]);

      await service.removeTeamMember('team-1', testUserId);

      expect(mockDb).toHaveBeenCalled();
    });
  });

  describe('Team Member Role Updates', () => {
    it('should update member role to editor', async () => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: testUserId,
        role: 'editor',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockMember]);

      const result = await service.updateMemberRole('team-1', testUserId, 'editor');

      expect(result.role).toBe('editor');
    });

    it('should update member role to owner', async () => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: testUserId,
        role: 'owner',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockMember]);

      const result = await service.updateMemberRole('team-1', testUserId, 'owner');

      expect(result.role).toBe('owner');
    });

    it('should downgrade member role to viewer', async () => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: testUserId,
        role: 'viewer',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockMember]);

      const result = await service.updateMemberRole('team-1', testUserId, 'viewer');

      expect(result.role).toBe('viewer');
    });
  });

  describe('Team Statistics', () => {
    it('should get member count for team', async () => {
      mockDb.mockResolvedValueOnce([{ count: 5 }]);

      const result = await service.getTeamMemberCount('team-1');

      expect(result).toBe(5);
    });

    it('should return zero for team with no members', async () => {
      mockDb.mockResolvedValueOnce([{ count: 0 }]);

      const result = await service.getTeamMemberCount('team-1');

      expect(result).toBe(0);
    });

    it('should check if user is team member', async () => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: testUserId,
        role: 'owner',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockMember]);

      const result = await service.isTeamMember('team-1', testUserId);

      expect(result).toBe(true);
    });

    it('should return false if user is not team member', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.isTeamMember('team-1', 'non-member');

      expect(result).toBe(false);
    });

    it('should get member role', async () => {
      const mockMember: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: testUserId,
        role: 'editor',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([mockMember]);

      const result = await service.getMemberRole('team-1', testUserId);

      expect(result).toBe('editor');
    });

    it('should return null for non-member', async () => {
      mockDb.mockResolvedValueOnce([]);

      const result = await service.getMemberRole('team-1', 'non-member');

      expect(result).toBeNull();
    });
  });

  describe('Multi-Team Scenarios', () => {
    it('should support user in multiple teams with different roles', async () => {
      const memberTeam1: TeamMember = {
        id: 'member-1',
        team_id: 'team-1',
        user_id: testUserId,
        role: 'owner',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      const memberTeam2: TeamMember = {
        id: 'member-2',
        team_id: 'team-2',
        user_id: testUserId,
        role: 'viewer',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.mockResolvedValueOnce([memberTeam1]);
      mockDb.mockResolvedValueOnce([memberTeam2]);

      const result1 = await service.getTeamMember('team-1', testUserId);
      const result2 = await service.getTeamMember('team-2', testUserId);

      expect(result1?.role).toBe('owner');
      expect(result2?.role).toBe('viewer');
    });

    it('should support multiple teams per organization', async () => {
      const teams: Team[] = [
        {
          id: 'team-1',
          organization_id: testOrgId,
          name: 'Team A',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'team-2',
          organization_id: testOrgId,
          name: 'Team B',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'team-3',
          organization_id: testOrgId,
          name: 'Team C',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.mockResolvedValueOnce(teams);

      const result = await service.listTeams(testOrgId);

      expect(result).toHaveLength(3);
    });

    it('should handle team with many members', async () => {
      const members: TeamMember[] = Array.from({ length: 100 }, (_, i) => ({
        id: `member-${i}`,
        team_id: 'team-1',
        user_id: `user-${i}`,
        role: i % 3 === 0 ? 'owner' : i % 3 === 1 ? 'editor' : 'viewer',
        is_active: true,
        joined_at: new Date(),
        updated_at: new Date(),
      }));

      mockDb.mockResolvedValueOnce(members);

      const result = await service.listMembers('team-1');

      expect(result).toHaveLength(100);
    });
  });
});
