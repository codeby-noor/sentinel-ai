import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PrismaService } from '../../common/prisma.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  list(@Req() req: any) {
    return this.prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  @Post(':id/read')
  read(@Req() req: any, @Param('id') id: string) {
    return this.prisma.notification.updateMany({ where: { id, userId: req.user.id }, data: { readAt: new Date() } });
  }

  @Post('read-all')
  readAll(@Req() req: any) {
    return this.prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  }
}
