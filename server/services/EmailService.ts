interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

export class EmailService {
  private isConfigured = false;
  private accountId = '';
  private apiToken = '';
  private fromAddress = '';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const accountId = process.env.CF_ACCOUNT_ID || '6c00b24feba16708a5f09fa69af425b4';
    const apiToken = process.env.CF_API_TOKEN || process.env.CF_OAUTH_TOKEN || '';
    const fromAddress = process.env.EMAIL_FROM || 'support@novossh.com';

    if (!apiToken) {
      return;
    }

    this.accountId = accountId;
    this.apiToken = apiToken;
    this.fromAddress = fromAddress;
    this.isConfigured = true;
  }

  private async send(params: SendEmailParams): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      const from = typeof params.to === 'string' && params.to.includes('@')
        ? { address: this.fromAddress, name: 'NovoSSH' }
        : this.fromAddress;

      const body: Record<string, unknown> = {
        to: params.to,
        from,
        subject: params.subject,
      };
      if (params.html) body.html = params.html;
      if (params.text) body.text = params.text;
      if (params.cc) body.cc = params.cc;
      if (params.bcc) body.bcc = params.bcc;
      if (params.replyTo) body.reply_to = params.replyTo;

      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/email/sending/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      const data = await res.json() as { success: boolean; errors?: { message: string }[] };
      return data.success;
    } catch {
      return false;
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationUrl = `${frontendUrl}/verify?token=${token}`;

    return this.send({
      to: email,
      subject: 'Verify your NovoSSH email address',
      html: this.getVerificationEmailTemplate(verificationUrl),
      text: `Please verify your email by clicking this link: ${verificationUrl}`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    return this.send({
      to: email,
      subject: 'NovoSSH password reset request',
      html: this.getPasswordResetEmailTemplate(resetUrl),
      text: `Reset your password by clicking this link: ${resetUrl}`,
    });
  }

  async sendTrialExpirationEmail(email: string, daysRemaining: number): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const billingUrl = `${frontendUrl}/settings`;

    return this.send({
      to: email,
      subject: `Your NovoSSH trial expires in ${daysRemaining} days`,
      html: this.getTrialExpirationEmailTemplate(billingUrl, daysRemaining),
      text: `Your trial expires in ${daysRemaining} days. Update your billing to continue: ${billingUrl}`,
    });
  }

  async sendPlanDowngradeEmail(
    email: string,
    previousPlan: string,
    newPlan: string,
    exceeded: { resource: string; current: number; limit: number }[] | null,
  ): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const billingUrl = `${frontendUrl}/settings`;

    return this.send({
      to: email,
      subject: `Your NovoSSH plan has been downgraded to ${newPlan}`,
      html: this.getPlanDowngradeEmailTemplate(billingUrl, previousPlan, newPlan, exceeded),
      text: `Your plan has been downgraded from ${previousPlan} to ${newPlan}. Visit ${billingUrl} for more information.`,
    });
  }

  async sendCustomEmail(email: string, subject: string, html: string): Promise<boolean> {
    return this.send({ to: email, subject, html });
  }

  async sendInvitationEmail(
    email: string,
    token: string,
    organizationName: string,
    role: string,
  ): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteUrl = `${frontendUrl}/invitations?token=${token}`;

    return this.send({
      to: email,
      subject: `You've been invited to join ${organizationName} on NovoSSH`,
      html: this.getInvitationEmailTemplate(inviteUrl, organizationName, role),
      text: `You've been invited to join ${organizationName} on NovoSSH as a ${role}. Accept here: ${inviteUrl}`,
    });
  }

  isEnabled(): boolean {
    return this.isConfigured;
  }

  private getVerificationEmailTemplate(verificationUrl: string): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#00b4d8,#0077b6);color:white;padding:24px;border-radius:8px 8px 0 0}.content{background:#f8f9fa;padding:24px;border-radius:0 0 8px 8px}.button{background:#00b4d8;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0;font-weight:600}.footer{color:#999;font-size:12px;margin-top:20px}</style></head><body><div class="container"><div class="header"><h1 style="margin:0">Verify your email</h1></div><div class="content"><p>Thanks for signing up for NovoSSH! Please verify your email address to get started.</p><a href="${verificationUrl}" class="button">Verify Email</a><p style="color:#666;font-size:12px">Or copy this link: ${verificationUrl}</p><p style="color:#999;font-size:12px">This link expires in 24 hours.</p><div class="footer"><p>If you didn't create this account, ignore this email.</p><p>© NovoSSH Terminal</p></div></div></div></body></html>`;
  }

  private getPasswordResetEmailTemplate(resetUrl: string): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#e63946,#d62828);color:white;padding:24px;border-radius:8px 8px 0 0}.content{background:#f8f9fa;padding:24px;border-radius:0 0 8px 8px}.button{background:#e63946;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0;font-weight:600}.footer{color:#999;font-size:12px;margin-top:20px}</style></head><body><div class="container"><div class="header"><h1 style="margin:0">Reset your password</h1></div><div class="content"><p>We received a request to reset your NovoSSH password.</p><a href="${resetUrl}" class="button">Reset Password</a><p style="color:#666;font-size:12px">Or copy this link: ${resetUrl}</p><p style="color:#999;font-size:12px">This link expires in 1 hour.</p><div class="footer"><p>If you didn't request this, ignore this email.</p><p>© NovoSSH Terminal</p></div></div></div></body></html>`;
  }

  private getInvitationEmailTemplate(inviteUrl: string, organizationName: string, role: string): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#00b4d8,#0077b6);color:white;padding:24px;border-radius:8px 8px 0 0}.content{background:#f8f9fa;padding:24px;border-radius:0 0 8px 8px}.button{background:#00b4d8;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0;font-weight:600}.footer{color:#999;font-size:12px;margin-top:20px}</style></head><body><div class="container"><div class="header"><h1 style="margin:0">You're invited</h1></div><div class="content"><p>You've been invited to join <strong>${organizationName}</strong> on NovoSSH as a <strong>${role}</strong>.</p><a href="${inviteUrl}" class="button">Accept Invitation</a><p style="color:#666;font-size:12px">Or copy this link: ${inviteUrl}</p><p style="color:#999;font-size:12px">This invitation will expire.</p><div class="footer"><p>If you weren't expecting this, you can ignore this email.</p><p>© NovoSSH Terminal</p></div></div></div></body></html>`;
  }

  private getTrialExpirationEmailTemplate(billingUrl: string, daysRemaining: number): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#f77f00,#fcbf49);color:white;padding:24px;border-radius:8px 8px 0 0}.content{background:#f8f9fa;padding:24px;border-radius:0 0 8px 8px}.button{background:#f77f00;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0;font-weight:600}.highlight{background:#fff3cd;padding:12px;border-radius:6px;margin:20px 0}.footer{color:#999;font-size:12px;margin-top:20px}</style></head><body><div class="container"><div class="header"><h1 style="margin:0">Trial expiring soon</h1></div><div class="content"><p>Your NovoSSH trial expires in <strong>${daysRemaining} days</strong>.</p><div class="highlight"><strong>Don't lose access!</strong> Update your billing to continue using NovoSSH.</div><a href="${billingUrl}" class="button">Update Billing</a><div class="footer"><p>© NovoSSH Terminal</p></div></div></div></body></html>`;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private getPlanDowngradeEmailTemplate(
    billingUrl: string,
    previousPlan: string,
    newPlan: string,
    exceeded: { resource: string; current: number; limit: number }[] | null,
  ): string {
    const safePrevious = this.escapeHtml(previousPlan);
    const safeNew = this.escapeHtml(newPlan);
    const safeBillingUrl = this.escapeHtml(billingUrl);
    const exceededHtml = exceeded?.length
      ? `<p style="color:#d32f2f;font-weight:600">You have exceeded limits for:</p><ul style="color:#d32f2f">${exceeded.map((i) => `<li>${this.escapeHtml(i.resource)}: ${i.current} (limit: ${i.limit})</li>`).join('')}</ul>`
      : '';

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#6c757d,#495057);color:white;padding:24px;border-radius:8px 8px 0 0}.content{background:#f8f9fa;padding:24px;border-radius:0 0 8px 8px}.button{background:#00b4d8;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin:20px 0;font-weight:600}.footer{color:#999;font-size:12px;margin-top:20px}</style></head><body><div class="container"><div class="header"><h1 style="margin:0">Plan downgraded</h1></div><div class="content"><p>Your subscription changed from <strong>${safePrevious}</strong> to <strong>${safeNew}</strong>.</p>${exceededHtml}<a href="${safeBillingUrl}" class="button">View Your Plan</a><div class="footer"><p>© NovoSSH Terminal</p></div></div></div></body></html>`;
  }
}
