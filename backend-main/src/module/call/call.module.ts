import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

import { CallController } from './call.controller';
import { CallService } from './call.service';
import { AgoraService } from './agora.service';

@Module({
  imports: [
    PrismaModule,
    SupabaseModule,
  ],
  providers: [
    CallService,
    AgoraService,
  ],
  controllers: [
    CallController,
  ],
  exports: [
    CallService,
    AgoraService,
  ],
})
export class CallModule {}