import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { Transform } from 'class-transformer';
import { ChatMessageType } from '@prisma/client';

export class SendMessageDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  callSessionId!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  clientMessageId?: string;
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MaxLength(30)
  replyToMessageId?: string;

  @IsOptional()
  @IsEnum(ChatMessageType)
  messageType: ChatMessageType = ChatMessageType.TEXT;

  @ValidateIf(
    (dto: SendMessageDto) => dto.messageType === ChatMessageType.SYSTEM,
  )
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(30000)
  encryptedContent?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  encryptionNonce?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(128)
  encryptionMac?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  encryptionVersion?: number;

  @ValidateIf(
    (dto: SendMessageDto) =>
      dto.messageType === ChatMessageType.IMAGE ||
      dto.messageType === ChatMessageType.STICKER ||
      dto.messageType === ChatMessageType.FILE,
  )
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUrl()
  attachmentUrl?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  attachmentPath?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  attachmentName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(150)
  attachmentMimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  attachmentSize?: number;
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10 * 60 * 1000)
  audioDurationMs?: number;
}
