import { LiveV2AccessGuard } from './live-v2-access.guard';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { CallModule } from '../call/call.module';

import { LiveController } from './live.controller';
import { LiveGateway } from './live.gateway';
import { LiveService } from './live.service';
import { LiveV2Service } from './live-v2.service';
import { LiveV2Controller } from './live-v2.controller';
import { LiveV2Events } from './live-v2.events';
import { LiveV2Gateway } from './live-v2.gateway';
import { LiveV2Worker } from './live-v2.worker';

@Module({
  imports: [PrismaModule, SupabaseModule, CallModule],
  controllers: [LiveV2Controller, LiveController],
  providers: [
    LiveService,
    LiveGateway,
    LiveV2Service,
    LiveV2AccessGuard,
    LiveV2Events,
    LiveV2Gateway,
    LiveV2Worker,
  ],
  exports: [LiveService],
})
export class LiveModule {}
