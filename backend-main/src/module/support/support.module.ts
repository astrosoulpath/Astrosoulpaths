import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { SupportController } from './support.controller';
import { SupportAdminController } from './support-admin.controller';
import { SupportAssistantController } from './support-assistant.controller';
import { SupportService } from './support.service';
import { SupportAttachmentService } from './support-attachment.service';
import { SupportAdminService } from './support-admin.service';
import { SupportAssistantService } from './support-assistant.service';
import { SUPPORT_AI_PROVIDER } from './providers/support-ai-provider.interface';
import { OpenAiSupportProvider } from './providers/openai-support.provider';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [
    SupportController,
    SupportAdminController,
    SupportAssistantController,
  ],
  providers: [
    SupportAttachmentService,
    SupportService,
    SupportAdminService,
    SupportAssistantService,
    OpenAiSupportProvider,
    {
      provide: SUPPORT_AI_PROVIDER,
      useExisting: OpenAiSupportProvider,
    },
  ],
  exports: [
    SupportAttachmentService,
    SupportService,
    SupportAdminService,
    SupportAssistantService,
  ],
})
export class SupportModule {}
