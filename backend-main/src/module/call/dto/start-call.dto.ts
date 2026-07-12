import { Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class StartCallDto {
  @IsString()
  astrologerId!: string;

  @Type(() => Number)
  @IsInt({
    message: 'Minutes must be a whole number',
  })
  @Min(1, {
    message: 'Minimum consultation duration is 1 minute',
  })
  @Max(120, {
    message: 'Maximum consultation duration is 120 minutes',
  })
  minutes!: number;
}