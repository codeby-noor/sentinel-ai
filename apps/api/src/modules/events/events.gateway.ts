import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma.service';
import { EventsService } from './events.service';

@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true } })
export class EventsGateway {
  @WebSocketServer() server!: Server;
  private unsubs = new Map<string, () => void>();

  constructor(private jwt: JwtService, private prisma: PrismaService, private events: EventsService) {}

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { token?: string; orgId?: string }) {
    try {
      if (!body?.token || !body?.orgId) return { ok: false, error: 'unauthorized' };
      const payload = await this.jwt.verifyAsync(body.token);
      const orgId: string = body.orgId;
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || (payload.sv ?? 0) !== (user as any).sessionVersion) return { ok: false, error: 'unauthorized' };
      const m = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId: payload.sub, organizationId: orgId } } });
      if (!m) return { ok: false, error: 'forbidden' };
      this.unsubs.get(client.id)?.();
      const unsub = this.events.subscribe(orgId, (e) => client.emit(e.type, e));
      this.unsubs.set(client.id, unsub);
      client.join(`org:${orgId}`);
      return { ok: true };
    } catch {
      return { ok: false, error: 'unauthorized' };
    }
  }

  handleDisconnect(client: Socket) {
    this.unsubs.get(client.id)?.();
    this.unsubs.delete(client.id);
  }
}
