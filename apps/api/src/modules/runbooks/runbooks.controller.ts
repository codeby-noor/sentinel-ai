import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { OrgGuard } from '../../common/org.guard';
import { RunbooksService } from './runbooks.service';
import { CreateRunbookDto, UpdateRunbookDto } from './runbooks.dto';

@Controller('runbooks')
@UseGuards(JwtAuthGuard, OrgGuard)
export class RunbooksController {
  constructor(private runbooks: RunbooksService) {}

  @Get() list(@Req() req: any, @Query() q: any) { return this.runbooks.list(req.orgId, q); }
  @Post() create(@Req() req: any, @Body() dto: CreateRunbookDto) { return this.runbooks.create(req.orgId, dto); }
  @Get(':id') get(@Req() req: any, @Param('id') id: string) { return this.runbooks.get(req.orgId, id); }
  @Patch(':id') update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateRunbookDto) { return this.runbooks.update(req.orgId, id, dto); }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string) { return this.runbooks.remove(req.orgId, id); }
}
