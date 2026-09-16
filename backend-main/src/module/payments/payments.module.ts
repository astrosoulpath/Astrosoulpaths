import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { KundliModule } from '../kundli/kundli.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RazorpayVerificationService } from './razorpay-verification.service';
import { FxRateService } from './pricing/fx-rate.service';
import { LocalizedPricingService } from './pricing/localized-pricing.service';

@Module({
  imports: [PrismaModule, KundliModule, MarketplaceModule],
  providers: [
    PaymentsService,
    RazorpayVerificationService,
    FxRateService,
    LocalizedPricingService,
  ],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
