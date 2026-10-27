import { Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { EventsModule } from '../events/events.module';

@Module({ imports: [EventsModule], controllers: [IncidentsController], providers: [IncidentsService], exports: [IncidentsService] })
export class IncidentsModule {}
