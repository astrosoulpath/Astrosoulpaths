import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class StartAiAstroSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  clientSessionId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  personaId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  consultantTypeCode!: string;

  // Selected paid consultation duration.
  // Optional temporarily so current Flutter build remains compatible.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  durationMinutes?: number;
}
