import { Gender } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @IsDateString()
  declare dob: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'tob must be in HH:mm or HH:mm:ss format',
  })
  declare tob: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(-90)
  @Max(90)
  declare lat: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(-180)
  @Max(180)
  declare lon: number;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(-12)
  @Max(14)
  declare timezone: number;

  @IsOptional()
  @IsString()
  timezoneName?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  fullname?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  lang?: string;

  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}