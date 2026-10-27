import { IngestService } from './ingest.service';

describe('IngestService validation + isolation', () => {
  function setup() {
    const prisma: any = {
      ingestApiKey: { findUnique: jest.fn(), update: jest.fn() },
      service: { findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
      logEvent: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'l1', ...data })), count: jest.fn(), findMany: jest.fn() },
      incident: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({ id: 'i1' }) },
    };
    const limits: any = { hit: jest.fn().mockReturnValue({ allowed: true, remaining: 1 }) };
    return { prisma, svc: new IngestService(prisma, limits) };
  }

  it('rejects empty messages', async () => {
    const { svc } = setup();
    await expect(svc.ingest({ organizationId: 'o1' }, { severity: 'LOW', message: '   ' })).rejects.toThrow(/message is required/);
  });

  it('rejects unknown serviceIds from other orgs', async () => {
    const { prisma, svc } = setup();
    prisma.service.findFirst.mockResolvedValue(null);
    await expect(svc.ingest({ organizationId: 'o1' }, { severity: 'LOW', message: 'hi', serviceId: 'other' })).rejects.toThrow(/Unknown serviceId/);
  });

  it('enforces rate limits', async () => {
    const { prisma, svc } = setup();
    (svc as any).limits.hit.mockReturnValue({ allowed: false, remaining: 0 });
    await expect(svc.ingest({ organizationId: 'o1' }, { severity: 'LOW', message: 'hi' })).rejects.toThrow(/rate limit/i);
    expect(prisma.logEvent.create).not.toHaveBeenCalled();
  });
});
