import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsController } from './events.controller';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [EventsController],
  providers: [EventsService, EventsGateway],
  exports: [EventsService],
})
export class EventsModule {}
