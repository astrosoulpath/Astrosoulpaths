import { LiveV2AccessGuard } from './live-v2-access.guard';
import {
  Body,
  Controller,
  Get,
  Param,
  Query,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { LiveV2Service } from './live-v2.service';
import {
  LiveCreateDto,
  LiveDiscoveryDto,
  LiveStartDto,
  LiveProofDto,
  LiveResumeDto,
  LiveEndDto,
} from './live-v2.dto';

@Controller('live/v2')
@UseGuards(SupabaseAuthGuard, LiveV2AccessGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class LiveV2Controller {
  constructor(private readonly live: LiveV2Service) {}

  @Get()
  discover(@CurrentUser() actor: JWTPayload, @Query() query: LiveDiscoveryDto) {
    return this.live.discover(actor, query);
  }

  @Post('start')
  start(@CurrentUser() actor: JWTPayload, @Body() body: LiveStartDto) {
    return this.live.start(actor, body);
  }
  @Post(':id/join')
  join(
    @CurrentUser() actor: JWTPayload,
    @Param('id') id: string,
    @Body() body: LiveCreateDto,
  ) {
    return this.live.join(actor, id, body);
  }
  @Post(':id/connections/:cid/renew')
  renew(
    @CurrentUser() actor: JWTPayload,
    @Param('id') id: string,
    @Param('cid') cid: string,
    @Body() body: LiveProofDto,
  ) {
    return this.live.operate(actor, id, cid, 'renew', body);
  }
  @Post(':id/connections/:cid/resume')
  resume(
    @CurrentUser() actor: JWTPayload,
    @Param('id') id: string,
    @Param('cid') cid: string,
    @Body() body: LiveResumeDto,
  ) {
    return this.live.operate(actor, id, cid, 'resume', body);
  }
  @Post(':id/connections/:cid/heartbeat')
  heartbeat(
    @CurrentUser() actor: JWTPayload,
    @Param('id') id: string,
    @Param('cid') cid: string,
    @Body() body: LiveProofDto,
  ) {
    return this.live.operate(actor, id, cid, 'heartbeat', body);
  }
  @Post(':id/connections/:cid/leave')
  leave(
    @CurrentUser() actor: JWTPayload,
    @Param('id') id: string,
    @Param('cid') cid: string,
    @Body() body: LiveProofDto,
  ) {
    return this.live.operate(actor, id, cid, 'leave', body);
  }
  @Post(':id/end')
  end(
    @CurrentUser() actor: JWTPayload,
    @Param('id') id: string,
    @Body() body: LiveEndDto,
  ) {
    return this.live.operate(actor, id, body.connectionId, 'end', body);
  }
  @Get(':id/status')
  status(@CurrentUser() actor: JWTPayload, @Param('id') id: string) {
    return this.live.status(actor, id);
  }
}
