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
  // ── Required ─────────────────────────────────────────────────────────────

  @IsString()
  @IsNotEmpty()
  declare name: string;

  /** ISO date string — e.g. "1995-06-15" */
  @IsDateString()
  declare dob: string;

  /** HH:mm or HH:mm:ss — e.g. "14:30" or "14:30:00" */
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

  /** UTC offset in hours — e.g. 5.5 for IST */
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(-12)
  @Max(14)
  declare timezone: number;

  // ── Optional ──────────────────────────────────────────────────────────────

  /** IANA timezone name — e.g. "Asia/Kolkata". May or may not be present depending on geo API. */
  @IsOptional()
  @IsString()
  timezoneName?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  /** Full legal name — may differ from display name */
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

  /** ISO 3166-1 alpha-2 — e.g. "IN" */
  @IsOptional()
  @IsString()
  countryCode?: string;

  /** BCP 47 language tag — defaults to "en" */
  @IsOptional()
  @IsString()
  lang?: string;
}
