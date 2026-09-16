import { IsNotEmpty, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { AiAstroCategory } from '../domain/ai-astro-category';

export class AskAiAstroDto {
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
