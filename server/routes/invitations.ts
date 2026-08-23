/**
 * Organization Invitation Routes
 *
 * Endpoints:
 * - POST /api/organizations/:id/invitations - Send invitation
 * - GET /api/organizations/:id/invitations - List invitations
 * - POST /api/organizations/:id/invitations/:invitationId/resend - Resend invitation
 * - DELETE /api/organizations/:id/invitations/:invitationId - Cancel invitation
 * - GET /api/invitations/pending - Get user's pending invitations
 * - POST /api/invitations/accept - Accept invitation
 * - POST /api/invitations/reject - Reject invitation
 */

import express from 'express';
import { OrganizationService } from '../services/OrganizationService.js';
import { InvitationService } from '../services/InvitationService.js';
import { EmailService } from '../services/EmailService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const orgService = new OrganizationService();
const emailService = new EmailService();
const invitationService = new InvitationService();

function getUser(req: express.Request): { id: string; organizationId?: string } | null {
  const user = (req as any).user;
  if (!user?.id) return null;
  return { id: user.id, organizationId: user.organizationId };
}

// POST /api/organizations/:id/invitations - Send invitation
router.post('/organizations/:id/invitations', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role } = req.body;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    if (!email || !role) {
      res.status(400).json({ error: 'Email and role are required' });
      return;
    }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'invitation:send');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // Create invitation
    const invitation = await invitationService.createInvitation(id, email, role, user.id);

    if (emailService.isEnabled()) {
      const org = await orgService.getOrganization(id);
      await emailService.sendInvitationEmail(email, invitation.token, org?.name ?? 'a NovoSSH organization', role);
    }

    res.status(201).json(invitation);
  } catch (error) {
    console.error('Failed to send invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// GET /api/organizations/:id/invitations - List invitations
router.get('/organizations/:id/invitations', async (req, res) => {
  try {
    const { id } = req.params;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'invitation:manage');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const invitations = await invitationService.listPendingInvitations(id);
    res.json({
      invitations,
      total: invitations.length,
    });
  } catch (error) {
    console.error('Failed to list invitations:', error);
    res.status(500).json({ error: 'Failed to list invitations' });
  }
});

// POST /api/organizations/:id/invitations/:invitationId/resend - Resend invitation
router.post('/organizations/:id/invitations/:invitationId/resend', async (req, res) => {
  try {
    const { id, invitationId } = req.params;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'invitation:manage');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    const invitation = await invitationService.resendInvitation(invitationId);

    if (emailService.isEnabled()) {
      const org = await orgService.getOrganization(id);
      await emailService.sendInvitationEmail(invitation.email, invitation.token, org?.name ?? 'a NovoSSH organization', invitation.role);
    }

    res.json(invitation);
  } catch (error) {
    console.error('Failed to resend invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// DELETE /api/organizations/:id/invitations/:invitationId - Cancel invitation
router.delete('/organizations/:id/invitations/:invitationId', async (req, res) => {
  try {
    const { id, invitationId } = req.params;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    // Check permission
    const hasPermission = await orgService.hasPermission(id, user.id, 'invitation:manage');
    if (!hasPermission) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    await invitationService.cancelInvitation(invitationId);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to cancel invitation:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

// GET /api/invitations/pending - Get user's pending invitations
router.get('/pending', async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }
    const email = (req as any).user?.email;
    const invitations = await invitationService.listUserPendingInvitations(email);
    res.json(invitations);
  } catch (error) {
    console.error('Failed to get user invitations:', error);
    res.status(500).json({ error: 'Failed to get user invitations' });
  }
});

// POST /api/invitations/accept - Accept invitation
router.post('/accept', async (req, res) => {
  try {
    const { token } = req.body;
    const user = getUser(req);
    if (!user) { res.status(401).json({ error: 'Authentication required' }); return; }

    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    // Validate invitation
    const isValid = await invitationService.isInvitationValid(token);
    if (!isValid) {
      res.status(400).json({ error: 'Invalid or expired invitation' });
      return;
    }

    // Accept invitation
    const invitation = await invitationService.acceptInvitation(token, user.id);

    // Add user as member to organization
    const member = await orgService.addMember(
      invitation.organization_id,
      user.id,
      invitation.role as any,
      invitation.invited_by
    );

    res.json(member);
  } catch (error) {
    console.error('Failed to accept invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// POST /api/invitations/reject - Reject invitation
router.post('/reject', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    // Reject invitation
    await invitationService.rejectInvitation(token);
    res.status(204).send();
  } catch (error) {
    console.error('Failed to reject invitation:', error);
    res.status(500).json({ error: 'Failed to reject invitation' });
  }
});

export default router;
