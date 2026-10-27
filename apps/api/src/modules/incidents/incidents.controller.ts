import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { OrgGuard } from '../../common/org.guard';
import { IncidentsService } from './incidents.service';
import { AssignDto, CommentDto, CreateIncidentDto, TransitionDto } from './incidents.dto';

@Controller('incidents')
@UseGuards(JwtAuthGuard, OrgGuard)
export class IncidentsController {
  constructor(private incidents: IncidentsService) {}

  @Get()
  list(@Req() req: any, @Query() q: any) {
    return this.incidents.list(req.orgId, q);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateIncidentDto) {
    return this.incidents.create(req.orgId, req.user.id, dto);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.incidents.get(req.orgId, id);
  }

  @Put(':id/status')
  transition(@Req() req: any, @Param('id') id: string, @Body() dto: TransitionDto) {
    return this.incidents.transition(req.orgId, req.user.id, id, dto.status);
  }

  @Post(':id/comments')
  comment(@Req() req: any, @Param('id') id: string, @Body() dto: CommentDto) {
    return this.incidents.comment(req.orgId, req.user.id, id, dto.body);
  }

  @Post(':id/assign')
  assign(@Req() req: any, @Param('id') id: string, @Body() dto: AssignDto) {
    return this.incidents.assign(req.orgId, req.user.id, id, dto.userId);
  }

  @Delete(':id/assign/:userId')
  unassign(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.incidents.unassign(req.orgId, req.user.id, id, userId);
  }
}
