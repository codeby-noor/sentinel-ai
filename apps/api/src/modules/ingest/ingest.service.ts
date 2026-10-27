import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { RateLimitService } from '../../common/rate-limit.service';
import { dedupKeyFor } from '../incidents/incident-state';

function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class IngestService {
  constructor(private prisma: PrismaService, private limits: RateLimitService) {}

  async createApiKey(orgId: string, name: string) {
    const raw = 'sk_' + crypto.randomBytes(24).toString('hex');
    const rec = await this.prisma.ingestApiKey.create({
      data: { organizationId: orgId, name: name.trim(), keyPrefix: raw.slice(0, 8), keyHash: hashKey(raw) },
    });
    // Return plaintext exactly once.
    return { id: rec.id, name: rec.name, keyPrefix: rec.keyPrefix, apiKey: raw, createdAt: rec.createdAt };
  }

  listApiKeys(orgId: string) {
    return this.prisma.ingestApiKey.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, revokedAt: true, createdAt: true } });
  }

  async revokeApiKey(orgId: string, id: string) {
    await this.prisma.ingestApiKey.updateMany({ where: { id, organizationId: orgId }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  async resolveOrgFromKey(rawKey: string) {
    const rec = await this.prisma.ingestApiKey.findUnique({ where: { keyHash: hashKey(rawKey) } });
    if (!rec || rec.revokedAt) throw new UnauthorizedException('Invalid ingestion API key');
    await this.prisma.ingestApiKey.update({ where: { id: rec.id }, data: { lastUsedAt: new Date() } });
    return rec;
  }

  async ingest(apiKeyRec: { organizationId: string }, dto: any) {
    // Rate limit: 120 events/min per org.
    const rl = this.limits.hit(`ingest:${apiKeyRec.organizationId}`, 120, 60_000);
    if (!rl.allowed) throw new BadRequestException('Ingestion rate limit exceeded, retry later');

    const message = String(dto.message ?? '').slice(0, 8000);
    if (!message.trim()) throw new BadRequestException('message is required');
    if (/[<]script|eval\s*\(|Function\s*\(/i.test(message) && message.includes('<script')) {
      throw new BadRequestException('Log message contains disallowed content');
    }
    const severity = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(dto.severity) ? dto.severity : 'LOW';
    let serviceId: string | null = dto.serviceId ?? null;
    if (serviceId) {
      const svc = await this.prisma.service.findFirst({ where: { id: serviceId, organizationId: apiKeyRec.organizationId } });
      if (!svc) throw new BadRequestException('Unknown serviceId for this organization');
    }
    let ts = new Date();
    if (dto.timestamp) {
      const d = new Date(dto.timestamp);
      if (isNaN(d.getTime())) throw new BadRequestException('Invalid timestamp');
      ts = d;
    }
    const log = await this.prisma.logEvent.create({
      data: {
        organizationId: apiKeyRec.organizationId,
        serviceId,
        severity: severity as any,
        environment: String(dto.environment ?? 'production').slice(0, 40),
        message,
        stackTrace: dto.stackTrace ? String(dto.stackTrace).slice(0, 20000) : null,
        traceId: dto.traceId ? String(dto.traceId).slice(0, 120) : null,
        metadata: dto.metadata && typeof dto.metadata === 'object' ? dto.metadata : undefined,
        timestamp: ts,
      },
    });

    // Auto-incident: CRITICAL log or HIGH with stack trace creates/dedups an incident.
    if (severity === 'CRITICAL' || (severity === 'HIGH' && dto.stackTrace)) {
      const title = message.split('\n')[0].slice(0, 140) || 'Critical log event';
      const dedupKey = dedupKeyFor(serviceId, title);
      const existing = await this.prisma.incident.findUnique({ where: { organizationId_dedupKey: { organizationId: apiKeyRec.organizationId, dedupKey } } });
      const isOpen = existing && !['RESOLVED'].includes(existing.status);
      if (!isOpen) {
        await this.prisma.incident.upsert({
          where: { organizationId_dedupKey: { organizationId: apiKeyRec.organizationId, dedupKey } },
          create: { organizationId: apiKeyRec.organizationId, serviceId, title, description: message.slice(0, 2000), severity: severity as any, status: 'OPEN', dedupKey },
          update: { status: 'REOPENED', title, description: message.slice(0, 2000), updatedAt: new Date() },
        });
      }
    }
    return log;
  }

  async query(orgId: string, q: { serviceId?: string; severity?: string; env?: string; search?: string; from?: string; to?: string; page?: string; pageSize?: string }) {
    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? '25', 10) || 25));
    const where: any = { organizationId: orgId };
    if (q.serviceId) where.serviceId = q.serviceId;
    if (q.severity) where.severity = q.severity;
    if (q.env) where.environment = q.env;
    if (q.from || q.to) where.timestamp = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
    if (q.search) where.message = { contains: q.search, mode: 'insensitive' };
    const [total, items] = await Promise.all([
      this.prisma.logEvent.count({ where }),
      this.prisma.logEvent.findMany({ where, orderBy: { timestamp: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { service: { select: { id: true, name: true } } } }),
    ]);
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getOne(orgId: string, id: string) {
    const log = await this.prisma.logEvent.findFirst({ where: { id, organizationId: orgId }, include: { service: true } });
    if (!log) throw new BadRequestException('Log event not found');
    return log;
  }
}
