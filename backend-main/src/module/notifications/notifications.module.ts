import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsCampaignService } from './notifications.campaign.service';
import { NotificationsPushService } from './notifications.push.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsPushService,
    NotificationsCampaignService,
  ],
  exports: [
    NotificationsService,
    NotificationsPushService,
    NotificationsCampaignService,
  ],
})
export class NotificationsModule {}
