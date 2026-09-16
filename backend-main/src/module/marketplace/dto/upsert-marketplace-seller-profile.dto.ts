import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertMarketplaceSellerProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shopDisplayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  shopBio?: string;
}
