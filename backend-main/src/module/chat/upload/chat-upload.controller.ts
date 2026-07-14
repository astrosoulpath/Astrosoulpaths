import {
  BadRequestException,
  Body,
  Controller,
  PayloadTooLargeException,
  Post,
  UnsupportedMediaTypeException,
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

const MAX_IMAGE_SIZE =
  10 * 1024 * 1024;

const MAX_FILE_SIZE =
  20 * 1024 * 1024;

const IMAGE_MIME_TYPES =
  new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);

const FILE_MIME_TYPES =
  new Set([
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/webm',
  ]);

function imageFileFilter(
  _request: Express.Request,
  file: Express.Multer.File,
  callback: (
    error: Error | null,
    acceptFile: boolean,
  ) => void,
): void {
  const mimeType =
    file.mimetype
      ?.trim()
      .toLowerCase();

  if (
    !mimeType ||
    !IMAGE_MIME_TYPES.has(
      mimeType,
    )
  ) {
    callback(
      new UnsupportedMediaTypeException(
        'Unsupported image type',
      ),
      false,
    );

    return;
  }

  callback(
    null,
    true,
  );
}

function attachmentFileFilter(
  _request: Express.Request,
  file: Express.Multer.File,
  callback: (
    error: Error | null,
    acceptFile: boolean,
  ) => void,
): void {
  const mimeType =
    file.mimetype
      ?.trim()
      .toLowerCase();

  if (
    !mimeType ||
    !FILE_MIME_TYPES.has(
      mimeType,
    )
  ) {
    callback(
      new UnsupportedMediaTypeException(
        'Unsupported file type',
      ),
      false,
    );

    return;
  }

  callback(
    null,
    true,
  );
}

@Controller('chat/upload')
@UseGuards(SupabaseAuthGuard)
export class ChatUploadController {
  constructor(
    private readonly chatUploadService:
      ChatUploadService,

    private readonly chatService:
      ChatService,
  ) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor(
      'file',
      {
        storage:
          memoryStorage(),

        limits: {
          fileSize:
            MAX_IMAGE_SIZE,

          files:
            1,
        },

        fileFilter:
          imageFileFilter,
      },
    ),
  )
  async uploadImage(
    @CurrentUser()
    user: JWTPayload,

    @UploadedFile()
    file:
      | Express.Multer.File
      | undefined,

    @Body()
    dto: UploadChatImageDto,
  ) {
    const supabaseId =
      this.getCurrentUserId(
        user,
      );

    if (!file) {
      throw new BadRequestException(
        'Image file is required',
      );
    }

    this.assertFileSize(
      file,
      MAX_IMAGE_SIZE,
      'Image exceeds 10 MB',
    );

    const {
      callSession,
    } =
      await this.chatService.verifyChatAccess(
        supabaseId,
        dto.callSessionId,
      );

    this.assertConsultationCanUpload(
      callSession,
    );

    const uploadResult =
      await this.chatUploadService.uploadImage(
        file,
        callSession.id,
      );

    return {
      success: true,

      message:
        'Image uploaded successfully',

      data: {
        ...uploadResult.data,

        caption:
          dto.caption?.trim() ||
          null,
      },
    };
  }

  @Post('file')
  @UseInterceptors(
    FileInterceptor(
      'file',
      {
        storage:
          memoryStorage(),

        limits: {
          fileSize:
            MAX_FILE_SIZE,

          files:
            1,
        },

        fileFilter:
          attachmentFileFilter,
      },
    ),
  )
  async uploadFile(
    @CurrentUser()
    user: JWTPayload,

    @UploadedFile()
    file:
      | Express.Multer.File
      | undefined,

    @Body()
    dto: UploadChatFileDto,
  ) {
    const supabaseId =
      this.getCurrentUserId(
        user,
      );

    if (!file) {
      throw new BadRequestException(
        'File is required',
      );
    }

    this.assertFileSize(
      file,
      MAX_FILE_SIZE,
      'File exceeds 20 MB',
    );

    const {
      callSession,
    } =
      await this.chatService.verifyChatAccess(
        supabaseId,
        dto.callSessionId,
      );

    this.assertConsultationCanUpload(
      callSession,
    );

    const uploadResult =
      await this.chatUploadService.uploadFile(
        file,
        callSession.id,
      );

    return {
      success: true,

      message:
        'File uploaded successfully',

      data: {
        ...uploadResult.data,

        caption:
          dto.caption?.trim() ||
          null,
      },
    };
  }

  private getCurrentUserId(
    user: JWTPayload,
  ): string {
    const supabaseId =
      typeof user.sub ===
        'string'
        ? user.sub.trim()
        : '';

    if (!supabaseId) {
      throw new BadRequestException(
        'Authenticated user ID is missing',
      );
    }

    return supabaseId;
  }

  private assertFileSize(
    file: Express.Multer.File,
    maximumSize: number,
    errorMessage: string,
  ): void {
    if (
      !Number.isFinite(
        file.size,
      ) ||
      file.size <= 0 ||
      !file.buffer?.length
    ) {
      throw new BadRequestException(
        'Uploaded file is empty or invalid',
      );
    }

    if (
      file.size >
      maximumSize
    ) {
      throw new PayloadTooLargeException(
        errorMessage,
      );
    }
  }

  private assertConsultationCanUpload(
    callSession: {
      status: string;
      endedAt: Date | null;
      expiresAt: Date;
    },
  ): void {
    if (
      callSession.status !==
      'ACTIVE'
    ) {
      throw new BadRequestException(
        'Attachments can only be uploaded during an active consultation',
      );
    }

    if (callSession.endedAt) {
      throw new BadRequestException(
        'This consultation has ended',
      );
    }

    if (
      callSession.expiresAt.getTime() <=
      Date.now()
    ) {
      throw new BadRequestException(
        'This consultation has expired',
      );
    }
  }
}