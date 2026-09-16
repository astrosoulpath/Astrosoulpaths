import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AstrologerAvailabilityDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsBoolean()
  isEnabled: boolean;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;
}

export class UpdateAstrologerAvailabilityDto {
  @IsString()
  timezone: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AstrologerAvailabilityDayDto)
  days: AstrologerAvailabilityDayDto[];
}
