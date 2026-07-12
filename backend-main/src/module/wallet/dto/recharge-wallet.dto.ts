import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class RechargeWalletDto {
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a valid number' },
  )
  @Min(1, {
    message: 'Minimum recharge amount is ₹1',
  })
  @Max(100000, {
    message: 'Maximum recharge amount is ₹1,00,000',
  })
  amount!: number;
}