import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UnauthorizedException,
  ForbiddenException,
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

    if (user.asp_context && (user.asp_context !== 'customer' || user.asp_account_role !== 'CUSTOMER')) {
      throw new ForbiddenException('Customer context required');
    }

    return value;
  }

  @Get('astrologers/:astrologerId')
  realStatus(
    @CurrentUser() user: JWTPayload,
    @Param('astrologerId') astrologerId: string,
  ) {
    return this.service.realStatus(this.sub(user), astrologerId, user.asp_context === 'customer');
  }

  @Post('astrologers/:astrologerId')
  followReal(
    @CurrentUser() user: JWTPayload,
    @Param('astrologerId') astrologerId: string,
  ) {
    return this.service.followReal(this.sub(user), astrologerId, user.asp_context === 'customer');
  }

  @Delete('astrologers/:astrologerId')
  unfollowReal(
    @CurrentUser() user: JWTPayload,
    @Param('astrologerId') astrologerId: string,
  ) {
    return this.service.unfollowReal(this.sub(user), astrologerId, user.asp_context === 'customer');
  }

  @Get('ai/:personaId')
  aiStatus(
    @CurrentUser() user: JWTPayload,
    @Param('personaId') personaId: string,
  ) {
    return this.service.aiStatus(this.sub(user), personaId, user.asp_context === 'customer');
  }

  @Post('ai/:personaId')
  followAi(
    @CurrentUser() user: JWTPayload,
    @Param('personaId') personaId: string,
  ) {
    return this.service.followAi(this.sub(user), personaId, user.asp_context === 'customer');
  }

  @Delete('ai/:personaId')
  unfollowAi(
    @CurrentUser() user: JWTPayload,
    @Param('personaId') personaId: string,
  ) {
    return this.service.unfollowAi(this.sub(user), personaId, user.asp_context === 'customer');
  }
}
