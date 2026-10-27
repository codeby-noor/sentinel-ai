import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { RateLimitService } from '../../common/rate-limit.service';

@Module({ controllers: [IngestController], providers: [IngestService], exports: [IngestService] })
export class IngestModule {}
