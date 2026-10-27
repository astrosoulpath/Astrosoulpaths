import { NotificationsIdentityGuard } from '../notifications/notifications-identity.guard';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { FeedbackAdminController } from './feedback-admin.controller';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [PrismaModule],
  controllers: [FeedbackController, FeedbackAdminController],
  providers: [NotificationsIdentityGuard,FeedbackService],
})
export class FeedbackModule {}
