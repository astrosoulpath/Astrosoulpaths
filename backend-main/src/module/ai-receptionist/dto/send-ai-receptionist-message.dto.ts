import { IsString, MaxLength, MinLength } from 'class-validator';

export class SendAiReceptionistMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;
}
