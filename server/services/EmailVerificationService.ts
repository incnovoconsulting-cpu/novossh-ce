import nodemailer from 'nodemailer';
import { getDb } from '../db/connection.js';

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 15;
const MAX_EMAILS_PER_WINDOW = 3;
const RESEND_COOLDOWN_SECONDS = 60;

export class EmailVerificationService {
  private transporter: nodemailer.Transporter | null = null;
  private db = getDb();

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  isEnabled(): boolean {
    return this.transporter !== null;
  }

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  async sendVerificationCode(userId: string, email: string): Promise<{
    success: boolean;
    error?: string;
    retryAfter?: number;
  }> {
    if (!this.transporter) {
      return { success: false, error: 'Email service not configured' };
    }

    const now = new Date();

    // Check rate limit: max 3 emails per 15 minutes
    const recentCount = await this.db`
      SELECT COUNT(*)::int as cnt
      FROM email_verifications
      WHERE user_id = ${userId}
        AND created_at > ${new Date(now.getTime() - CODE_EXPIRY_MINUTES * 60 * 1000)}
    `;
    if (recentCount[0].cnt >= MAX_EMAILS_PER_WINDOW) {
      return { success: false, error: 'Too many verification emails. Please try again later.' };
    }

    // Check resend cooldown: 60 seconds
    const lastSent = await this.db`
      SELECT created_at FROM email_verifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (lastSent.length > 0) {
      const elapsed = (now.getTime() - new Date(lastSent[0].created_at).getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        const retryAfter = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
        return { success: false, error: 'Please wait before requesting another code.', retryAfter };
      }
    }

    const code = this.generateCode();
    const expiresAt = new Date(now.getTime() + CODE_EXPIRY_MINUTES * 60 * 1000);

    await this.db`
      INSERT INTO email_verifications (user_id, code, expires_at)
      VALUES (${userId}, ${code}, ${expiresAt})
    `;

    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@novossh.com';

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Your NovoSSH Verification Code',
        html: this.getCodeEmailTemplate(code),
        text: `Your NovoSSH verification code is: ${code}. It expires in ${CODE_EXPIRY_MINUTES} minutes.`,
      });
      return { success: true };
    } catch (error) {
      console.error('[EmailVerificationService] Failed to send email:', error);
      return { success: false, error: 'Failed to send verification email.' };
    }
  }

  async confirmCode(userId: string, code: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const now = new Date();

    const rows = await this.db`
      UPDATE email_verifications
      SET used = TRUE
      WHERE user_id = ${userId}
        AND code = ${code}
        AND used = FALSE
        AND expires_at > ${now}
      RETURNING id
    `;

    if (rows.length === 0) {
      return { success: false, error: 'Invalid or expired verification code.' };
    }

    await this.db`
      UPDATE users
      SET email_verified = TRUE, updated_at = NOW()
      WHERE id = ${userId}
    `;

    return { success: true };
  }

  async getStatus(userId: string): Promise<{ verified: boolean; lastSentAt: string | null }> {
    const user = await this.db`
      SELECT email_verified FROM users WHERE id = ${userId} LIMIT 1
    `;
    const verified = user[0]?.email_verified ?? false;

    const lastSent = await this.db`
      SELECT created_at FROM email_verifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 1
    `;

    return {
      verified,
      lastSentAt: lastSent[0]?.created_at?.toISOString() ?? null,
    };
  }

  private getCodeEmailTemplate(code: string): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#00b4d8,#0077b6);color:white;padding:24px;border-radius:8px 8px 0 0}.content{background:#f8f9fa;padding:24px;border-radius:0 0 8px 8px}.code{font-size:32px;font-weight:700;letter-spacing:8px;color:#1a1a1a;background:white;border:2px solid #e0e0e0;border-radius:8px;padding:16px;text-align:center;margin:20px 0;font-family:'Courier New',monospace}.footer{color:#999;font-size:12px;margin-top:20px}</style></head><body><div class="container"><div class="header"><h1 style="margin:0">Verify your email</h1></div><div class="content"><p>Use the following code to verify your NovoSSH account:</p><div class="code">${code}</div><p style="color:#666;font-size:14px">This code expires in ${CODE_EXPIRY_MINUTES} minutes.</p><div class="footer"><p>If you didn't request this code, you can safely ignore this email.</p><p>&copy; NovoSSH Terminal</p></div></div></div></body></html>`;
  }
}
