import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { OrgGuard } from '../../common/org.guard';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './services.dto';

@Controller('services')
@UseGuards(JwtAuthGuard, OrgGuard)
export class ServicesController {
  constructor(private services: ServicesService) {}

  @Get()
  list(@Req() req: any, @Query('includeArchived') inc?: string) {
    return this.services.list(req.orgId, inc === 'true');
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateServiceDto) {
    return this.services.create(req.orgId, req.user.id, dto);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.services.get(req.orgId, id);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(req.orgId, id, dto);
  }

  @Post(':id/archive')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.services.archive(req.orgId, id);
  }
}
