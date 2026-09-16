import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMarketplaceAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(30)
  phone!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(250)
  addressLine1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  landmark?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  city!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  state!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  postalCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryCode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
