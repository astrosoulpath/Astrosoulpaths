import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

import { ConsultationController } from './consultation.controller';
import { ConsultationRepository } from './consultation.repository';
import { ConsultationService } from './consultation.service';

@Module({
  imports: [PrismaModule],
  controllers: [ConsultationController],
  providers: [ConsultationRepository, ConsultationService],
  exports: [ConsultationService],
})
export class ConsultationModule {}