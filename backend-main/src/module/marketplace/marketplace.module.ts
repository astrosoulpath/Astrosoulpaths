import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

import { MarketplaceController } from './marketplace.controller';
import { MarketplaceSellerController } from './marketplace-seller.controller';
import { MarketplaceAdminController } from './marketplace-admin.controller';
import { MarketplaceCustomerController } from './marketplace-customer.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceCaseService } from './marketplace-case.service';
import { MarketplaceWriteGuard } from './marketplace-write.guard';
import { MarketplacePaymentsService } from './marketplace-payments.service';

@Module({
  imports: [PrismaModule, SupabaseModule],

  controllers: [
    MarketplaceController,
    MarketplaceSellerController,
    MarketplaceCustomerController,
    MarketplaceAdminController,
  ],

  providers: [MarketplaceService, MarketplaceCaseService, MarketplaceWriteGuard, MarketplacePaymentsService],

  exports: [MarketplaceService],
})
export class MarketplaceModule {}
