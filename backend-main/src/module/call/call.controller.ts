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
import { GenerateCallTokenDto } from './dto/generate-call-token.dto';
import { StartCallDto } from './dto/start-call.dto';

@Controller('call')
@UseGuards(SupabaseAuthGuard)
export class CallController {
  constructor(
    private readonly callService: CallService,
  ) {}

  /**
   * Creates a new call record.
   *
   * POST /call/start
   */
  @Post('start')
  startCall(
    @CurrentUser() user: JWTPayload,
    @Body() dto: StartCallDto,
  ) {
    const userId = this.getCurrentUserId(user);

    return this.callService.startCall(
      userId,
      dto,
    );
  }

  /**
   * Generates an Agora token for a call participant.
   *
   * POST /call/token
   */
  @Post('token')
  generateToken(
    @CurrentUser() user: JWTPayload,
    @Body() dto: GenerateCallTokenDto,
  ) {
    const userId = this.getCurrentUserId(user);

    return this.callService.generateAgoraToken(
      userId,
      dto.callId,
    );
  }

  /**
   * Ends an active call.
   *
   * POST /call/:id/end
   */
  @Post(':id/end')
  endCall(
    @CurrentUser() user: JWTPayload,
    @Param('id') callId: string,
    @Body() dto: EndCallDto,
  ) {
    const userId = this.getCurrentUserId(user);

    return this.callService.endCall(
      userId,
      callId,
      dto,
    );
  }

  /**
   * Returns the authenticated user's current active call.
   *
   * GET /call/current
   */
  @Get('current')
  getCurrentCall(
    @CurrentUser() user: JWTPayload,
  ) {
    const userId = this.getCurrentUserId(user);

    return this.callService.getCurrentCall(
      userId,
    );
  }

  /**
   * Returns the authenticated user's call history.
   *
   * GET /call/history
   */
  @Get('history')
  getCallHistory(
    @CurrentUser() user: JWTPayload,
  ) {
    const userId = this.getCurrentUserId(user);

    return this.callService.getCallHistory(
      userId,
    );
  }

  private getCurrentUserId(
    user: JWTPayload,
  ): string {
    const userId =
      typeof user?.sub === 'string'
        ? user.sub.trim()
        : '';

    if (!userId) {
      throw new Error(
        'Authenticated user ID is missing.',
      );
    }

    return userId;
  }
}