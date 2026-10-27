import { IsOptional, IsString, MaxLength, IsBoolean } from 'class-validator';

export class EscalateAssistantDto {
  @IsOptional() @IsBoolean() includeConversation?: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(160)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}
