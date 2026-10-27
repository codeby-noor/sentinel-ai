import { IncidentsService } from './incidents.service';

function mockPrisma(existingStatus = 'OPEN') {
  return {
    incident: {
      findFirst: jest.fn().mockResolvedValue({ id: 'i1', status: existingStatus, title: 't', acknowledgedAt: null }),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'i1' }),
      update: jest.fn().mockResolvedValue({ id: 'i1', status: 'ACKNOWLEDGED' }),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    incidentActivity: { create: jest.fn().mockResolvedValue({}) },
    membership: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { createMany: jest.fn().mockResolvedValue({}) },
    incidentAssignment: { upsert: jest.fn() },
    incidentComment: { create: jest.fn() },
  } as any;
}

describe('IncidentsService tenant + lifecycle', () => {
  it('rejects invalid state transitions without touching the DB update', async () => {
    const prisma = mockPrisma('RESOLVED');
    const events = { emit: jest.fn() } as any;
    const svc = new IncidentsService(prisma, events);
    await expect(svc.transition('org1', 'u1', 'i1', 'OPEN')).rejects.toThrow(/Invalid transition/);
    expect(prisma.incident.update).not.toHaveBeenCalled();
  });

  it('deduplicates an existing open incident on create', async () => {
    const prisma = mockPrisma('OPEN');
    (prisma.incident.findUnique as jest.Mock).mockResolvedValue({ id: 'old', status: 'OPEN' });
    const events = { emit: jest.fn() } as any;
    const svc = new IncidentsService(prisma, events);
    await expect(svc.create('org1', 'u1', { title: 'Same Title' })).rejects.toThrow(/deduplicated/);
  });

  it('scopes reads by organizationId', async () => {
    const prisma = mockPrisma('OPEN');
    const events = { emit: jest.fn() } as any;
    const svc = new IncidentsService(prisma, events);
    await svc.get('org-abc', 'i1');
    expect(prisma.incident.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-abc' }) }));
  });
});
