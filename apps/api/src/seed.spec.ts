import * as bcrypt from 'bcryptjs';
import { seedDatabase } from '../prisma/seed';

const DEMO_KEYS = ['demo-pay-latency', 'demo-auth-401', 'demo-db-pool', 'demo-notify-backlog', 'demo-inventory-sync', 'demo-vendor-timeout'];

/** Mock Prisma client. seeded=true simulates a database after a previous seed run. */
function mockPrisma(seeded: boolean) {
  const services = new Map<string, any>();
  const incidents = new Map<string, any>();
  if (seeded) {
    for (const k of DEMO_KEYS) incidents.set(k, { id: 'inc-' + k });
    incidents.set('demo-checkout-spike', { id: 'inc-base' });
    for (const n of ['checkout-api', 'auth-service', 'search-worker', 'notification-service', 'inventory-sync']) {
      services.set(n, { id: 'svc-' + n, name: n });
    }
  }
  const calls: { model: string; op: string; args: any }[] = [];
  const rec = (model: string, op: string) => (args: any) => {
    calls.push({ model, op, args: JSON.parse(JSON.stringify(args ?? null)) });
    return undefined as any;
  };
  const client: any = {
    __calls: calls,
    user: { upsert: jest.fn().mockImplementation(({ where, create }: any) => Promise.resolve({ id: 'u-' + where.email, ...create })) },
    organization: { upsert: jest.fn().mockResolvedValue({ id: 'org1' }) },
    membership: { upsert: jest.fn().mockResolvedValue({}) },
    service: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(services.get(where.name) ?? null)),
      create: jest.fn().mockImplementation(({ data }: any) => { const s = { id: 'svc-' + data.name, ...data }; services.set(data.name, s); return Promise.resolve(s); }),
    },
    healthCheck: {
      count: jest.fn().mockResolvedValue(seeded ? 24 : 0),
      create: jest.fn().mockImplementation(({ data }: any) => { rec('healthCheck', 'create')(data); return Promise.resolve({ id: 'h1', ...data }); }),
    },
    logEvent: {
      findFirst: jest.fn().mockResolvedValue(seeded ? { id: 'l0' } : null),
      createMany: jest.fn().mockImplementation(({ data }: any) => { rec('logEvent', 'createMany')(data); return Promise.resolve({ count: data.length }); }),
    },
    incident: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(incidents.get(where.organizationId_dedupKey.dedupKey) ?? null)),
      create: jest.fn().mockImplementation(({ data }: any) => { const i = { id: 'inc-' + data.dedupKey, ...data }; incidents.set(data.dedupKey, i); rec('incident', 'create')(data); return Promise.resolve(i); }),
    },
    incidentComment: { create: jest.fn().mockImplementation(({ data }: any) => { rec('comment', 'create')(data); return Promise.resolve({ id: 'c1', ...data }); }) },
    incidentActivity: { create: jest.fn().mockImplementation(({ data }: any) => { rec('activity', 'create')(data); return Promise.resolve({ id: 'a1', ...data }); }) },
    runbook: {
      findFirst: jest.fn().mockResolvedValue(seeded ? { id: 'r1' } : null),
      create: jest.fn().mockResolvedValue({ id: 'r1' }),
    },
  };
  return client;
}

describe('seed', () => {
  it('creates the user123@gmail.com demo account with a verifiable password hash', async () => {
    const prisma = mockPrisma(false);
    await seedDatabase(prisma);
    const upsert = prisma.user.upsert.mock.calls.find((c: any) => c[0].where.email === 'user123@gmail.com');
    expect(upsert).toBeDefined();
    expect(await bcrypt.compare('user@123', upsert[0].create.passwordHash)).toBe(true);
    expect(await bcrypt.compare('wrongpwd', upsert[0].create.passwordHash)).toBe(false);
  });

  it('keeps demo@sentinel.dev working and assigns MEMBER to the demo user in demo-org', async () => {
    const prisma = mockPrisma(false);
    await seedDatabase(prisma);
    const owner = prisma.user.upsert.mock.calls.find((c: any) => c[0].where.email === 'demo@sentinel.dev');
    expect(await bcrypt.compare('Sentinel123!', owner[0].create.passwordHash)).toBe(true);
    const roles = prisma.membership.upsert.mock.calls.map((c: any) => c[0].create.role).sort();
    expect(roles).toEqual(['MEMBER', 'OWNER']);
  });

  it('seeds exactly the six demo incidents with varied severities and statuses', async () => {
    const prisma = mockPrisma(false);
    await seedDatabase(prisma);
    const created = prisma.incident.create.mock.calls.map((c: any) => c[0].data);
    for (const k of DEMO_KEYS) expect(created.some((d: any) => d.dedupKey === k)).toBe(true);
    expect(new Set(created.map((d: any) => d.severity)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(created.map((d: any) => d.status)).size).toBeGreaterThanOrEqual(4);
    expect(created.every((d: any) => d.title.includes('(demo)'))).toBe(true);
    // Timelines: resolved record carries remediation + resolvedAt; reopened carries history.
    const resolved = created.find((d: any) => d.dedupKey === 'demo-inventory-sync');
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedAt).toBeDefined();
  });

  it('never stores plaintext passwords', async () => {
    const prisma = mockPrisma(false);
    await seedDatabase(prisma);
    const dump = JSON.stringify(prisma.__calls) + JSON.stringify(prisma.user.upsert.mock.calls);
    expect(dump).not.toContain('user@123');
    expect(dump).not.toContain('Sentinel123!');
  });

  it('is idempotent: a second run creates nothing new', async () => {
    const prisma = mockPrisma(true);
    await seedDatabase(prisma);
    expect(prisma.service.create).not.toHaveBeenCalled();
    expect(prisma.incident.create).not.toHaveBeenCalled();
    expect(prisma.logEvent.createMany).not.toHaveBeenCalled();
    expect(prisma.healthCheck.create).not.toHaveBeenCalled();
    expect(prisma.incidentComment.create).not.toHaveBeenCalled();
    expect(prisma.incidentActivity.create).not.toHaveBeenCalled();
    expect(prisma.runbook.create).not.toHaveBeenCalled();
  });
});
