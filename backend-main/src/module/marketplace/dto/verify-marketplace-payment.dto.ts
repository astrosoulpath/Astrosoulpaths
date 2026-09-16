import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerifyMarketplacePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  razorpayOrderId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  razorpayPaymentId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  razorpaySignature!: string;
}
