import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.sentinel_session || this.bearer(req.headers?.authorization);
    if (!token) throw new UnauthorizedException('Not authenticated');
    try {
      const payload = await this.jwt.verifyAsync(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException('Session user not found');
      // Revoked when sessionVersion was bumped (e.g. after a password reset).
      if ((payload.sv ?? 0) !== (user as any).sessionVersion) throw new UnauthorizedException('Session revoked, please sign in again');
      req.user = { id: user.id, email: user.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
  }

  private bearer(h?: string): string | undefined {
    if (!h?.startsWith('Bearer ')) return undefined;
    return h.slice(7);
  }
}
