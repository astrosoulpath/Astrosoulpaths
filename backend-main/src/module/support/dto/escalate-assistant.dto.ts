import { IsOptional, IsString, MaxLength } from 'class-validator';

export class EscalateAssistantDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}
