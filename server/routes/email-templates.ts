import express, { Request, Response } from 'express';
import { authMiddleware, getUser } from '../middleware/auth.js';
import { EmailTemplateService, type EmailTemplateType } from '../services/EmailTemplateService.js';
import { EmailService } from '../services/EmailService.js';
import { getDb } from '../db/connection.js';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

export const emailTemplatesRouter = express.Router();

// All routes require authentication
emailTemplatesRouter.use(authMiddleware);

const emailTemplateService = new EmailTemplateService();
const emailService = new EmailService();

/**
 * GET /api/email-templates/:type
 * Get email template by type (custom or default)
 */
emailTemplatesRouter.get('/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const user = getUser(req);

    // Validate template type
    const availableTypes = emailTemplateService.getAllTypes();
    if (!availableTypes.includes(type as EmailTemplateType)) {
      res.status(400).json({
        error: `Invalid template type. Must be one of: ${availableTypes.join(', ')}`,
      });
      return;
    }

    const template = await emailTemplateService.getTemplate(type as EmailTemplateType, user.id);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    res.json({
      id: template.id,
      type: template.type,
      subject: template.subject,
      html: template.html,
      isCustom: template.is_custom,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    });
  } catch (error) {
    console.error('[email-templates] Failed to get template:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

/**
 * GET /api/email-templates/:type/variables
 * Get list of available template variables for a type
 */
emailTemplatesRouter.get('/:type/variables', (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    // Validate template type
    const availableTypes = emailTemplateService.getAllTypes();
    if (!availableTypes.includes(type as EmailTemplateType)) {
      res.status(400).json({
        error: `Invalid template type. Must be one of: ${availableTypes.join(', ')}`,
      });
      return;
    }

    const variables = emailTemplateService.getAvailableVars(type as EmailTemplateType);
    res.json({
      type,
      variables,
      count: variables.length,
    });
  } catch (error) {
    console.error('[email-templates] Failed to get variables:', error);
    res.status(500).json({ error: 'Failed to get variables' });
  }
});

/**
 * PUT /api/email-templates/:type
 * Update custom email template
 */
emailTemplatesRouter.put('/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { subject, html } = req.body;
    const user = getUser(req);

    // Validate input
    if (!subject || !html) {
      res.status(400).json({ error: 'Subject and HTML are required' });
      return;
    }

    if (typeof subject !== 'string' || typeof html !== 'string') {
      res.status(400).json({ error: 'Subject and HTML must be strings' });
      return;
    }

    // Validate template type
    const availableTypes = emailTemplateService.getAllTypes();
    if (!availableTypes.includes(type as EmailTemplateType)) {
      res.status(400).json({
        error: `Invalid template type. Must be one of: ${availableTypes.join(', ')}`,
      });
      return;
    }

    // Sanitize HTML to prevent stored XSS
    const sanitizedHtml = purify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'div', 'span', 'hr', 'pre', 'code'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel', 'width', 'height', 'align', 'valign', 'bgcolor', 'color', 'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing'],
    });

    // Update template (will validate internally)
    try {
      const updated = await emailTemplateService.updateTemplate(
        user.id,
        type as EmailTemplateType,
        subject,
        sanitizedHtml
      );

      if (!updated) {
        res.status(500).json({ error: 'Failed to update template' });
        return;
      }

      res.json({
        id: updated.id,
        type: updated.type,
        subject: updated.subject,
        html: updated.html,
        isCustom: updated.is_custom,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('[email-templates] Failed to update template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * POST /api/email-templates/:type/reset
 * Reset custom template to default
 */
emailTemplatesRouter.post('/:type/reset', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const user = getUser(req);

    // Validate template type
    const availableTypes = emailTemplateService.getAllTypes();
    if (!availableTypes.includes(type as EmailTemplateType)) {
      res.status(400).json({
        error: `Invalid template type. Must be one of: ${availableTypes.join(', ')}`,
      });
      return;
    }

    const reset = await emailTemplateService.resetTemplate(user.id, type as EmailTemplateType);
    if (!reset) {
      res.status(404).json({ error: 'Custom template not found' });
      return;
    }

    // Return default template
    const template = await emailTemplateService.getTemplate(type as EmailTemplateType, user.id);
    res.json({
      id: template!.id,
      type: template!.type,
      subject: template!.subject,
      html: template!.html,
      isCustom: template!.is_custom,
      createdAt: template!.created_at,
      updatedAt: template!.updated_at,
      message: 'Template reset to default',
    });
  } catch (error) {
    console.error('[email-templates] Failed to reset template:', error);
    res.status(500).json({ error: 'Failed to reset template' });
  }
});

/**
 * POST /api/email-templates/:type/preview
 * Preview email template with sample data
 */
emailTemplatesRouter.post('/:type/preview', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { variables } = req.body;
    const user = getUser(req);

    // Validate template type
    const availableTypes = emailTemplateService.getAllTypes();
    if (!availableTypes.includes(type as EmailTemplateType)) {
      res.status(400).json({
        error: `Invalid template type. Must be one of: ${availableTypes.join(', ')}`,
      });
      return;
    }

    // Validate variables are provided
    if (!variables || typeof variables !== 'object') {
      res.status(400).json({
        error: 'Variables object is required',
      });
      return;
    }

    // Get template
    const template = await emailTemplateService.getTemplate(type as EmailTemplateType, user.id);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Render template with variables
    const renderedHtml = emailTemplateService.renderTemplate(template.html, variables);
    const renderedSubject = emailTemplateService.renderTemplate(template.subject, variables);

    res.json({
      type,
      subject: renderedSubject,
      html: renderedHtml,
      preview: true,
    });
  } catch (error) {
    console.error('[email-templates] Failed to preview template:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

/**
 * POST /api/email-templates/:type/send-test
 * Send test email using template
 */
emailTemplatesRouter.post('/:type/send-test', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const { variables } = req.body;
    const user = getUser(req);
    const db = getDb();

    // Check if email service is configured
    if (!emailService.isEnabled()) {
      res.status(503).json({
        error: 'Email service is not configured. Please configure SMTP settings.',
      });
      return;
    }

    // Validate template type
    const availableTypes = emailTemplateService.getAllTypes();
    if (!availableTypes.includes(type as EmailTemplateType)) {
      res.status(400).json({
        error: `Invalid template type. Must be one of: ${availableTypes.join(', ')}`,
      });
      return;
    }

    // Validate variables
    if (!variables || typeof variables !== 'object') {
      res.status(400).json({
        error: 'Variables object is required',
      });
      return;
    }

    // Get user email
    const userRows = await db`
      SELECT email FROM users WHERE id = ${user.id} LIMIT 1
    `;

    if (!userRows || userRows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userEmail = userRows[0].email as string;

    // Get template
    const template = await emailTemplateService.getTemplate(type as EmailTemplateType, user.id);
    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    // Render template
    const renderedHtml = emailTemplateService.renderTemplate(template.html, variables);
    const renderedSubject = emailTemplateService.renderTemplate(template.subject, variables);

    // Send test email
    try {
      if (!emailService.isEnabled()) {
        res.status(503).json({
          error: 'Email service is not properly configured',
        });
        return;
      }

      const sent = await emailService.sendCustomEmail(userEmail, renderedSubject, renderedHtml);

      res.json({
        success: sent,
        message: sent ? 'Test email sent successfully' : 'Failed to send email',
      });
    } catch (emailError) {
      console.error('[email-templates] Failed to send test email:', emailError);
      res.status(500).json({
        error: 'Failed to send test email',
      });
    }
  } catch (error) {
    console.error('[email-templates] Failed to send test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

/**
 * GET /api/email-templates
 * List all available template types with metadata
 */
emailTemplatesRouter.get('/', (_req: Request, res: Response) => {
  try {
    const types = emailTemplateService.getAllTypes();
    const templates = types.map(type => ({
      type,
      variables: emailTemplateService.getAvailableVars(type),
    }));

    res.json({
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('[email-templates] Failed to list templates:', error);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});
