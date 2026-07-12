import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CallService } from './call.service';
import { EndCallDto } from './dto/end-call.dto';
import { StartCallDto } from './dto/start-call.dto';

@Controller('call')
@UseGuards(SupabaseAuthGuard)
export class CallController {
  constructor(
    private readonly callService: CallService,
  ) {}

  @Post('start')
  startCall(
    @CurrentUser() user: JWTPayload,
    @Body() dto: StartCallDto,
  ) {
    return this.callService.startCall(
      user.sub as string,
      dto,
    );
  }

  // ✅ NEW: Generate Agora Token
  @Post('token')
  generateToken(
    @CurrentUser() user: JWTPayload,
    @Body()
    body: {
      callId: string;
    },
  ) {
    return this.callService.generateAgoraToken(
      user.sub as string,
      body.callId,
    );
  }

  @Post(':id/end')
  endCall(
    @CurrentUser() user: JWTPayload,
    @Param('id') callId: string,
    @Body() dto: EndCallDto,
  ) {
    return this.callService.endCall(
      user.sub as string,
      callId,
      dto,
    );
  }

  @Get('current')
  getCurrentCall(
    @CurrentUser() user: JWTPayload,
  ) {
    return this.callService.getCurrentCall(
      user.sub as string,
    );
  }

  @Get('history')
  getCallHistory(
    @CurrentUser() user: JWTPayload,
  ) {
    return this.callService.getCallHistory(
      user.sub as string,
    );
  }
}