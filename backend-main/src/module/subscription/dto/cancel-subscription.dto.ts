import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean = true;

  @IsOptional()
  @IsString()
  @MaxLength(250, {
    message:
      'Cancellation reason must be 250 characters or less',
  })
  reason?: string;
}