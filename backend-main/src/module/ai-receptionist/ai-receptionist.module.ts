import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AiReceptionistController } from './ai-receptionist.controller';
import { AiReceptionistService } from './ai-receptionist.service';
import { AI_RECEPTIONIST_PROVIDER } from './providers/ai-receptionist-provider.interface';
import { MockAiReceptionistProvider } from './providers/mock-ai-receptionist.provider';

@Module({
  imports: [PrismaModule],
  controllers: [AiReceptionistController],
  providers: [
    AiReceptionistService,
    MockAiReceptionistProvider,
    {
      provide: AI_RECEPTIONIST_PROVIDER,
      useExisting: MockAiReceptionistProvider,
    },
  ],
  exports: [AiReceptionistService],
})
export class AiReceptionistModule {}
