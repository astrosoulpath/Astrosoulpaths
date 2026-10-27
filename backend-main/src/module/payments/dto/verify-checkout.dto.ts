import { IsString, Matches } from 'class-validator';

export class VerifyCheckoutDto {
  @IsString()
  @Matches(/^order_[A-Za-z0-9]+$/)
  orderId!: string;

  @IsString()
  @Matches(/^pay_[A-Za-z0-9]+$/)
  paymentId!: string;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  signature!: string;
}
