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
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  callSessionId!: string;

  @IsOptional()
  @IsEnum(ChatMessageType)
  messageType: ChatMessageType = ChatMessageType.TEXT;

  @ValidateIf(
    (dto: SendMessageDto) =>
      dto.messageType === ChatMessageType.TEXT ||
      dto.messageType === ChatMessageType.SYSTEM,
  )
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(4000)
  content?: string;

  @ValidateIf(
    (dto: SendMessageDto) =>
      dto.messageType === ChatMessageType.IMAGE ||
      dto.messageType === ChatMessageType.FILE,
  )
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsUrl()
  attachmentUrl?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  attachmentName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(150)
  attachmentMimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  attachmentSize?: number;
}