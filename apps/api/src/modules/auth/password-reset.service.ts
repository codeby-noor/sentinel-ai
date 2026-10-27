import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { RateLimitService } from '../../common/rate-limit.service';
import { getEnv } from '../../config/env';
import { PASSWORD_RULE_MESSAGE, isPasswordLengthValid } from './password-policy';
import { EmailService } from './email.service';

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const GENERIC_FORGOT_MESSAGE =
  'If an account exists for that email, a password reset link has been sent. Check your inbox (and spam folder).';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordResetService {
  constructor(
    private prisma: PrismaService,
    private limits: RateLimitService,
    private email: EmailService,
  ) {}

  /** Always returns the generic message — never reveals whether the email exists. */
  async requestReset(emailRaw: string, ip: string): Promise<{ message: string; devResetUrl?: string }> {
    const rl = this.limits.hit(`pwreset:ip:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) throw new HttpException('Too many reset requests, try again later', HttpStatus.TOO_MANY_REQUESTS);
    const email = emailRaw.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: GENERIC_FORGOT_MESSAGE };

    // Invalidate prior unused tokens, then issue a fresh single-use token.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    const env = getEnv();
    const resetUrl = `${env.WEB_BASE_URL.replace(/\/$/, '')}/reset-password?token=${token}`;
    const { sent } = await this.email.sendPasswordReset(email, resetUrl);
    // Development-only fallback: expose the reset link in the response ONLY when
    // no email provider is configured AND the server is not running in production.
    // Production responses, logs, and pages never contain reset tokens.
    if (!sent && env.NODE_ENV !== 'production') {
      return { message: GENERIC_FORGOT_MESSAGE, devResetUrl: resetUrl };
    }
    return { message: GENERIC_FORGOT_MESSAGE };
  }

  async resetPassword(token: string, password: string, confirmPassword: string, ip: string): Promise<{ ok: true }> {
    const rl = this.limits.hit(`pwreset:confirm:${ip}`, 10, 15 * 60 * 1000);
    if (!rl.allowed) throw new HttpException('Too many reset attempts, try again later', HttpStatus.TOO_MANY_REQUESTS);
    if (!isPasswordLengthValid(password)) throw new BadRequestException(PASSWORD_RULE_MESSAGE);
    if (confirmPassword !== password) throw new BadRequestException('Passwords do not match.');

    const rec = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!rec || rec.usedAt || rec.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This reset link is invalid or has expired. Request a new one.');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: rec.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
      await tx.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.updateMany({ where: { userId: rec.userId, usedAt: null }, data: { usedAt: new Date() } });
    });
    return { ok: true };
  }
}
