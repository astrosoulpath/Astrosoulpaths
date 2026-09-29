import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { FollowService } from './follow.service';

@Controller('follow')
@UseGuards(SupabaseAuthGuard)
export class FollowController {
  constructor(private readonly service: FollowService) {}

  private sub(user: JWTPayload): string {
    const value = typeof user?.sub === 'string' ? user.sub.trim() : '';

    if (!value) {
      throw new UnauthorizedException('Authenticated customer is required');
    }

    return value;
  }

  @Get('astrologers/:astrologerId')
  realStatus(
    @CurrentUser() user: JWTPayload,
    @Param('astrologerId') astrologerId: string,
  ) {
    return this.service.realStatus(this.sub(user), astrologerId);
  }

  @Post('astrologers/:astrologerId')
  followReal(
    @CurrentUser() user: JWTPayload,
    @Param('astrologerId') astrologerId: string,
  ) {
    return this.service.followReal(this.sub(user), astrologerId);
  }

  @Delete('astrologers/:astrologerId')
  unfollowReal(
    @CurrentUser() user: JWTPayload,
    @Param('astrologerId') astrologerId: string,
  ) {
    return this.service.unfollowReal(this.sub(user), astrologerId);
  }

  @Get('ai/:personaId')
  aiStatus(
    @CurrentUser() user: JWTPayload,
    @Param('personaId') personaId: string,
  ) {
    return this.service.aiStatus(this.sub(user), personaId);
  }

  @Post('ai/:personaId')
  followAi(
    @CurrentUser() user: JWTPayload,
    @Param('personaId') personaId: string,
  ) {
    return this.service.followAi(this.sub(user), personaId);
  }

  @Delete('ai/:personaId')
  unfollowAi(
    @CurrentUser() user: JWTPayload,
    @Param('personaId') personaId: string,
  ) {
    return this.service.unfollowAi(this.sub(user), personaId);
  }
}
