import { IsNotEmpty, IsString, MaxLength, IsOptional, IsIn } from 'class-validator';

import { AI_LANGUAGE_CODES } from '../domain/ai-language-policy';

export class AiAstroOpeningMessageDto {
  @IsOptional()
  @IsIn(AI_LANGUAGE_CODES)
  responseLanguage?: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  personaId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  consultantTypeCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category!: string;
}
