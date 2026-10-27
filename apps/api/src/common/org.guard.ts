import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Requires X-Org-Id header (or orgId query) + membership. Sets req.orgId and req.membership. */
@Injectable()
export class OrgGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const orgId: string | undefined = req.headers['x-org-id'] || req.query?.orgId || req.body?.organizationId;
    if (!orgId) throw new ForbiddenException('Missing organization context (X-Org-Id header required)');
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: req.user.id, organizationId: orgId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this organization');
    req.orgId = orgId;
    req.membership = membership;
    return true;
  }
}
