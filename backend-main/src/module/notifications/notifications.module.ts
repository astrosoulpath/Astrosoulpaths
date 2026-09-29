import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsCampaignService } from './notifications.campaign.service';
import { NotificationsPushService } from './notifications.push.service';
import { NotificationsService } from './notifications.service';
import { SmartEngagementPushProcessor } from './smart-engagement-push.processor';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsPushService,
    NotificationsCampaignService,
    SmartEngagementPushProcessor,
  ],
  exports: [
    NotificationsService,
    NotificationsPushService,
    NotificationsCampaignService,
  ],
})
export class NotificationsModule {}

