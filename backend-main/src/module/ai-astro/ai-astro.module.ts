import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AstroModule } from '../astro/astro.module';
import { KundliModule } from '../kundli/kundli.module';

import { AiAstroAdminController } from './ai-astro-admin.controller';
import { AiAstroController } from './ai-astro.controller';
import { AiAstroService } from './ai-astro.service';
import { AiAstroExpiryProcessor } from './ai-astro-expiry.processor';
import { AI_ASTRO_PROVIDER } from './providers/ai-astro-provider.interface';
import { OpenAiAstroProvider } from './providers/openai-astro.provider';

@Module({
  imports: [PrismaModule, KundliModule, AstroModule],
  controllers: [AiAstroController, AiAstroAdminController],
  providers: [
    AiAstroService,
    OpenAiAstroProvider,
    {
      provide: AI_ASTRO_PROVIDER,
      useExisting: OpenAiAstroProvider,
    },
    AiAstroExpiryProcessor,
  ],
  exports: [AiAstroService],
})
export class AiAstroModule {}
