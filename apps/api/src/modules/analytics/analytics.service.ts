import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

/**
 * Metric definitions (documented for the UI):
 * - MTTA: mean(acknowledgedAt - createdAt) over incidents acknowledged in range.
 * - MTTR: mean(resolvedAt - createdAt) over incidents resolved in range.
 * - Error rate: CRITICAL+HIGH logs / total logs in range.
 * - Availability: healthy health-checks / total checks per service in range.
 */
@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async overview(orgId: string, from?: string, to?: string) {
    const gte = from ? new Date(from) : new Date(Date.now() - 7 * 864e5);
    const lte = to ? new Date(to) : new Date();

    const [services, incidents, logs, checks] = await Promise.all([
      this.prisma.service.findMany({ where: { organizationId: orgId, archived: false } }),
      this.prisma.incident.findMany({ where: { organizationId: orgId, createdAt: { gte, lte } } }),
      this.prisma.logEvent.groupBy({ by: ['severity'], where: { organizationId: orgId, timestamp: { gte, lte } }, _count: true }),
      this.prisma.healthCheck.findMany({ where: { service: { organizationId: orgId }, checkedAt: { gte, lte } }, select: { ok: true, serviceId: true, latencyMs: true } }),
    ]);

    const open = incidents.filter((i) => ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'REOPENED'].includes(i.status));
    const critical = open.filter((i) => i.severity === 'CRITICAL');
    const acked = incidents.filter((i) => i.acknowledgedAt);
    const resolved = incidents.filter((i) => i.resolvedAt);
    const mttaSec = acked.length ? acked.reduce((s, i) => s + ((i.acknowledgedAt!.getTime() - i.createdAt.getTime()) / 1000), 0) / acked.length : null;
    const mttrSec = resolved.length ? resolved.reduce((s, i) => s + ((i.resolvedAt!.getTime() - i.createdAt.getTime()) / 1000), 0) / resolved.length : null;

    const totalLogs = logs.reduce((s, g) => s + g._count, 0);
    const errLogs = logs.filter((g) => ['HIGH', 'CRITICAL'].includes(g.severity)).reduce((s, g) => s + g._count, 0);
    const errorRate = totalLogs ? errLogs / totalLogs : 0;

    const latencies = checks.map((c) => c.latencyMs ?? 0).filter((n) => n > 0).sort((a, b) => a - b);
    const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : null;
    const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] ?? latencies[latencies.length - 1] : null;

    const healthy = services.filter((s) => s.status === 'HEALTHY').length;

    // Daily incident trend
    const byDay = new Map<string, number>();
    for (const i of incidents) {
      const day = i.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const trend = [...byDay.entries()].sort().map(([date, count]) => ({ date, count }));

    const bySeverity = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((sev) => ({ severity: sev, count: incidents.filter((i) => i.severity === sev).length }));

    return {
      range: { from: gte, to: lte },
      totals: { services: services.length, healthy, unhealthy: services.length - healthy, openIncidents: open.length, critical: critical.length, totalLogs },
      mttaSec, mttrSec, errorRate, latency: { p50Ms: p50, p95Ms: p95 },
      trend, bySeverity,
      methods: {
        mtta: 'mean(acknowledgedAt - createdAt) for incidents acknowledged in range',
        mttr: 'mean(resolvedAt - createdAt) for incidents resolved in range',
        errorRate: '(HIGH + CRITICAL logs) / total logs in range',
        latency: 'p50/p95 of health-check latencyMs in range',
      },
    };
  }

  async dashboard(orgId: string) {
    const overview = await this.overview(orgId);
    const [recentIncidents, services] = await Promise.all([
      this.prisma.incident.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 8, include: { service: { select: { id: true, name: true } } } }),
      this.prisma.service.findMany({ where: { organizationId: orgId, archived: false }, orderBy: { name: 'asc' }, take: 50 }),
    ]);
    const activity = await this.prisma.incidentActivity.findMany({ where: { incident: { organizationId: orgId } }, orderBy: { createdAt: 'desc' }, take: 15 });
    return { ...overview, recentIncidents, services, activity };
  }
}
