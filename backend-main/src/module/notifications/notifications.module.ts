import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { NotificationsIdentityGuard } from './notifications-identity.guard';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsCampaignService } from './notifications.campaign.service';
import { NotificationsPushService } from './notifications.push.service';
import { NotificationsService } from './notifications.service';
import { SmartEngagementPushProcessor } from './smart-engagement-push.processor';
import { SmartNotificationsService } from './smart-notifications.service';
import { SmartNotificationsWorker } from './smart-notifications.worker';
import { SmartAstrologyWorker } from './smart-astrology.worker';
import { SmartCampaignController, SmartInsightController, SmartPolicyController } from './smart-notifications.controller';
import { SmartPolicyService } from './smart-policy.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [NotificationsController, SmartCampaignController, SmartInsightController, SmartPolicyController],
  providers: [
    NotificationsIdentityGuard,
    NotificationsService,
    NotificationsPushService,
    NotificationsCampaignService,
    SmartEngagementPushProcessor,
    SmartNotificationsService,
    SmartNotificationsWorker,
    SmartAstrologyWorker,
    SmartPolicyService,
  ],
  exports: [
    NotificationsService,
    NotificationsPushService,
    NotificationsCampaignService,
  ],
})
export class NotificationsModule {}

