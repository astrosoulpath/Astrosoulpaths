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
  ) {
    const featuredValue =
      featured === undefined ? undefined : featured === 'true';

    return this.marketplaceService.getPublicProducts(
      search,
      categoryId,
      featuredValue,
    );
  }

  @Public()
  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.marketplaceService.getPublicProductById(id);
  }

  @Public()
  @Get('campaigns')
  getCampaigns() {
    return this.marketplaceService.getPublicCampaigns();
  }
}
