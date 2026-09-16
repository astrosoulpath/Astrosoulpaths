import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendSupportMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  clientMessageId?: string;
}
