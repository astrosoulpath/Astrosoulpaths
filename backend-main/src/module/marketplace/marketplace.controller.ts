import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { MarketplaceService } from './marketplace.service';
import { marketplacePage } from './marketplace-policy';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Public()
  @Get('capabilities')
  getCapabilities() {
    return { success: true, data: {
      settlementCurrencies: ['INR'], deliveryCountries: ['IN'],
      paidCheckoutEnabled: process.env.MARKETPLACE_LIVE_PAYMENTS_ENABLED === 'true' && process.env.MARKETPLACE_PAID_CHECKOUT_APPROVED === 'true',
      payoutRequestsEnabled: process.env.MARKETPLACE_PAYOUT_REQUESTS_ENABLED === 'true',
      caseReviewEnabled: process.env.MARKETPLACE_CASES_ENABLED === 'true',
      providerRefundsEnabled: false, internationalDeliveryEnabled: false,
    } };
  }

  @Public()
  @Get('categories')
  getCategories() {
    return this.marketplaceService.getPublicCategories();
  }

  @Public()
  @Get('products')
  getProducts(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('featured') featured?: string,
    @Query('countryCode') countryCode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const featuredValue =
      featured === undefined ? undefined : featured === 'true';

    return this.marketplaceService.getPublicProducts(
      search,
      categoryId,
      featuredValue,
      countryCode,
      page !== undefined || limit !== undefined ? marketplacePage(page, limit) : undefined,
    );
  }

  @Public()
  @Get('products/:id')
  getProduct(
    @Param('id') id: string,
    @Query('countryCode') countryCode?: string,
  ) {
    return this.marketplaceService.getPublicProductById(id, countryCode);
  }

  @Public()
  @Get('campaigns')
  getCampaigns() {
    return this.marketplaceService.getPublicCampaigns();
  }
}
