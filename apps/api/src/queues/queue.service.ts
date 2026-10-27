import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { getEnv } from '../config/env';
import { PrismaService } from '../common/prisma.service';
import { EventsService } from '../modules/events/events.service';
import { dedupKeyFor } from '../modules/incidents/incident-state';

/**
 * Queue service: uses BullMQ+Redis when REDIS_URL is reachable,
 * otherwise falls back to an in-process scheduler so the app still works.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('Queue');
  private connection: IORedis | null = null;
  private healthQueue: Queue | null = null;
  private worker: Worker | null = null;
  private fallbackTimer: NodeJS.Timeout | null = null;
  useFallback = true;

  constructor(private prisma: PrismaService, private events: EventsService) {}

  async onModuleInit() {
    const env = getEnv();
    if (env.REDIS_URL) {
      try {
        // BullMQ requires maxRetriesPerRequest: null on its Redis connections.
        const conn = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: false });
        await conn.ping();
        this.connection = conn;
        this.healthQueue = new Queue('health-checks', { connection: conn });
        this.worker = new Worker('health-checks', (job) => this.runCheck(job.data.serviceId), { connection: conn.duplicate(), concurrency: 5 });
        new QueueEvents('health-checks', { connection: conn.duplicate() });
        this.useFallback = false;
        this.log.log('BullMQ connected (Redis).');
      } catch (e) {
        this.log.warn('Redis unavailable, using in-process health scheduler: ' + (e as Error).message);
      }
    }
    // In-process scheduler drives checks in both modes (enqueue or direct).
    const interval = Math.max(15000, getEnv().HEALTHCHECK_INTERVAL_MS);
    this.fallbackTimer = setInterval(() => this.tick().catch((e) => this.log.warn(String(e))), interval);
    // First tick shortly after boot (non-blocking).
    setTimeout(() => this.tick().catch(() => undefined), 5000);
  }

  async onModuleDestroy() {
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    await this.worker?.close().catch(() => undefined);
    await this.healthQueue?.close().catch(() => undefined);
    this.connection?.disconnect();
  }

  status() {
    return { mode: this.useFallback ? 'in-process' : 'bullmq+redis' };
  }

  private async tick() {
    const services = await this.prisma.service.findMany({ where: { archived: false, healthCheckUrl: { not: null } } });
    for (const svc of services) {
      const due = !svc.lastCheckedAt || Date.now() - svc.lastCheckedAt.getTime() >= (svc.checkIntervalSec ?? 60) * 1000;
      if (!due) continue;
      if (this.healthQueue && !this.useFallback) {
        await this.healthQueue.add('check', { serviceId: svc.id }, { removeOnComplete: 50, removeOnFail: 20 }).catch(() => this.runCheck(svc.id));
      } else {
        await this.runCheck(svc.id).catch(() => undefined);
      }
    }
  }

  /** Real HTTP health check with timeout + failure threshold + deduped incident creation. */
  async runCheck(serviceId: string) {
    const env = getEnv();
    const svc = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!svc || !svc.healthCheckUrl || svc.archived) return;
    const timeoutMs = svc.timeoutMs ?? env.HEALTHCHECK_TIMEOUT_MS;
    const started = Date.now();
    let ok = false;
    let statusCode: number | null = null;
    let error: string | null = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const resp = await fetch(svc.healthCheckUrl, { signal: ctrl.signal, redirect: 'follow' });
        statusCode = resp.status;
        ok = resp.ok;
        if (!ok) error = `HTTP ${resp.status}`;
        await resp.text().catch(() => '');
      } finally {
        clearTimeout(t);
      }
    } catch (e: any) {
      ok = false;
      error = e?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(e?.message ?? e).slice(0, 500);
    }
    const latencyMs = Date.now() - started;
    await this.prisma.healthCheck.create({ data: { serviceId, ok, latencyMs, statusCode, error } });

    const fails = ok ? 0 : (svc.consecutiveFails ?? 0) + 1;
    const threshold = svc.failureThreshold ?? env.HEALTHCHECK_FAILURE_THRESHOLD;
    const status = ok ? 'HEALTHY' : fails >= threshold ? 'DOWN' : 'DEGRADED';
    await this.prisma.service.update({ where: { id: serviceId }, data: { status: status as any, lastLatencyMs: latencyMs, lastCheckedAt: new Date(), consecutiveFails: fails } });
    this.events.emit(svc.organizationId, { type: 'service.health', serviceId, ok, status });

    // Deduplicated incident: one open DOWN incident per service.
    if (!ok && fails === threshold) {
      const dedupKey = `health:${serviceId}`;
      const existing = await this.prisma.incident.findUnique({ where: { organizationId_dedupKey: { organizationId: svc.organizationId, dedupKey } } });
      if (!existing || existing.status === 'RESOLVED') {
        const inc = await this.prisma.incident.upsert({
          where: { organizationId_dedupKey: { organizationId: svc.organizationId, dedupKey } },
          create: {
            organizationId: svc.organizationId, serviceId, dedupKey,
            title: `${svc.name} is DOWN (${error ?? 'health check failed'})`.slice(0, 200),
            description: `Health check ${svc.healthCheckUrl} failed ${fails} consecutive times. Last error: ${error ?? 'unknown'}`,
            severity: 'HIGH', status: 'OPEN',
          },
          update: { status: 'REOPENED', title: `${svc.name} is DOWN again`.slice(0, 200) },
        });
        await this.prisma.incidentActivity.create({ data: { incidentId: inc.id, action: 'auto-created', detail: `health-check failure (${error})` } });
        this.events.emit(svc.organizationId, { type: 'incident.created', incidentId: inc.id });
      }
    }
    if (ok && svc.status === 'DOWN') {
      // Auto-resolve DOWN incidents when service recovers? Keep manual: just emit recovery.
      this.events.emit(svc.organizationId, { type: 'service.recovered', serviceId });
    }
  }
}
