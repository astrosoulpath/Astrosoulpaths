import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ShipMarketplaceOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  trackingCarrier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  trackingNumber!: string;
}
