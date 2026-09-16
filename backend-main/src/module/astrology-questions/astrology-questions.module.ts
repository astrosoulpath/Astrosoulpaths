import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { KundliModule } from '../kundli/kundli.module';
import { AstrologyAiService } from './astrology-ai.service';
import { AstrologyQuestionsController } from './astrology-questions.controller';
import { AstrologyQuestionsService } from './astrology-questions.service';

@Module({
  imports: [PrismaModule, KundliModule],
  controllers: [AstrologyQuestionsController],
  providers: [AstrologyQuestionsService, AstrologyAiService],
})
export class AstrologyQuestionsModule {}
