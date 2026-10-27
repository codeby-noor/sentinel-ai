import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { canTransition, dedupKeyFor } from './incident-state';
import { EventsService } from '../events/events.service';

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService, private events: EventsService) {}

  list(orgId: string, q: { status?: string; severity?: string; serviceId?: string; page?: string; pageSize?: string }) {
    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? '20', 10) || 20));
    const where: any = { organizationId: orgId };
    if (q.status) where.status = q.status;
    if (q.severity) where.severity = q.severity;
    if (q.serviceId) where.serviceId = q.serviceId;
    return (async () => {
      const [total, items] = await Promise.all([
        this.prisma.incident.count({ where }),
        this.prisma.incident.findMany({
          where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
          include: { service: { select: { id: true, name: true } }, assignments: { include: { user: { select: { id: true, name: true, email: true } } } }, _count: { select: { comments: true } } },
        }),
      ]);
      return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    })();
  }

  async get(orgId: string, id: string) {
    const inc = await this.prisma.incident.findFirst({
      where: { id, organizationId: orgId },
      include: {
        service: true,
        assignments: { include: { user: { select: { id: true, name: true, email: true } } } },
        comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 100 },
        investigations: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!inc) throw new NotFoundException('Incident not found');
    return inc;
  }

  async create(orgId: string, actorId: string, dto: { title: string; description?: string; serviceId?: string; severity?: any }) {
    if (!dto.title?.trim()) throw new BadRequestException('title is required');
    let serviceId: string | null = dto.serviceId ?? null;
    if (serviceId) {
      const svc = await this.prisma.service.findFirst({ where: { id: serviceId, organizationId: orgId } });
      if (!svc) throw new BadRequestException('Unknown service for this organization');
    }
    const dedupKey = dedupKeyFor(serviceId, dto.title);
    const existing = await this.prisma.incident.findUnique({ where: { organizationId_dedupKey: { organizationId: orgId, dedupKey } } });
    if (existing && existing.status !== 'RESOLVED') {
      throw new BadRequestException('A matching open incident already exists (deduplicated)');
    }
    const inc = await this.prisma.incident.create({
      data: { organizationId: orgId, serviceId, title: dto.title.trim().slice(0, 200), description: dto.description?.slice(0, 4000), severity: dto.severity ?? 'MEDIUM', status: 'OPEN', dedupKey },
    });
    await this.activity(inc.id, actorId, 'created', dto.title);
    await this.notifyMembers(orgId, 'INCIDENT_CREATED', `Incident: ${inc.title}`, inc.id);
    this.events.emit(orgId, { type: 'incident.created', incidentId: inc.id });
    return inc;
  }

  async transition(orgId: string, actorId: string, id: string, to: any) {
    const inc = await this.get(orgId, id);
    if (!canTransition(inc.status as any, to)) {
      throw new BadRequestException(`Invalid transition ${inc.status} -> ${to}`);
    }
    const now = new Date();
    const data: any = { status: to };
    if (to === 'ACKNOWLEDGED' && !inc.acknowledgedAt) data.acknowledgedAt = now;
    if (to === 'RESOLVED') data.resolvedAt = now;
    if (to === 'REOPENED') data.resolvedAt = null;
    const updated = await this.prisma.incident.update({ where: { id }, data });
    await this.activity(id, actorId, `status:${to}`, `${inc.status} -> ${to}`);
    if (to === 'RESOLVED') await this.notifyMembers(orgId, 'INCIDENT_RESOLVED', `Resolved: ${inc.title}`, id);
    this.events.emit(orgId, { type: 'incident.updated', incidentId: id, status: to });
    return updated;
  }

  async comment(orgId: string, actorId: string, id: string, body: string) {
    await this.get(orgId, id);
    if (!body?.trim()) throw new BadRequestException('Comment body required');
    const c = await this.prisma.incidentComment.create({ data: { incidentId: id, authorId: actorId, body: body.slice(0, 4000) } });
    await this.activity(id, actorId, 'comment', body.slice(0, 200));
    this.events.emit(orgId, { type: 'incident.comment', incidentId: id });
    return c;
  }

  async assign(orgId: string, actorId: string, id: string, userId: string) {
    await this.get(orgId, id);
    const member = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId, organizationId: orgId } } });
    if (!member) throw new BadRequestException('Assignee must be an organization member');
    await this.prisma.incidentAssignment.upsert({ where: { incidentId_userId: { incidentId: id, userId } }, create: { incidentId: id, userId }, update: {} });
    await this.activity(id, actorId, 'assigned', userId);
    await this.prisma.notification.create({ data: { userId, organizationId: orgId, type: 'INCIDENT_ASSIGNED', title: 'Assigned to incident', body: id } });
    this.events.emit(orgId, { type: 'incident.assigned', incidentId: id, userId });
    return { ok: true };
  }

  async unassign(orgId: string, actorId: string, id: string, userId: string) {
    await this.get(orgId, id);
    await this.prisma.incidentAssignment.deleteMany({ where: { incidentId: id, userId } });
    await this.activity(id, actorId, 'unassigned', userId);
    return { ok: true };
  }

  private activity(incidentId: string, actorId: string | null, action: string, detail?: string) {
    return this.prisma.incidentActivity.create({ data: { incidentId, actorId, action, detail } });
  }

  private async notifyMembers(orgId: string, type: any, title: string, incidentId: string) {
    const members = await this.prisma.membership.findMany({ where: { organizationId: orgId }, select: { userId: true } });
    if (!members.length) return;
    await this.prisma.notification.createMany({
      data: members.slice(0, 50).map((m) => ({ userId: m.userId, organizationId: orgId, type, title, body: incidentId })),
    });
  }
}
