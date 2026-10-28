import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private shouldSkipDatabaseConnect(): boolean {
    const databaseUrl = (process.env.DATABASE_URL ?? '').trim();

    if (process.env.SKIP_DB_CONNECT === '1') return true;
    if (!databaseUrl) return true;

    return (
      databaseUrl.includes('*') ||
      /placeholder|change-me|example/i.test(databaseUrl)
    );
  }

  async onModuleInit() {
    // Avoid connecting during builds/typechecks when the environment is intentionally unset
    // or filled with a placeholder value instead of a real Postgres connection string.
    if (this.shouldSkipDatabaseConnect()) return;

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
