import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import type { JWTPayload } from 'jose';
import { memoryStorage } from 'multer';

import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../../common/guards/supabase-auth.guard';
import { ChatService } from '../chat.service';
import { UploadChatFileDto } from '../dto/upload-chat-file.dto';
import { UploadChatImageDto } from '../dto/upload-chat-image.dto';
import { ChatUploadService } from './chat-upload.service';

@Controller('chat/upload')
@UseGuards(SupabaseAuthGuard)
export class ChatUploadController {
  constructor(
    private readonly chatUploadService: ChatUploadService,
    private readonly chatService: ChatService,
  ) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadImage(
    @CurrentUser() user: JWTPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadChatImageDto,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Image file is required',
      );
    }

    await this.chatService.verifyChatAccess(
      user.sub as string,
      dto.callSessionId,
    );

    const uploadResult =
      await this.chatUploadService.uploadImage(
        file,
        dto.callSessionId,
      );

    return {
      success: true,
      message: 'Image uploaded successfully',
      data: {
        ...uploadResult.data,
        caption: dto.caption?.trim() || null,
      },
    };
  }

  @Post('file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  async uploadFile(
    @CurrentUser() user: JWTPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadChatFileDto,
  ) {
    if (!file) {
      throw new BadRequestException(
        'File is required',
      );
    }

    await this.chatService.verifyChatAccess(
      user.sub as string,
      dto.callSessionId,
    );

    const uploadResult =
      await this.chatUploadService.uploadFile(
        file,
        dto.callSessionId,
      );

    return {
      success: true,
      message: 'File uploaded successfully',
      data: {
        ...uploadResult.data,
        caption: dto.caption?.trim() || null,
      },
    };
  }
}