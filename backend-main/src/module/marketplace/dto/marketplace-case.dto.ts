import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateMarketplaceCaseDto {
  @IsIn(['REFUND', 'DISPUTE']) kind!: 'REFUND' | 'DISPUTE';
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
  @IsString() @MinLength(8) @MaxLength(128) idempotencyKey!: string;
  @IsOptional() @IsInt() @Min(1) amountMinor?: number;
}

export class ReviewMarketplaceCaseDto {
  @IsIn(['APPROVED', 'REJECTED', 'RESOLVED']) status!: 'APPROVED' | 'REJECTED' | 'RESOLVED';
}
