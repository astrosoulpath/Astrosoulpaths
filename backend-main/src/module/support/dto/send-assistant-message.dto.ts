import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendAssistantMessageDto {
  @IsOptional() @IsString() @MaxLength(80) categoryId?: string;
  @IsOptional() @IsString() @MaxLength(80) questionId?: string;
  @IsOptional() @IsString() @MaxLength(80) paymentOrderId?: string;
  @IsOptional() @IsString() @MaxLength(80) consultationId?: string;
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  clientMessageId?: string;
}
