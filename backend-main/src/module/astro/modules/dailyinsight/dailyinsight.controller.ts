import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';

import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../../../common/guards/supabase-auth.guard';
import {
  DailyInsightDay,
  NakshatraDailyInsightService,
} from './dailyinsight.service';

@Controller('dailyinsight')
@UseGuards(SupabaseAuthGuard)
export class DailyinsightController {
  constructor(
    private readonly dailyInsightService: NakshatraDailyInsightService,
  ) {}

  @Get('history')
  getDailyHoroscopeHistory(
    @CurrentUser() user: JWTPayload,
    @Query('limit') limit?: string,
  ) {
    const normalizedLimit = limit === undefined ? 30 : Number(limit);

    if (
      !Number.isInteger(normalizedLimit) ||
      normalizedLimit < 1 ||
      normalizedLimit > 90
    ) {
      throw new BadRequestException('limit must be between 1 and 90');
    }

    return this.dailyInsightService.getDailyHoroscopeHistory(
      user.sub as string,
      normalizedLimit,
    );
  }
  @Get()
  getDailyInsight(@CurrentUser() user: JWTPayload, @Query('day') day?: string) {
    const normalizedDay = (day ?? 'today').trim().toLowerCase();

    if (!['yesterday', 'today', 'tomorrow'].includes(normalizedDay)) {
      throw new BadRequestException(
        'day must be yesterday, today, or tomorrow',
      );
    }

    return this.dailyInsightService.getNakshatraDailyInsight(
      user.sub as string,
      normalizedDay as DailyInsightDay,
    );
  }
}
