import { Controller, Get } from '@nestjs/common';
import { QueueService } from '../../queues/queue.service';
import { PrismaService } from '../../common/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private queues: QueueService, private prisma: PrismaService) {}

  @Get()
  async health() {
    let db = 'unknown';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return { ok: db === 'up', db, queue: this.queues.status(), time: new Date().toISOString() };
  }
}
