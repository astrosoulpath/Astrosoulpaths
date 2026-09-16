import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class MarketplaceModerationDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class MarketplaceRejectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
