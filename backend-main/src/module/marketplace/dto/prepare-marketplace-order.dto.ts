import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PrepareMarketplaceOrderDto {
  @IsString()
  @IsNotEmpty()
  addressId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  idempotencyKey!: string;
}
