import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';

import { LiveService } from './live.service';

@Controller('live')
export class LiveController {
  constructor(private readonly liveService: LiveService) {}

  @Get()
  getLiveSessions() {
    return this.liveService.listLive();
  }

  @Post('start')
  @UseGuards(SupabaseAuthGuard)
  start(@CurrentUser() user: JWTPayload, @Body() body: { title?: string }) {
    return this.liveService.startLive(user.sub as string, body?.title);
  }

  @Post(':id/end')
  @UseGuards(SupabaseAuthGuard)
  end(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.liveService.endLive(user.sub as string, id);
  }

  @Post(':id/join')
  @UseGuards(SupabaseAuthGuard)
  join(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.liveService.joinLive(user.sub as string, id);
  }

  @Post(':id/leave')
  @UseGuards(SupabaseAuthGuard)
  leave(@CurrentUser() user: JWTPayload, @Param('id') id: string) {
    return this.liveService.leaveLive(user.sub as string, id);
  }
}
