import { Body, Controller, Get, Ip, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { getEnv } from '../../config/env';
import { CurrentUser, AuthUser } from '../../common/current-user';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto } from './auth.dto';

function sessionCookieOptions(): Pick<CookieOptions, 'httpOnly' | 'sameSite' | 'secure' | 'path'> {
  const env = getEnv();
  return {
    httpOnly: true,
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: env.NODE_ENV === 'production' || env.COOKIE_SECURE,
    path: '/',
  };
}

function setSessionCookie(res: Response, token: string) {
  res.cookie('sentinel_session', token, {
    ...sessionCookieOptions(),
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
    res.clearCookie('sentinel_session', sessionCookieOptions());
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
