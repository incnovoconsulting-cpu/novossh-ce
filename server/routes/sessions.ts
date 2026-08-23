import express from 'express';
import { SessionService } from '../services/SessionService.js';
import { PermissionService } from '../services/PermissionService.js';
import { SessionPlaybackService } from '../services/SessionPlaybackService.js';
import { AuditService } from '../services/AuditService.js';
import { VaultService } from '../services/VaultService.js';
import { ShareService } from '../services/ShareService.js';
import { exportRateLimit, playbackRateLimit } from '../middleware/rateLimit.js';
import { createAuditTracker } from '../middleware/auditTracker.js';

const router = express.Router();

export const sessionService = new SessionService();
export const permissionService = new PermissionService();
export const playbackService = new SessionPlaybackService();
export const auditService = new AuditService();
export const auditTracker = createAuditTracker(auditService);
export const vaultService = new VaultService();
export const shareService = new ShareService();

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// Personal (non-team) vault sessions have no team_id, so team-role permission checks
// don't apply; only the session creator may act on them.
async function checkSessionPermission(
  user: { id: string },
  session: { team_id: string | null; created_by: string },
  permission: Parameters<typeof permissionService.checkPermission>[2]
): Promise<boolean> {
  if (!session.team_id) return session.created_by === user.id;
  return permissionService.checkPermission(user.id, session.team_id, permission);
}

// POST /api/sessions - Create session
router.post('/', async (req, res) => {
  try {
    const { vaultId, teamId, name, description } = req.body;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    if (!vaultId) {
      res.status(400).json({ error: 'Vault ID is required' });
      return;
    }

    if (teamId) {
      const hasPermission = await permissionService.checkPermission(
        user.id,
        teamId,
        'session:create'
      );

      if (!hasPermission) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }
    } else {
      // Personal (non-team) vault session: just confirm the user can reach the vault.
      const vault = await vaultService.getVault(vaultId);
      if (!vault) {
        res.status(404).json({ error: 'Vault not found' });
        return;
      }
      const access = await shareService.checkAccess(vault.id, user.id);
      if (!access.hasAccess && vault.owner_id !== user.id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const session = await sessionService.createSession(
      vaultId,
      teamId || null,
      user.id,
      name,
      description
    );

    await sessionService.addParticipant(session.id, user.id, false);

    res.status(201).json(session);
  } catch (error) {
    console.error('Failed to create session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// GET /api/sessions - List sessions (requires vaultId or teamId filter)
router.get('/', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { vaultId, teamId, includeParticipantCounts = 'false' } = req.query;

    // Require at least one filter to prevent enumerating all sessions
    if (!vaultId && !teamId) {
      res.status(400).json({ error: 'vaultId or teamId filter required' });
      return;
    }

    let sessions;
    if (vaultId && teamId) {
      sessions = await sessionService.listSessions(vaultId as string, teamId as string);
    } else if (vaultId) {
      sessions = await sessionService.listSessions(vaultId as string);
    } else {
      sessions = await sessionService.listSessions(undefined, teamId as string);
    }

    if (includeParticipantCounts === 'true' && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      const counts = await sessionService.batchLoadCommandCounts(sessionIds);
      const response = sessions.map(s => ({
        ...s,
        commandCount: counts.get(s.id) || 0,
      }));
      res.json(response);
    } else {
      res.json(sessions);
    }
  } catch (error) {
    console.error('Failed to list sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// GET /api/sessions/:id - Get session details
router.get('/:id', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const session = await sessionService.getSession(req.params.id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(user, session, 'session:read');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    res.json(session);
  } catch (error) {
    console.error('Failed to get session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// PUT /api/sessions/:id - Update session
router.put('/:id', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const session = await sessionService.getSession(req.params.id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(
      user,
      session,
      'session:update'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const updated = await sessionService.updateSession(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    console.error('Failed to update session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// DELETE /api/sessions/:id - End session
router.delete('/:id', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const session = await sessionService.getSession(req.params.id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(
      user,
      session,
      'session:record'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    await sessionService.endSession(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to end session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// POST /api/sessions/:id/join - Join session
router.post('/:id/join', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { isObserver = false } = req.body;

    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(
      user,
      session,
      'session:read'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const participant = await sessionService.addParticipant(
      session.id,
      user.id,
      isObserver
    );
    res.status(201).json(participant);
  } catch (error) {
    console.error('Failed to join session:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// DELETE /api/sessions/:id/leave - Leave session
router.delete('/:id/leave', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const session = await sessionService.getSession(req.params.id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await sessionService.removeParticipant(session.id, user.id);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to leave session:', error);
    res.status(500).json({ error: 'Failed to leave session' });
  }
});

// GET /api/sessions/:id/participants - List session participants
router.get('/:id/participants', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const session = await sessionService.getSession(req.params.id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(
      user,
      session,
      'session:read'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const participants = await sessionService.listParticipants(session.id);
    res.json(participants);
  } catch (error) {
    console.error('Failed to list participants:', error);
    res.status(500).json({ error: 'Failed to list participants' });
  }
});

// POST /api/sessions/:id/commands - Record command
router.post('/:id/commands', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { command, output, exitCode } = req.body;

    if (!command) {
      res.status(400).json({ error: 'Command is required' });
      return;
    }

    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(
      user,
      session,
      'session:record'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const cmd = await sessionService.recordCommand(
      session.id,
      user.id,
      command,
      output,
      exitCode
    );
    res.status(201).json(cmd);
  } catch (error) {
    console.error('Failed to record command:', error);
    res.status(500).json({ error: 'Failed to record command' });
  }
});

// GET /api/sessions/:id/commands - Get session command history
router.get('/:id/commands', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { limit = 100 } = req.query;

    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(
      user,
      session,
      'session:read'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const commands = await sessionService.getSessionHistory(
      session.id,
      parseInt(limit as string)
    );
    res.json(commands);
  } catch (error) {
    console.error('Failed to get session history:', error);
    res.status(500).json({ error: 'Failed to get session history' });
  }
});

// PUT /api/sessions/:id/commands/:cmdId - Update command output
router.put('/:id/commands/:cmdId', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const { output, exitCode } = req.body;

    if (output === undefined || exitCode === undefined) {
      res.status(400).json({ error: 'Output and exit code are required' });
      return;
    }

    const session = await sessionService.getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(
      user,
      session,
      'session:record'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const cmd = await sessionService.updateCommand(req.params.cmdId, output, exitCode);
    res.json(cmd);
  } catch (error) {
    console.error('Failed to update command:', error);
    res.status(500).json({ error: 'Failed to update command' });
  }
});

// GET /api/sessions/:id/playback - Get session playback data
router.get('/:id/playback', playbackRateLimit, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const session = await sessionService.getSession(req.params.id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(
      user,
      session,
      'session:read'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const playbackData = await playbackService.getPlaybackData(session.id);

    const commandCount = playbackData?.commandCount || 0;
    await auditTracker.logPlaybackAccess(
      req,
      session.id,
      session.team_id ?? '',
      commandCount
    );

    res.json(playbackData);
  } catch (error) {
    console.error('Failed to get playback data:', error);
    res.status(500).json({ error: 'Failed to get playback data' });
  }
});

// GET /api/sessions/:id/timeline - Get session timeline statistics
router.get('/:id/timeline', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const session = await sessionService.getSession(req.params.id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(
      user,
      session,
      'session:read'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const timeline = await playbackService.getSessionTimeline(session.id);
    res.json(timeline);
  } catch (error) {
    console.error('Failed to get timeline:', error);
    res.status(500).json({ error: 'Failed to get timeline' });
  }
});

// GET /api/sessions/:id/export - Export session as script
router.get('/:id/export', exportRateLimit, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const format = (req.query.format as string) || 'bash';
    const session = await sessionService.getSession(req.params.id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const hasPermission = await checkSessionPermission(
      user,
      session,
      'session:export'
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    if (format !== 'bash' && format !== 'json') {
      res.status(400).json({ error: 'Format must be bash or json' });
      return;
    }

    const exported = await playbackService.exportAsScript(session.id, format as 'bash' | 'json');

    const commands = await sessionService.getSessionHistory(session.id, 1000);

    await auditTracker.logSessionExport(
      req,
      session.id,
      session.team_id ?? '',
      format as 'bash' | 'json',
      commands.length,
      true
    );

    const contentType = format === 'json' ? 'application/json' : 'text/plain';
    const filename = format === 'json' ? 'session-playback.json' : 'session-replay.sh';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exported);
  } catch (error) {
    console.error('Failed to export session:', error);
    const session = await sessionService.getSession(req.params.id);
    if (session) {
      await auditTracker.logSessionExport(
        req,
        req.params.id,
        session.team_id ?? '',
        (req.query.format as string) === 'json' ? 'json' : 'bash',
        0,
        false
      );
    }
    res.status(500).json({ error: 'Failed to export session' });
  }
});

export { router as sessionRouter };
