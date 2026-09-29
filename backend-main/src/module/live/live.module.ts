import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { CallModule } from '../call/call.module';

import { LiveController } from './live.controller';
import { LiveGateway } from './live.gateway';
import { LiveService } from './live.service';

@Module({
  imports: [PrismaModule, SupabaseModule, CallModule],
  controllers: [LiveController],
  providers: [LiveService, LiveGateway],
  exports: [LiveService],
})
export class LiveModule {}
