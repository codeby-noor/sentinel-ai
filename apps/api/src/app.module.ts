import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './common/prisma.service';
import { SafeErrorFilter } from './common/safe-error.filter';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrgsModule } from './modules/organizations/orgs.module';
import { ServicesModule } from './modules/services/services.module';
import { IngestModule } from './modules/ingest/ingest.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { AiModule } from './modules/ai/ai.module';
import { RunbooksModule } from './modules/runbooks/runbooks.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { EventsModule } from './modules/events/events.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthController } from './modules/health/health.controller';
import { QueueService } from './queues/queue.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET, signOptions: { expiresIn: '7d' } }),
    CommonModule,
    AuthModule,
    OrgsModule,
    ServicesModule,
    IngestModule,
    IncidentsModule,
    AiModule,
    RunbooksModule,
    AnalyticsModule,
    EventsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    QueueService,
    { provide: APP_FILTER, useClass: SafeErrorFilter },
  ],
})
export class AppModule {}
