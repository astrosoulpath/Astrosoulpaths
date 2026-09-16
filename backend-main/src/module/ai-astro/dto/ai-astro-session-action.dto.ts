import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AiAstroSessionActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  clientSessionId!: string;
}