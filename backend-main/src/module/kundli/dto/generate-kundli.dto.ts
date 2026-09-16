import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GenerateKundliDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  birthPlace!: string;

  @IsDateString(
    {},
    {
      message: 'Date of birth must use YYYY-MM-DD format',
    },
  )
  dob!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time of birth must use HH:mm format',
  })
  tob!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-12)
  @Max(14)
  timezone!: number;

  @IsOptional()
  @IsString()
  @IsIn(['en', 'hi'])
  lang?: string;
}
