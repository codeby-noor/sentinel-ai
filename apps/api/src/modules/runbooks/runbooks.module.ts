import { Module } from '@nestjs/common';
import { RunbooksController } from './runbooks.controller';
import { RunbooksService } from './runbooks.service';

@Module({ controllers: [RunbooksController], providers: [RunbooksService], exports: [RunbooksService] })
export class RunbooksModule {}
