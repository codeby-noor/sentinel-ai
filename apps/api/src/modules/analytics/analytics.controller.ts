import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { OrgGuard } from '../../common/org.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, OrgGuard)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('overview')
  overview(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.overview(req.orgId, from, to);
  }

  @Get('dashboard')
  dashboard(@Req() req: any) {
    return this.analytics.dashboard(req.orgId);
  }
}
