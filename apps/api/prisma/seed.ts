import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Demo seed. Clearly labelled demo data for a local demonstration environment —
 * never presented as live production telemetry (see README + UI badge).
 *
 * Idempotency: every record is guarded (upsert / find-first checks), so running
 * the seed twice never creates duplicates and never overwrites user edits.
 * Only password hashes are stored — never plaintext passwords.
 */
export async function seedDatabase(prisma: PrismaClient) {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600_000);

  async function ensureUser(email: string, name: string, password: string) {
    return prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash: await bcrypt.hash(password, 12) },
      update: { name },
    });
  }

  const owner = await ensureUser('demo@sentinel.dev', 'Demo Engineer', 'Sentinel123!');
  // Public demo account (documented on the login page — demo data only).
  const demoMember = await ensureUser('user123@gmail.com', 'Demo User', 'user@123');

  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    create: { name: 'Demo Org', slug: 'demo-org' },
    update: {},
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
    create: { userId: owner.id, organizationId: org.id, role: 'OWNER' },
    update: { role: 'OWNER' },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: demoMember.id, organizationId: org.id } },
    create: { userId: demoMember.id, organizationId: org.id, role: 'MEMBER' },
    update: { role: 'MEMBER' },
  });

  async function ensureService(def: { name: string; description: string; healthCheckUrl: string | null; status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN' }) {
    const existing = await prisma.service.findFirst({ where: { organizationId: org.id, name: def.name } });
    if (existing) return existing;
    return prisma.service.create({ data: { organizationId: org.id, ...def } });
  }

  const checkout = await ensureService({ name: 'checkout-api', description: 'Payments checkout service', healthCheckUrl: 'https://example.com/health', status: 'HEALTHY' });
  const authSvc = await ensureService({ name: 'auth-service', description: 'Authentication & sessions', healthCheckUrl: 'https://example.com/auth/health', status: 'DEGRADED' });
  const search = await ensureService({ name: 'search-worker', description: 'Async search indexer', healthCheckUrl: null, status: 'UNKNOWN' });
  const notifySvc = await ensureService({ name: 'notification-service', description: 'Email, SMS and push delivery worker', healthCheckUrl: 'https://example.com/notify/health', status: 'DEGRADED' });
  const inventory = await ensureService({ name: 'inventory-sync', description: 'Warehouse stock synchronisation job', healthCheckUrl: null, status: 'HEALTHY' });

  // Original baseline telemetry (guarded so reruns never duplicate).
  if ((await prisma.healthCheck.count({ where: { serviceId: checkout.id } })) === 0) {
    for (let i = 0; i < 24; i++) {
      await prisma.healthCheck.create({
        data: { serviceId: checkout.id, ok: i % 8 !== 7, latencyMs: 80 + ((i * 37) % 220), statusCode: i % 8 !== 7 ? 200 : 500, checkedAt: new Date(now - i * 3600_000) },
      });
    }
  }
  if (!(await prisma.logEvent.findFirst({ where: { organizationId: org.id, traceId: 'tr_demo_1' } }))) {
    await prisma.logEvent.createMany({
      data: [
        { organizationId: org.id, serviceId: checkout.id, severity: 'CRITICAL', environment: 'production', message: 'Stripe charge failed: card_declined', stackTrace: 'Error: card_declined\n    at charge (stripe.js:42)', traceId: 'tr_demo_1', timestamp: new Date(now - 3600_000) },
        { organizationId: org.id, serviceId: checkout.id, severity: 'HIGH', environment: 'production', message: 'DB pool exhausted: timeout acquiring connection', timestamp: new Date(now - 7200_000) },
        { organizationId: org.id, serviceId: checkout.id, severity: 'MEDIUM', environment: 'staging', message: 'Slow query detected on orders table (812ms)', timestamp: new Date(now - 10800_000) },
      ],
    });
  }
  const existingBaseline = await prisma.incident.findUnique({ where: { organizationId_dedupKey: { organizationId: org.id, dedupKey: 'demo-checkout-spike' } } });
  if (!existingBaseline) {
    await prisma.incident.create({
      data: { organizationId: org.id, serviceId: checkout.id, title: 'Checkout failures spike (demo)', description: 'Seeded demo incident showing the investigation workflow.', severity: 'HIGH', status: 'INVESTIGATING', dedupKey: 'demo-checkout-spike' },
    });
  }
  const rb = await prisma.runbook.findFirst({ where: { organizationId: org.id, title: 'Checkout outage runbook (demo)' } });
  if (!rb) {
    await prisma.runbook.create({
      data: { organizationId: org.id, serviceId: checkout.id, title: 'Checkout outage runbook (demo)', category: 'payments', contentMd: '# Checkout outage\n\n1. Check Stripe status\n2. Inspect `checkout-api` error logs\n3. Verify DB pool metrics\n4. Roll back last deploy if error rate > 5%\n' },
    });
  }

  // ---- Six realistic demo incidents (skipped entirely if already seeded) ----
  async function seedIncident(rec: {
    dedupKey: string; serviceId: string | null; title: string; description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'REOPENED';
    createdHoursAgo: number; acknowledgedHoursAgo?: number; resolvedHoursAgo?: number;
    logs: { severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; environment: string; message: string; stackTrace?: string; traceId: string; hoursAgo: number }[];
    comments: { hoursAgo: number; body: string }[];
    activities: { hoursAgo: number; action: string; detail?: string }[];
  }) {
    const exists = await prisma.incident.findUnique({ where: { organizationId_dedupKey: { organizationId: org.id, dedupKey: rec.dedupKey } } });
    if (exists) return;
    const inc = await prisma.incident.create({
      data: {
        organizationId: org.id, serviceId: rec.serviceId, title: rec.title, description: rec.description,
        severity: rec.severity, status: rec.status, dedupKey: rec.dedupKey,
        createdAt: hoursAgo(rec.createdHoursAgo),
        acknowledgedAt: rec.acknowledgedHoursAgo !== undefined ? hoursAgo(rec.acknowledgedHoursAgo) : null,
        resolvedAt: rec.resolvedHoursAgo !== undefined ? hoursAgo(rec.resolvedHoursAgo) : null,
      },
    });
    if (rec.logs.length) {
      await prisma.logEvent.createMany({
        data: rec.logs.map((l) => ({
          organizationId: org.id, serviceId: rec.serviceId, severity: l.severity, environment: l.environment,
          message: l.message, stackTrace: l.stackTrace ?? null, traceId: l.traceId, timestamp: hoursAgo(l.hoursAgo),
        })),
      });
    }
    for (const c of rec.comments) {
      await prisma.incidentComment.create({ data: { incidentId: inc.id, authorId: owner.id, body: c.body, createdAt: hoursAgo(c.hoursAgo) } });
    }
    for (const a of rec.activities) {
      await prisma.incidentActivity.create({ data: { incidentId: inc.id, actorId: owner.id, action: a.action, detail: a.detail, createdAt: hoursAgo(a.hoursAgo) } });
    }
  }

  // 1. Payment API latency spike (open, critical).
  await seedIncident({
    dedupKey: 'demo-pay-latency', serviceId: checkout.id,
    title: 'Payment API latency spike — p95 above 2s (demo)',
    description: 'checkout-api p95 latency rose from a 320ms baseline to 2.4s over 40 minutes. Checkout completion rate dropped 11% (1,240 of ~11,300 checkouts delayed). No elevated 5xx yet; suspect downstream slowness rather than saturation.',
    severity: 'CRITICAL', status: 'OPEN', createdHoursAgo: 5,
    logs: [
      { severity: 'HIGH', environment: 'production', message: 'p95 latency 2.4s on POST /v1/charges (baseline 320ms, 4,800 rpm)', traceId: 'tr_demo_pay_1', hoursAgo: 5 },
      { severity: 'MEDIUM', environment: 'production', message: 'Upstream processor response time 1.9s avg over last 15m', traceId: 'tr_demo_pay_2', hoursAgo: 4 },
    ],
    comments: [{ hoursAgo: 4, body: 'Triage: errors flat, latency isolated to charge path. Next: compare deploy timeline, inspect processor dashboard, consider traffic shift if p95 crosses 3s.' }],
    activities: [
      { hoursAgo: 5, action: 'auto-created', detail: 'p95 latency alert (>2s for 10m)' },
      { hoursAgo: 4, action: 'comment', detail: 'triage note added' },
    ],
  });

  // 2. Authentication service errors after deploy (acknowledged, high).
  await seedIncident({
    dedupKey: 'demo-auth-401', serviceId: authSvc.id,
    title: 'Auth errors surge after v2.14.3 deploy (demo)',
    description: 'After the v2.14.3 rollout, POST /login 5xx rate climbed to 3.8% (~190 failures / 5,000 attempts in 20m) plus a burst of 401s from stale mobile tokens. Web sessions unaffected; mobile app versions below 4.2 hit hardest.',
    severity: 'HIGH', status: 'ACKNOWLEDGED', createdHoursAgo: 26, acknowledgedHoursAgo: 25,
    logs: [
      { severity: 'HIGH', environment: 'production', message: 'POST /login returned 500 for 3.8% of attempts after deploy v2.14.3', stackTrace: 'TypeError: Cannot read properties of undefined (reading \'session\')\n    at loginHandler (auth.js:118)', traceId: 'tr_demo_auth_1', hoursAgo: 26 },
      { severity: 'MEDIUM', environment: 'production', message: '401 spike on /refresh: 620 rejections in 10m (mobile < 4.2)', traceId: 'tr_demo_auth_2', hoursAgo: 25 },
    ],
    comments: [{ hoursAgo: 25, body: 'Acknowledged by on-call. Canary halted at 10%. Next: read v2.14.3 diff around session handling, decide rollback vs forward-fix.' }],
    activities: [
      { hoursAgo: 26, action: 'auto-created', detail: 'error-rate alert (5xx > 2%)' },
      { hoursAgo: 25, action: 'status:ACKNOWLEDGED', detail: 'OPEN -> ACKNOWLEDGED' },
    ],
  });

  // 3. Database connection pool exhaustion (investigating, critical).
  await seedIncident({
    dedupKey: 'demo-db-pool', serviceId: checkout.id,
    title: 'Database connection pool exhaustion (demo)',
    description: 'Primary Postgres pool (max 50) saturated for 25 minutes: 340 timed-out acquisitions, checkout and refund endpoints returning 503. Slow query on orders table (p99 4.1s) coincides with the 02:00 analytics export. Read replica lag nominal at 0.4s.',
    severity: 'CRITICAL', status: 'INVESTIGATING', createdHoursAgo: 12, acknowledgedHoursAgo: 11,
    logs: [
      { severity: 'CRITICAL', environment: 'production', message: 'Pool exhausted: 340 timeouts acquiring connection (pool max 50)', traceId: 'tr_demo_db_1', hoursAgo: 12 },
      { severity: 'HIGH', environment: 'production', message: 'Slow query: SELECT on orders took 4.1s (p99), overlapping analytics export', traceId: 'tr_demo_db_2', hoursAgo: 12 },
      { severity: 'MEDIUM', environment: 'production', message: '503 rate 6.2% on /v1/refunds during saturation window', traceId: 'tr_demo_db_3', hoursAgo: 11 },
    ],
    comments: [
      { hoursAgo: 11, body: 'Pool raised 50 → 80 as stopgap; errors subsiding. Investigating the analytics export query plan before calling this fixed.' },
      { hoursAgo: 10, body: 'Next: add statement timeout to export job, move it off peak, review missing index on orders(created_at).' },
    ],
    activities: [
      { hoursAgo: 12, action: 'auto-created', detail: 'pool saturation alert' },
      { hoursAgo: 11, action: 'status:INVESTIGATING', detail: 'ACKNOWLEDGED -> INVESTIGATING' },
    ],
  });

  // 4. Notification queue backlog (open, medium).
  await seedIncident({
    dedupKey: 'demo-notify-backlog', serviceId: notifySvc.id,
    title: 'Notification queue backlog — delayed emails (demo)',
    description: 'Email queue depth grew to 48,500 jobs with median delivery delay 52 minutes (SLO: 5 minutes). SMS/push unaffected. Cause points at a stuck template-render worker after a content deploy, not provider throttling (provider quota at 31%).',
    severity: 'MEDIUM', status: 'OPEN', createdHoursAgo: 3,
    logs: [
      { severity: 'MEDIUM', environment: 'production', message: 'Email queue depth 48,500 jobs; median delay 52m (SLO 5m)', traceId: 'tr_demo_notify_1', hoursAgo: 3 },
      { severity: 'MEDIUM', environment: 'production', message: 'Template worker render p99 9.8s after content deploy (was 0.4s)', traceId: 'tr_demo_notify_2', hoursAgo: 3 },
    ],
    comments: [{ hoursAgo: 2, body: 'Next: drain with scaled render workers, pause non-critical campaigns, verify provider quota headroom before re-enabling.' }],
    activities: [{ hoursAgo: 3, action: 'auto-created', detail: 'queue-depth alert (>10k jobs)' }],
  });

  // 5. Inventory synchronization failure (resolved, high) — includes remediation record.
  await seedIncident({
    dedupKey: 'demo-inventory-sync', serviceId: inventory.id,
    title: 'Inventory sync mismatch across warehouses (demo)',
    description: 'Nightly sync left 312 SKUs mismatched between the catalog and two warehouses (largest delta: 84 units on SKU WH-2214). No oversells confirmed; 14 orders held for manual review. Root cause was a timezone bug skipping the EU warehouse window.',
    severity: 'HIGH', status: 'RESOLVED', createdHoursAgo: 76, acknowledgedHoursAgo: 74, resolvedHoursAgo: 67,
    logs: [
      { severity: 'HIGH', environment: 'production', message: 'Sync mismatch: 312 SKUs differ; max delta 84 units (SKU WH-2214)', traceId: 'tr_demo_inv_1', hoursAgo: 76 },
      { severity: 'MEDIUM', environment: 'production', message: 'EU warehouse window skipped: job ran 01:00 UTC instead of 01:00 CET', traceId: 'tr_demo_inv_2', hoursAgo: 75 },
    ],
    comments: [
      { hoursAgo: 74, body: 'Held 14 affected orders for manual review; counts reconciled from warehouse snapshots.' },
      { hoursAgo: 67, body: 'Remediation: pinned job to Europe/Berlin tz, added SKU-delta canary alert (>25 units), backfilled audit. Next: add oversell guardrail test.' },
    ],
    activities: [
      { hoursAgo: 76, action: 'auto-created', detail: 'sync-delta alert (312 SKUs)' },
      { hoursAgo: 74, action: 'status:ACKNOWLEDGED', detail: 'OPEN -> ACKNOWLEDGED' },
      { hoursAgo: 67, action: 'status:RESOLVED', detail: 'INVESTIGATING -> RESOLVED' },
    ],
  });

  // 6. Third-party API timeout (reopened, high).
  await seedIncident({
    dedupKey: 'demo-vendor-timeout', serviceId: search.id,
    title: 'External suggest-API timeouts degrading search (demo)',
    description: 'Third-party suggestion API timing out on 18% of calls (timeout 3s), dropping search autocomplete coverage to 64%. Previously resolved by raising timeouts; reopened after the vendor incident window recurred. Local fallback index covers only 40% of queries.',
    severity: 'HIGH', status: 'REOPENED', createdHoursAgo: 50, acknowledgedHoursAgo: 49, resolvedHoursAgo: 30,
    logs: [
      { severity: 'HIGH', environment: 'production', message: 'Suggest-API timeout on 18% of calls (3s limit); autocomplete coverage 64%', traceId: 'tr_demo_vendor_1', hoursAgo: 50 },
      { severity: 'MEDIUM', environment: 'production', message: 'Vendor status: elevated latency us-east (vendor incident #4821)', traceId: 'tr_demo_vendor_2', hoursAgo: 29 },
    ],
    comments: [{ hoursAgo: 29, body: 'Reopened: vendor incident recurred. Next: extend local fallback coverage, add circuit breaker at 10% timeout rate, track vendor SLA credit.' }],
    activities: [
      { hoursAgo: 50, action: 'auto-created', detail: 'dependency timeout alert' },
      { hoursAgo: 30, action: 'status:RESOLVED', detail: 'INVESTIGATING -> RESOLVED' },
      { hoursAgo: 29, action: 'status:REOPENED', detail: 'RESOLVED -> REOPENED' },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('Demo data seed complete.');
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

if (require.main === module) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED_IN_PRODUCTION !== '1') {
    console.error('Refusing to create demo accounts and data in production. Set ALLOW_DEMO_SEED_IN_PRODUCTION=1 only for an explicitly authorized demo deployment.');
    process.exitCode = 1;
  } else {
    main().catch(() => {
      console.error('Demo seed failed. Check database connectivity and schema state.');
      process.exitCode = 1;
    });
  }
}
