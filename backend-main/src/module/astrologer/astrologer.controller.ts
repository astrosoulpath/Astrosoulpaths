import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { AstrologerService } from './astrologer.service';
import { RegisterAstrologerDto } from './dto/register-astrologer.dto';

@Controller('astrologer')
export class AstrologerController {
  constructor(
    private readonly astrologerService: AstrologerService,
  ) {}

  /**
   * Public marketplace endpoint.
   *
   * Examples:
   * GET /astrologer/public
   * GET /astrologer/public?language=Hindi
   * GET /astrologer/public?expertise=Marriage
   * GET /astrologer/public?online=true
   * GET /astrologer/public?search=career
   */
  @Get('public')
  getPublicAstrologers(
    @Query('search') search?: string,
    @Query('language') language?: string,
    @Query('expertise') expertise?: string,
    @Query('online') online?: string,
  ) {
    let onlineFilter: boolean | undefined;

    if (online === 'true') {
      onlineFilter = true;
    } else if (online === 'false') {
      onlineFilter = false;
    }

    return this.astrologerService.getPublicAstrologers({
      search,
      language,
      expertise,
      online: onlineFilter,
    });
  }

  @Post('register')
  @UseGuards(SupabaseAuthGuard)
  register(
    @CurrentUser() user: JWTPayload,
    @Body() dto: RegisterAstrologerDto,
  ) {
    return this.astrologerService.register(
      user.sub as string,
      dto,
    );
  }

  @Get('dashboard')
  @UseGuards(SupabaseAuthGuard)
  getDashboard(@CurrentUser() user: JWTPayload) {
    return this.astrologerService.getDashboard(
      user.sub as string,
    );
  }

  @Patch('status')
  @UseGuards(SupabaseAuthGuard)
  updateStatus(
    @CurrentUser() user: JWTPayload,
    @Body() body: { isOnline: boolean },
  ) {
    return this.astrologerService.updateStatus(
      user.sub as string,
      body.isOnline,
    );
  }
}