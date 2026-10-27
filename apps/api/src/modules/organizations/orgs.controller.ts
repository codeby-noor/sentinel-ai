import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/current-user';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { OrgGuard } from '../../common/org.guard';
import { OrgsService } from './orgs.service';
import { CreateOrgDto, InviteDto, UpdateMemberDto, UpdateOrgDto } from './orgs.dto';

@Controller('orgs')
@UseGuards(JwtAuthGuard)
export class OrgsController {
  constructor(private orgs: OrgsService) {}

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateOrgDto) {
    return this.orgs.create(u.id, dto.name);
  }

  @UseGuards(OrgGuard)
  @Get(':id/members')
  members(@Param('id') id: string) {
    return this.orgs.members(id);
  }

  @UseGuards(OrgGuard)
  @Post(':id/members')
  invite(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body() dto: InviteDto) {
    return this.orgs.invite(id, u.id, dto.email, dto.role);
  }

  @UseGuards(OrgGuard)
  @Patch(':id/members/:userId')
  updateMember(@Param('id') id: string, @Param('userId') userId: string, @CurrentUser() u: AuthUser, @Body() dto: UpdateMemberDto) {
    return this.orgs.updateMember(id, u.id, userId, dto.role);
  }

  @UseGuards(OrgGuard)
  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string, @CurrentUser() u: AuthUser) {
    return this.orgs.removeMember(id, u.id, userId);
  }

  @UseGuards(OrgGuard)
  @Patch(':id')
  updateOrg(@Param('id') id: string, @Body() dto: UpdateOrgDto) {
    return this.orgs.update(id, dto.name);
  }
}
