import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

import { AgoraService } from './agora.service';
import { CallController } from './call.controller';
import { CallGateway } from './call.gateway';
import { CallSocketService } from './call-socket.service';
import { CallService } from './call.service';

@Module({
  imports: [
    PrismaModule,
    SupabaseModule,
  ],
  controllers: [
    CallController,
  ],
  providers: [
    CallService,
    AgoraService,
    CallSocketService,
    CallGateway,
  ],
  exports: [
    CallService,
    AgoraService,
    CallSocketService,
  ],
})
export class CallModule {}