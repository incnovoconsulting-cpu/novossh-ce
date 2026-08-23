import { getDb } from '../db/connection.js';

export type EmailTemplateType =
  | 'trial_expiring'
  | 'plan_downgrade'
  | 'payment_failed'
  | 'storage_warning'
  | 'feature_announcement'
  | 'security_alert';

interface EmailTemplate {
  id: string;
  user_id: string | null;
  type: EmailTemplateType;
  subject: string;
  html: string;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateVariables {
  [key: string]: string | number | boolean;
}

const TEMPLATE_VARIABLES: Record<EmailTemplateType, string[]> = {
  trial_expiring: ['daysRemaining', 'expirationDate', 'upgradeUrl'],
  plan_downgrade: ['previousPlan', 'newPlan', 'exceededResources', 'billingUrl'],
  payment_failed: ['amount', 'retryUrl', 'supportUrl'],
  storage_warning: ['usedStorage', 'limitStorage', 'storagePercentage', 'upgradeUrl'],
  feature_announcement: ['featureTitle', 'description', 'docsUrl'],
  security_alert: ['alertType', 'actionUrl', 'timestamp'],
};

const XSS_REGEX = /(<script|javascript:|on\w+\s*=|<iframe|<embed|<object)/gi;

export class EmailTemplateService {
  /**
   * Get email template by type. Returns custom template if user_id provided and exists,
   * otherwise returns default template.
   */
  async getTemplate(
    type: EmailTemplateType,
    userId?: string
  ): Promise<EmailTemplate | null> {
    const db = getDb();

    try {
      let query;
      if (userId) {
        // Try to fetch custom template for user
        query = await db`
          SELECT id, user_id, type, subject, html, is_custom, created_at, updated_at
          FROM email_templates
          WHERE type = ${type} AND user_id = ${userId}
          LIMIT 1
        `;
        if (query.length > 0) {
          return query[0] as EmailTemplate;
        }
      }

      // Fall back to default template
      query = await db`
        SELECT id, user_id, type, subject, html, is_custom, created_at, updated_at
        FROM email_templates
        WHERE type = ${type} AND user_id IS NULL
        LIMIT 1
      `;

      return query.length > 0 ? (query[0] as EmailTemplate) : null;
    } catch (error) {
      console.error('[EmailTemplateService] Failed to get template:', error);
      return null;
    }
  }

  /**
   * Update or create custom email template for user
   */
  async updateTemplate(
    userId: string,
    type: EmailTemplateType,
    subject: string,
    html: string
  ): Promise<EmailTemplate | null> {
    const db = getDb();

    try {
      // Validate template
      const validation = this.validateTemplate(html, type);
      if (!validation.isValid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if custom template already exists
      const existing = await db`
        SELECT id FROM email_templates
        WHERE user_id = ${userId} AND type = ${type}
        LIMIT 1
      `;

      let result;
      if (existing.length > 0) {
        // Update existing
        result = await db`
          UPDATE email_templates
          SET subject = ${subject}, html = ${html}, is_custom = true, updated_at = NOW()
          WHERE user_id = ${userId} AND type = ${type}
          RETURNING id, user_id, type, subject, html, is_custom, created_at, updated_at
        `;
      } else {
        // Insert new custom template
        result = await db`
          INSERT INTO email_templates (user_id, type, subject, html, is_custom)
          VALUES (${userId}, ${type}, ${subject}, ${html}, true)
          RETURNING id, user_id, type, subject, html, is_custom, created_at, updated_at
        `;
      }

      return result.length > 0 ? (result[0] as EmailTemplate) : null;
    } catch (error) {
      console.error('[EmailTemplateService] Failed to update template:', error);
      throw error;
    }
  }

  /**
   * Reset custom template to default
   */
  async resetTemplate(userId: string, type: EmailTemplateType): Promise<boolean> {
    const db = getDb();

    try {
      const result = await db`
        DELETE FROM email_templates
        WHERE user_id = ${userId} AND type = ${type}
      `;
      return result.count > 0;
    } catch (error) {
      console.error('[EmailTemplateService] Failed to reset template:', error);
      throw error;
    }
  }

  /**
   * Validate template HTML and required variables
   */
  validateTemplate(
    html: string,
    type: EmailTemplateType
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for XSS patterns
    if (XSS_REGEX.test(html)) {
      errors.push('HTML contains potentially dangerous patterns (scripts, event handlers, etc.)');
    }

    // Check for required template variables
    const requiredVars = TEMPLATE_VARIABLES[type];
    for (const variable of requiredVars) {
      const varRegex = new RegExp(`{{${variable}}}`, 'g');
      if (!varRegex.test(html)) {
        errors.push(`Missing required variable: {{${variable}}}`);
      }
    }

    // Ensure it's valid HTML
    if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
      errors.push('HTML must be a valid document with <!DOCTYPE html> or <html> tag');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get list of available template variables for a type
   */
  getAvailableVars(type: EmailTemplateType): string[] {
    return TEMPLATE_VARIABLES[type] || [];
  }

  /**
   * Render template with variables
   */
  renderTemplate(template: string, variables: TemplateVariables): string {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const varRegex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(varRegex, String(value));
    }
    return rendered;
  }

  /**
   * Get all template types
   */
  getAllTypes(): EmailTemplateType[] {
    return Object.keys(TEMPLATE_VARIABLES) as EmailTemplateType[];
  }
}
