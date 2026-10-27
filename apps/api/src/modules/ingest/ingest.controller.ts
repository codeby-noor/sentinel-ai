import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards, Headers, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { OrgGuard } from '../../common/org.guard';
import { IngestService } from './ingest.service';
import { CreateApiKeyDto } from './ingest.dto';

@Controller()
export class IngestController {
  constructor(private ingestService: IngestService) {}

  // ---- Management (session + org scoped) ----
  @UseGuards(JwtAuthGuard, OrgGuard)
  @Post('api-keys')
  createKey(@Req() req: any, @Body() dto: CreateApiKeyDto) {
    return this.ingestService.createApiKey(req.orgId, dto.name);
  }

  @UseGuards(JwtAuthGuard, OrgGuard)
  @Get('api-keys')
  listKeys(@Req() req: any) {
    return this.ingestService.listApiKeys(req.orgId);
  }

  @UseGuards(JwtAuthGuard, OrgGuard)
  @Delete('api-keys/:id')
  revoke(@Req() req: any, @Param('id') id: string) {
    return this.ingestService.revokeApiKey(req.orgId, id);
  }

  @UseGuards(JwtAuthGuard, OrgGuard)
  @Get('logs')
  query(@Req() req: any, @Query() q: any) {
    return this.ingestService.query(req.orgId, q);
  }

  @UseGuards(JwtAuthGuard, OrgGuard)
  @Get('logs/:id')
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.ingestService.getOne(req.orgId, id);
  }

  // ---- Ingestion (API-key auth, no session) ----
  @Post('ingest/events')
  async ingestEvent(@Headers('x-api-key') key: string, @Body() dto: any) {
    if (!key) throw new UnauthorizedException('Missing X-API-Key');
    const rec = await this.ingestService.resolveOrgFromKey(key);
    return this.ingestService.ingest(rec, dto);
  }
}
