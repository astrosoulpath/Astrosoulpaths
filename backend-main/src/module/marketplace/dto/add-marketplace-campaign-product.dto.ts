import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

import { MarketplaceDiscountType } from '@prisma/client';

export class AddMarketplaceCampaignProductDto {
  @IsOptional()
  @IsEnum(MarketplaceDiscountType)
  overrideDiscountType?: MarketplaceDiscountType;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  overrideDiscountValue?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  overrideMaxDiscount?: number;
}
