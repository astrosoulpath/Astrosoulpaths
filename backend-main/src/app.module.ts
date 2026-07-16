import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { envValidationSchema } from './config/env.validation';
import supabaseConfig from './config/supabase.config';

import { createBullMQRootConfig } from './infrastructure/bullmq/bullmq.config';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { SupabaseModule } from './infrastructure/supabase/supabase.module';

import { AdminModule } from './module/admin/admin.module';
import { AstrologerModule } from './module/astrologer/astrologer.module';
import { AstroModule } from './module/astro/astro.module';
import { DailyinsightModule } from './module/astro/modules/dailyinsight/dailyinsight.module';
import { DashaModule } from './module/astro/modules/dasha/dasha.module';
import { MatchModule } from './module/astro/modules/match/match.module';
import { AuthModule } from './module/auth/auth.module';
import { AvailabilityModule } from './module/availability/availability.module';
import { CacheModule } from './module/cache/cache.module';
import { CacheService } from './module/cache/cache.service';
import { CallModule } from './module/call/call.module';
import { ChatModule } from './module/chat/chat.module';
import { ConsultationModule } from './module/consultation/consultation.module';
import { DashboardModule } from './module/dashboard/dashboard.module';
import { HealthModule } from './module/health/health.module';
import { KundliModule } from './module/kundli/kundli.module';
import { PaymentsModule } from './module/payments/payments.module';
import { ProfileModule } from './module/profile/profile.module';
import { QueueModule } from './module/queue/queue.module';
import { ReviewModule } from './module/review/review.module';
import { SubscriptionModule } from './module/subscription/subscription.module';
import { UserModule } from './module/user/user.module';
import { WalletModule } from './module/wallet/wallet.module';

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
    ConsultationModule,
    AdminModule,
    WalletModule,
    SubscriptionModule,
    ChatModule,
    DashboardModule,
    ReviewModule,
    AvailabilityModule,
  ],

  controllers: [AppController],

  providers: [AppService, CacheService],
})
export class AppModule {}