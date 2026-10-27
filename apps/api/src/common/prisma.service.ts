import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Avoid connecting during build/typecheck when DATABASE_URL is a placeholder.
    if (process.env.SKIP_DB_CONNECT === '1') return;
    try {
      await this.$connect();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[prisma] could not connect at startup, will retry on demand:', (err as Error).message);
    }
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
