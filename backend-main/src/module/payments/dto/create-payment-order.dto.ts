import { IsNumber, Min } from 'class-validator';

export class CreatePaymentOrderDto {
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Amount must be a valid number with up to two decimals' },
  )
  @Min(1, { message: 'Amount must be at least 1 rupee' })
  amount: number;
}
