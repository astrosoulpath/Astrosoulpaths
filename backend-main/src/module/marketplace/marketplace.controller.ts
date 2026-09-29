import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

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
  ) {
    const featuredValue =
      featured === undefined ? undefined : featured === 'true';

    return this.marketplaceService.getPublicProducts(
      search,
      categoryId,
      featuredValue,
      countryCode,
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
