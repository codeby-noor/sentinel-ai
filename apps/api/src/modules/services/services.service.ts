import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './services.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, includeArchived = false) {
    return this.prisma.service.findMany({
      where: { organizationId: orgId, ...(includeArchived ? {} : { archived: false }) },
      orderBy: { name: 'asc' },
      include: { _count: { select: { incidents: { where: { status: { in: ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'REOPENED'] } } } } } },
    });
  }

  async get(orgId: string, id: string) {
    const svc = await this.prisma.service.findFirst({ where: { id, organizationId: orgId } });
    if (!svc) throw new NotFoundException('Service not found');
    const [recentChecks, openIncidents, recentLogs] = await Promise.all([
      this.prisma.healthCheck.findMany({ where: { serviceId: id }, orderBy: { checkedAt: 'desc' }, take: 50 }),
      this.prisma.incident.findMany({ where: { serviceId: id, organizationId: orgId, status: { in: ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'REOPENED'] } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.logEvent.findMany({ where: { serviceId: id }, orderBy: { timestamp: 'desc' }, take: 20 }),
    ]);
    return { ...svc, recentChecks, openIncidents, recentLogs };
  }

  create(orgId: string, actorId: string, dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        healthCheckUrl: dto.healthCheckUrl?.trim() || null,
        checkIntervalSec: dto.checkIntervalSec ?? 60,
        timeoutMs: dto.timeoutMs ?? 8000,
        failureThreshold: dto.failureThreshold ?? 3,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateServiceDto) {
    await this.get(orgId, id);
    return this.prisma.service.update({ where: { id }, data: { ...dto, name: dto.name?.trim(), description: dto.description?.trim(), healthCheckUrl: dto.healthCheckUrl?.trim() || null } });
  }

  async archive(orgId: string, id: string) {
    await this.get(orgId, id);
    return this.prisma.service.update({ where: { id }, data: { archived: true } });
  }
}
