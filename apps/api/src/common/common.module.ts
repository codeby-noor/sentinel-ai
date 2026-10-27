import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OrgGuard } from './org.guard';
import { RateLimitService } from './rate-limit.service';

/** Shared infrastructure providers available to every feature module. */
@Global()
@Module({
  providers: [PrismaService, JwtAuthGuard, OrgGuard, RateLimitService],
  exports: [PrismaService, JwtAuthGuard, OrgGuard, RateLimitService],
})
export class CommonModule {}
