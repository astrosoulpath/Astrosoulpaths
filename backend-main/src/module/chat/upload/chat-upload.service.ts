import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Express } from 'express';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service';

@Injectable()
export class ChatUploadService {
  constructor(
    private readonly supabaseService: SupabaseService,
  ) {}

  private readonly imageMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  private readonly allowedFileMimeTypes = [
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
  ];

  private readonly maxImageSize =
    10 * 1024 * 1024;

  private readonly maxFileSize =
    20 * 1024 * 1024;

  async uploadImage(
    file: Express.Multer.File,
    callSessionId: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Image is required',
      );
    }

    if (
      !this.imageMimeTypes.includes(
        file.mimetype,
      )
    ) {
      throw new BadRequestException(
        'Unsupported image type',
      );
    }

    if (
      file.size > this.maxImageSize
    ) {
      throw new BadRequestException(
        'Image exceeds 10 MB',
      );
    }

    return this.upload(
      file,
      callSessionId,
      'images',
    );
  }

  async uploadFile(
    file: Express.Multer.File,
    callSessionId: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        'File is required',
      );
    }

    if (
      !this.allowedFileMimeTypes.includes(
        file.mimetype,
      )
    ) {
      throw new BadRequestException(
        'Unsupported file type',
      );
    }

    if (
      file.size > this.maxFileSize
    ) {
      throw new BadRequestException(
        'File exceeds 20 MB',
      );
    }

    return this.upload(
      file,
      callSessionId,
      'files',
    );
  }

  private async upload(
    file: Express.Multer.File,
    callSessionId: string,
    folder: string,
  ) {
    const bucket = 'chat';

    const extension =
      extname(file.originalname);

    const fileName = `${callSessionId}/${folder}/${randomUUID()}${extension}`;

    const client =
      this.supabaseService.getStorageClient();

    const { error } =
      await client.storage
        .from(bucket)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

    if (error) {
      throw new BadRequestException(
        error.message,
      );
    }

    const {
      data: publicData,
    } = client.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return {
      success: true,

      data: {
        url: publicData.publicUrl,

        path: fileName,

        fileName:
          file.originalname,

        mimeType:
          file.mimetype,

        size: file.size,
      },
    };
  }
}