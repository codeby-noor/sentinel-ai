import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { EventsService } from './events.service';
import { PrismaService } from '../../common/prisma.service';

@Controller('events')
export class EventsController {
  constructor(private events: EventsService, private prisma: PrismaService) {}

  /** Server-Sent Events stream. Auth via cookie; org via ?orgId=. */
  @UseGuards(JwtAuthGuard)
  @Get('stream')
  async stream(@Req() req: any, @Res() res: Response, @Query('orgId') orgId: string) {
    const member = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId: req.user.id, organizationId: orgId } } });
    if (!member) {
      res.status(403).json({ message: 'Not a member of this organization' });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    const handler = (e: any) => res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
    const unsub = this.events.subscribe(orgId, handler);
    const keep = setInterval(() => res.write(`: ping\n\n`), 25000);
    req.on('close', () => { clearInterval(keep); unsub(); });
  }
}
