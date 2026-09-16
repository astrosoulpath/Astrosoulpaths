import { AstrologerPayoutWebhookController } from './astrologer-payout-webhook.controller';
import { AstrologerPayoutWebhookService } from './astrologer-payout-webhook.service';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AstrologerController } from './astrologer.controller';
import { AstrologerService } from './astrologer.service';
import { AstrologerPayoutProviderService } from './astrologer-payout-provider.service';

@Module({
  imports: [PrismaModule],
  controllers: [AstrologerController, AstrologerPayoutWebhookController],
  providers: [
    AstrologerService,
    AstrologerPayoutProviderService,
    AstrologerPayoutWebhookService,
  ],
})
export class AstrologerModule {}
