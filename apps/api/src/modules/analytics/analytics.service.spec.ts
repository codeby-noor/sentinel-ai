import { AnalyticsService } from './analytics.service';

describe('AnalyticsService calculations', () => {
  it('computes MTTA/MTTR/errorRate from stored records', async () => {
    const t0 = new Date('2026-01-01T00:00:00Z');
    const prisma: any = {
      service: { findMany: jest.fn().mockResolvedValue([{ status: 'HEALTHY' }, { status: 'DOWN' }]) },
      incident: {
        findMany: jest.fn().mockResolvedValue([
          { status: 'RESOLVED', severity: 'HIGH', createdAt: t0, acknowledgedAt: new Date(t0.getTime() + 600_000), resolvedAt: new Date(t0.getTime() + 3600_000) },
          { status: 'OPEN', severity: 'CRITICAL', createdAt: t0, acknowledgedAt: null, resolvedAt: null },
        ]),
      },
      logEvent: { groupBy: jest.fn().mockResolvedValue([{ severity: 'CRITICAL', _count: 5 }, { severity: 'LOW', _count: 95 }]) },
      healthCheck: { findMany: jest.fn().mockResolvedValue([{ ok: true, latencyMs: 100 }, { ok: true, latencyMs: 200 }]) },
    };
    const svc = new AnalyticsService(prisma);
    const out = await svc.overview('org1', '2026-01-01', '2026-01-08');
    expect(out.totals.services).toBe(2);
    expect(out.totals.openIncidents).toBe(1);
    expect(out.mttaSec).toBeCloseTo(600);
    expect(out.mttrSec).toBeCloseTo(3600);
    expect(out.errorRate).toBeCloseTo(0.05);
    expect(out.methods.mtta).toMatch(/acknowledgedAt/);
  });

  it('returns nulls (not fake zeros) when there is no data', async () => {
    const prisma: any = {
      service: { findMany: jest.fn().mockResolvedValue([]) },
      incident: { findMany: jest.fn().mockResolvedValue([]) },
      logEvent: { groupBy: jest.fn().mockResolvedValue([]) },
      healthCheck: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const out = await new AnalyticsService(prisma).overview('org1');
    expect(out.mttaSec).toBeNull();
    expect(out.mttrSec).toBeNull();
    expect(out.errorRate).toBe(0);
  });
});
