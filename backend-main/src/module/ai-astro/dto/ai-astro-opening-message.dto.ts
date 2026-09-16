import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AiAstroOpeningMessageDto {
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
