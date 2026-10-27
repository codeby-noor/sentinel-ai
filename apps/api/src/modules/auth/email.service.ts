import { Injectable, Logger } from '@nestjs/common';
import { getEnv, isEmailConfigured } from '../../config/env';

/**
 * Password-reset delivery. Uses SMTP when configured; otherwise reports
 * { sent: false } so callers fall back to the documented development-only flow.
 * Never logs recipient content beyond the address, and never logs tokens.
 */
@Injectable()
export class EmailService {
  private log = new Logger('Email');

  async sendPasswordReset(to: string, resetUrl: string): Promise<{ sent: boolean }> {
    const env = getEnv();
    if (!isEmailConfigured(env)) return { sent: false };
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      });
      await transporter.sendMail({
        from: env.SMTP_FROM,
        to,
        subject: 'Reset your Sentinel AI password',
        text: `You requested a password reset for Sentinel AI.\n\nOpen this link within 30 minutes to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
      });
      return { sent: true };
    } catch (e) {
      this.log.warn(`Password-reset email to ${to} failed: ${(e as Error).message}`);
      return { sent: false };
    }
  }
}
