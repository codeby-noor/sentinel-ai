import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { getEnv } from '../../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [
    JwtModule.register({
      // No fallback secret: misconfiguration must fail fast (see getEnv validation).
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, PasswordResetService],
  exports: [AuthService, PasswordResetService],
})
export class AuthModule {
  constructor() {
    // Validate env eagerly (throws with helpful message if misconfigured).
    try { getEnv(); } catch { /* allow build without env */ }
  }
}
