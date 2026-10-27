import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { OrgGuard } from '../../common/org.guard';
import { AiService } from './ai.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private ai: AiService) {}

  @Get('ai/status')
  status() {
    return this.ai.status();
  }

  @UseGuards(OrgGuard)
  @Post('incidents/:id/investigate')
  investigate(@Req() req: any, @Param('id') id: string) {
    return this.ai.investigate(req.orgId, id);
  }

  @UseGuards(OrgGuard)
  @Get('incidents/:id/investigations')
  history(@Param('id') id: string) {
    return this.ai.history(id);
  }
}
