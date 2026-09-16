import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { UserModule } from '../user/user.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EarningReleaseProcessor } from './earning-release.processor';

import { ConsultationController } from './consultation.controller';
import { ConsultationRepository } from './consultation.repository';
import { ConsultationService } from './consultation.service';
import { ConsultationExpiryProcessor } from './consultation-expiry.processor';

@Module({
  imports: [PrismaModule, UserModule, ChatModule, NotificationsModule],

  controllers: [ConsultationController],

  providers: [
    ConsultationRepository,
    ConsultationService,
    ConsultationExpiryProcessor,
    EarningReleaseProcessor,
  ],

  exports: [ConsultationService],
})
export class ConsultationModule {}
