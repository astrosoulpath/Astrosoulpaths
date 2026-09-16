import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { AiReceptionistLanguage } from '../domain/ai-receptionist.enums';

export class CreateAiReceptionistSessionDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'customerPhone must be a valid E.164 phone number',
  })
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerUserId?: string;

  @IsOptional()
  @IsEnum(AiReceptionistLanguage)
  language: AiReceptionistLanguage = AiReceptionistLanguage.AUTO;
}
