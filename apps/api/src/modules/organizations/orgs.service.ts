import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class OrgsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + crypto.randomBytes(3).toString('hex');
    const org = await this.prisma.$transaction(async (tx) => {
      const o = await tx.organization.create({ data: { name: name.trim(), slug } });
      await tx.membership.create({ data: { userId, organizationId: o.id, role: 'OWNER' } });
      return o;
    });
    return org;
  }

  members(orgId: string) {
    return this.prisma.membership.findMany({ where: { organizationId: orgId }, include: { user: { select: { id: true, email: true, name: true } } }, orderBy: { createdAt: 'asc' } });
  }

  async requireRole(orgId: string, userId: string, roles: string[]) {
    const m = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId, organizationId: orgId } } });
    if (!m || !roles.includes(m.role)) throw new ForbiddenException('Insufficient permissions');
    return m;
  }

  async invite(orgId: string, actorId: string, email: string, role: 'ADMIN' | 'MEMBER') {
    await this.requireRole(orgId, actorId, ['OWNER', 'ADMIN']);
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) throw new NotFoundException('No registered user with that email. They must register first.');
    const existing = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: orgId } } });
    if (existing) throw new BadRequestException('User is already a member');
    return this.prisma.membership.create({ data: { userId: user.id, organizationId: orgId, role } });
  }

  async updateMember(orgId: string, actorId: string, memberUserId: string, role: string) {
    const actor = await this.requireRole(orgId, actorId, ['OWNER', 'ADMIN']);
    if (actor.role !== 'OWNER' && role === 'OWNER') throw new ForbiddenException('Only owners can promote to owner');
    return this.prisma.membership.update({ where: { userId_organizationId: { userId: memberUserId, organizationId: orgId } }, data: { role: role as any } });
  }

  async removeMember(orgId: string, actorId: string, memberUserId: string) {
    await this.requireRole(orgId, actorId, ['OWNER', 'ADMIN']);
    const owners = await this.prisma.membership.count({ where: { organizationId: orgId, role: 'OWNER' } });
    const target = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId: memberUserId, organizationId: orgId } } });
    if (target?.role === 'OWNER' && owners <= 1) throw new BadRequestException('Cannot remove the last owner');
    await this.prisma.membership.delete({ where: { userId_organizationId: { userId: memberUserId, organizationId: orgId } } });
    return { ok: true };
  }

  update(orgId: string, name?: string) {
    if (!name) return this.prisma.organization.findUnique({ where: { id: orgId } });
    return this.prisma.organization.update({ where: { id: orgId }, data: { name: name.trim() } });
  }
}
