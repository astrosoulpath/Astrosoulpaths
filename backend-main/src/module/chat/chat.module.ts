import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

import { ChatUploadController } from './upload/chat-upload.controller';
import { ChatUploadService } from './upload/chat-upload.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    SupabaseModule,
  ],

  controllers: [
    ChatController,
    ChatUploadController,
  ],

  providers: [
    ChatService,
    ChatGateway,
    ChatUploadService,
  ],

  exports: [
    ChatService,
    ChatUploadService,
  ],
})
export class ChatModule {}