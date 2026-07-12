import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { SupabaseModule } from './infrastructure/supabase/supabase.module';
import { RedisModule } from './infrastructure/redis/redis.module';

import { envValidationSchema } from './config/env.validation';
import supabaseConfig from './config/supabase.config';
import { createBullMQRootConfig } from './infrastructure/bullmq/bullmq.config';

import { AuthModule } from './module/auth/auth.module';
import { UserModule } from './module/user/user.module';
import { ProfileModule } from './module/profile/profile.module';
import { AstrologerModule } from './module/astrologer/astrologer.module';
import { AstroModule } from './module/astro/astro.module';
import { DashaModule } from './module/astro/modules/dasha/dasha.module';
import { KundliModule } from './module/kundli/kundli.module';
import { QueueModule } from './module/queue/queue.module';
import { CacheModule } from './module/cache/cache.module';
import { CacheService } from './module/cache/cache.service';
import { HealthModule } from './module/health/health.module';
import { MatchModule } from './module/astro/modules/match/match.module';
import { DailyinsightModule } from './module/astro/modules/dailyinsight/dailyinsight.module';
import { PaymentsModule } from './module/payments/payments.module';
import { CallModule } from './module/call/call.module';
import { AdminModule } from './module/admin/admin.module';
import { WalletModule } from './module/wallet/wallet.module';
import { SubscriptionModule } from './module/subscription/subscription.module';

// ✅ NEW
import { ChatModule } from './module/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      load: [supabaseConfig],
    }),

    BullModule.forRoot(createBullMQRootConfig()),

    PrismaModule,
    SupabaseModule,
    RedisModule,

    AuthModule,
    UserModule,
    ProfileModule,
    AstrologerModule,
    AstroModule,
    DashaModule,
    KundliModule,
    QueueModule,
    CacheModule,
    HealthModule,
    MatchModule,
    DailyinsightModule,
    PaymentsModule,
    CallModule,
    AdminModule,
    WalletModule,
    SubscriptionModule,

    // ✅ Chat Module
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService, CacheService],
})
export class AppModule {}