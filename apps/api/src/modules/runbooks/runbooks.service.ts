import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class RunbooksService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, q: { search?: string; category?: string; serviceId?: string }) {
    const where: any = { organizationId: orgId };
    if (q.category) where.category = q.category;
    if (q.serviceId) where.serviceId = q.serviceId;
    if (q.search) where.OR = [{ title: { contains: q.search, mode: 'insensitive' } }, { contentMd: { contains: q.search, mode: 'insensitive' } }];
    return this.prisma.runbook.findMany({ where, orderBy: { updatedAt: 'desc' }, include: { service: { select: { id: true, name: true } } } });
  }

  get(orgId: string, id: string) {
    return this.prisma.runbook.findFirstOrThrow({ where: { id, organizationId: orgId }, include: { service: true } }).catch(() => { throw new BadRequestException('Runbook not found'); });
  }

  create(orgId: string, dto: { title: string; contentMd: string; category?: string; serviceId?: string }) {
    if (!dto.title?.trim() || !dto.contentMd?.trim()) throw new BadRequestException('title and contentMd are required');
    return this.prisma.runbook.create({ data: { organizationId: orgId, title: dto.title.trim(), contentMd: dto.contentMd, category: dto.category ?? 'general', serviceId: dto.serviceId ?? null } });
  }

  async update(orgId: string, id: string, dto: any) {
    await this.get(orgId, id);
    return this.prisma.runbook.update({ where: { id }, data: dto });
  }

  async remove(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.runbook.delete({ where: { id } });
    return { ok: true };
  }
}
