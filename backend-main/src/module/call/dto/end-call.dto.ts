import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class EndCallDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;
}