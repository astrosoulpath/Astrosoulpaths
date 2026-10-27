import { IsNotEmpty, IsEnum, IsOptional, IsString, MaxLength, MinLength, IsIn } from 'class-validator';
import { AI_LANGUAGE_CODES } from '../domain/ai-language-policy';

import { AiAstroCategory } from '../domain/ai-astro-category';

export class AskAiAstroDto {
  @IsOptional()
  @IsIn(AI_LANGUAGE_CODES)
  responseLanguage?: string;
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  consultantTypeCode?: string;

  @IsEnum(AiAstroCategory)
  category!: AiAstroCategory;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  question!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  personaId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  clientRequestId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  clientSessionId?: string;}
