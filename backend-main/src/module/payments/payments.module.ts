import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ProductRefundService } from './product-refund.service';
import { KundliModule } from '../kundli/kundli.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { RazorpayVerificationService } from './razorpay-verification.service';
import { FxRateService } from './pricing/fx-rate.service';
import { LocalizedPricingService } from './pricing/localized-pricing.service';

@Module({
  imports: [PrismaModule, KundliModule, MarketplaceModule, NotificationsModule],
  providers: [
    ProductRefundService,
    PaymentsService,
    RazorpayVerificationService,
    FxRateService,
    LocalizedPricingService,
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService, ProductRefundService],
})
export class PaymentsModule {}
