import { forwardRef, Module } from '@nestjs/common';
import { RedisModule } from '../../../../infrastructure/redis/redis.module';
import { AstroCoreModule } from '../../core/astro-core/astro-core.module';
import { NotificationsModule } from '../../../notifications/notifications.module';
import { NakshatraDailyInsightService } from './dailyinsight.service';
import { DailyinsightController } from './dailyinsight.controller';
import { DailyHoroscopeAiService } from './daily-horoscope-ai.service';
import { DailyHoroscopePushProcessor } from './daily-horoscope-push.processor';
import { KundliModule } from '../../../kundli/kundli.module';
@Module({
  imports: [NotificationsModule, RedisModule, AstroCoreModule, forwardRef(() => KundliModule)],
  providers: [
    NakshatraDailyInsightService,
    DailyHoroscopeAiService,
    DailyHoroscopePushProcessor,
  ],
  controllers: [DailyinsightController],
})
export class DailyinsightModule {}




