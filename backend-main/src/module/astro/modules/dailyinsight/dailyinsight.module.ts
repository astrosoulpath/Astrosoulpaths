import { Module } from '@nestjs/common';
import { NakshatraDailyInsightService } from './dailyinsight.service';
import { DailyinsightController } from './dailyinsight.controller';
import { AstrologyProvider } from '../provider/astrologyapi.provider';
@Module({
  providers: [NakshatraDailyInsightService, AstrologyProvider],
  controllers: [DailyinsightController],
})
export class DailyinsightModule {}
