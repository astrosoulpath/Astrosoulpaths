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

import { ChatMessageType } from '@prisma/client';

export class SendMessageDto {
  @IsString()
  callSessionId!: string;

  @IsEnum(ChatMessageType)
  messageType: ChatMessageType = ChatMessageType.TEXT;

  @ValidateIf(
    (dto: SendMessageDto) =>
      dto.messageType === ChatMessageType.TEXT ||
      dto.messageType === ChatMessageType.SYSTEM,
  )
  @IsString()
  @MaxLength(4000)
  content?: string;

  @ValidateIf(
    (dto: SendMessageDto) =>
      dto.messageType === ChatMessageType.IMAGE ||
      dto.messageType === ChatMessageType.FILE,
  )
  @IsUrl()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  attachmentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  attachmentMimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  attachmentSize?: number;
}