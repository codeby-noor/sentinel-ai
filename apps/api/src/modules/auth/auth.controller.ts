import { Body, Controller, Get, Ip, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { getEnv } from '../../config/env';
import { CurrentUser, AuthUser } from '../../common/current-user';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto } from './auth.dto';

function setSessionCookie(res: Response, token: string) {
  const env = getEnv();
  res.cookie('sentinel_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE && env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private resets: PasswordResetService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.register(dto);
    setSessionCookie(res, out.token);
    return { user: out.user, memberships: out.memberships };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.auth.login(dto);
    setSessionCookie(res, out.token);
    return { user: out.user, memberships: out.memberships };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('sentinel_session', { path: '/' });
    return { ok: true };
  }

  @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto, @Ip() ip: string) {
    return this.resets.requestReset(dto.email, ip ?? 'unknown');
  }

  @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto, @Ip() ip: string) {
    return this.resets.resetPassword(dto.token, dto.password, dto.confirmPassword, ip ?? 'unknown');
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(u.id, dto.name);
  }
}
