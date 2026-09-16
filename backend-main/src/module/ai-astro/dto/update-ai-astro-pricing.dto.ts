import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateAiAstroPricingDto {
  @IsBoolean()
  isEnabled!: boolean;

  @IsBoolean()
  isFree!: boolean;

  @ValidateIf(
    (value: UpdateAiAstroPricingDto) =>
      value.isEnabled === true && value.isFree === false,
  )
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0.01)
  pricePerQuestion?: number;

  @IsOptional()
  @IsIn(['INR'])
  currency?: string;
}
