import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class LiveCreateDto {
  @IsUUID('4') joinRequestId!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) resumeSecret!: string;
}
export class LiveStartDto extends LiveCreateDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
}
export class LiveProofDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) resumeSecret!: string;
  @IsInt() @Min(1) @Max(2147483646) generation!: number;
}
export class LiveResumeDto extends LiveProofDto {
  @IsUUID('4') resumeRequestId!: string;
}
export class LiveEndDto extends LiveProofDto {
  @IsUUID('4') connectionId!: string;
}

export class LiveDiscoveryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  offset: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit: number =
    20;
}
